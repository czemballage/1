-- Game functions. All game state changes happen here, server-side, as security definer.
-- Roles and the spy's identity are decided in Postgres; clients only ever read their own card.

-- ---------------------------------------------------------------- helpers (not callable by clients)
create or replace function public.spy_gen_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ';
  c text;
  tries int := 0;
begin
  loop
    c := '';
    for i in 1..4 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.spy_rooms where code = c and status <> 'closed');
    tries := tries + 1;
    if tries > 50 then
      raise exception 'code_space_exhausted';
    end if;
  end loop;
  return c;
end;
$$;

create or replace function public.spy_clean_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[\x00-\x1F<>]', '', 'g'), '\s+', ' ', 'g'));
$$;

create or replace function public.spy_norm_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(public.spy_clean_name(p), 'أإآةى', 'اااهي'));
$$;

-- Finish a round: write the public result, update stats for every player.
create or replace function public.spy_finalize(p_room uuid, p_outcome text, p_guess text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.spy_room_answers;
  r public.spy_rooms;
  pts jsonb := '{}'::jsonb;
  spies_json jsonb;
  p record;
  is_spy boolean;
  gain int;
begin
  select * into r from public.spy_rooms where id = p_room;
  select * into a from public.spy_room_answers where room_id = p_room;
  for p in select user_id, name from public.spy_room_players where room_id = p_room loop
    is_spy := p.user_id = any (a.spies);
    gain := case
      when p_outcome in ('escaped', 'guessed') and is_spy then 2
      when p_outcome = 'caught' and not is_spy then 1
      else 0 end;
    pts := pts || jsonb_build_object(p.user_id::text, gain);
    insert into public.spy_user_stats as s (user_id, games_played, times_spy, spy_wins, innocent_wins, updated_at)
    values (p.user_id, 1, is_spy::int, (is_spy and p_outcome in ('escaped', 'guessed'))::int, ((not is_spy) and p_outcome = 'caught')::int, now())
    on conflict (user_id) do update set
      games_played = s.games_played + 1,
      times_spy = s.times_spy + excluded.times_spy,
      spy_wins = s.spy_wins + excluded.spy_wins,
      innocent_wins = s.innocent_wins + excluded.innocent_wins,
      updated_at = now();
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', rp.user_id, 'name', rp.name) order by rp.seat), '[]'::jsonb)
    into spies_json
    from public.spy_room_players rp
    where rp.room_id = p_room and rp.user_id = any (a.spies);
  update public.spy_rooms set
    status = 'result',
    result = jsonb_build_object(
      'outcome', p_outcome,
      'item', a.item_name,
      'spies', spies_json,
      'accused', r.accused,
      'guess', p_guess,
      'points', pts,
      'round', r.round
    )
  where id = p_room;
end;
$$;

create or replace function public.spy_resolve(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.spy_rooms;
  a public.spy_room_answers;
  n int;
  best uuid;
  best_n int;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if r.status not in ('playing', 'voting') then
    return;
  end if;
  select * into a from public.spy_room_answers where room_id = p_room;
  select count(*) into n from public.spy_room_players where room_id = p_room;
  select target, count(*) into best, best_n
    from public.spy_votes
    where room_id = p_room and round = r.round
    group by target
    order by count(*) desc
    limit 1;
  if best is not null and best_n * 2 > n then
    update public.spy_rooms set accused = best where id = p_room;
    if best = any (a.spies) then
      update public.spy_rooms set status = 'guess' where id = p_room;
      return;
    end if;
  else
    update public.spy_rooms set accused = null where id = p_room;
  end if;
  perform public.spy_finalize(p_room, 'escaped', null);
end;
$$;

revoke all on function public.spy_gen_code() from public, anon, authenticated;
revoke all on function public.spy_finalize(uuid, text, text) from public, anon, authenticated;
revoke all on function public.spy_resolve(uuid) from public, anon, authenticated;
revoke all on function public.spy_clean_name(text) from public, anon;
revoke all on function public.spy_norm_name(text) from public, anon;

-- ---------------------------------------------------------------- client API
create or replace function public.spy_create_room(p_name text, p_avatar text, p_pack text, p_mode text, p_minutes int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pname text := public.spy_clean_name(p_name);
  recent int;
  v_mode text;
  v_pack_name text;
  v_custom uuid;
  r public.spy_rooms;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(pname) not between 1 and 16 then raise exception 'bad_name'; end if;
  if coalesce(p_minutes, 0) not between 1 and 15 then raise exception 'bad_minutes'; end if;

  -- rate limit: 5 rooms per user per hour
  select count(*) into recent from public.spy_rooms where host = uid and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'rate_limited'; end if;

  if p_pack ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id, name_ar, mode into v_custom, v_pack_name, v_mode from public.spy_custom_packs where id = p_pack::uuid and owner = uid;
    if v_custom is null then raise exception 'pack_not_found'; end if;
  else
    select name_ar, mode into v_pack_name, v_mode from public.spy_packs where id = p_pack and published;
    if v_pack_name is null then raise exception 'pack_not_found'; end if;
  end if;
  if v_mode = 'places' and p_mode = 'words' then v_mode := 'words'; end if;

  -- a host has one open room at a time
  update public.spy_rooms set status = 'closed' where host = uid and status <> 'closed';

  insert into public.spy_rooms (code, host, pack_id, pack_name, custom_pack, mode, minutes)
  values (public.spy_gen_code(), uid, p_pack, v_pack_name, v_custom, v_mode, p_minutes)
  returning * into r;

  insert into public.spy_room_players (room_id, user_id, name, avatar, seat)
  values (r.id, uid, pname, coalesce(nullif(p_avatar, ''), 'spy'), 0);

  return jsonb_build_object('id', r.id, 'code', r.code);
end;
$$;

create or replace function public.spy_join_room(p_code text, p_name text, p_avatar text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pname text := public.spy_clean_name(p_name);
  r public.spy_rooms;
  n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if char_length(pname) not between 1 and 16 then raise exception 'bad_name'; end if;
  select * into r from public.spy_rooms
    where code = upper(btrim(p_code)) and status <> 'closed' and expires_at > now()
    order by created_at desc limit 1
    for update;
  if not found then raise exception 'room_not_found'; end if;

  if exists (select 1 from public.spy_room_players where room_id = r.id and user_id = uid) then
    if exists (select 1 from public.spy_room_players where room_id = r.id and user_id <> uid and public.spy_norm_name(name) = public.spy_norm_name(pname)) then
      raise exception 'name_taken';
    end if;
    update public.spy_room_players set name = pname, avatar = coalesce(nullif(p_avatar, ''), avatar) where room_id = r.id and user_id = uid;
    return jsonb_build_object('id', r.id, 'code', r.code);
  end if;

  if r.status not in ('lobby', 'result') then raise exception 'game_started'; end if;
  select count(*) into n from public.spy_room_players where room_id = r.id;
  if n >= 12 then raise exception 'room_full'; end if;
  if exists (select 1 from public.spy_room_players where room_id = r.id and public.spy_norm_name(name) = public.spy_norm_name(pname)) then
    raise exception 'name_taken';
  end if;

  insert into public.spy_room_players (room_id, user_id, name, avatar, seat)
  values (r.id, uid, pname, coalesce(nullif(p_avatar, ''), 'spy'),
          coalesce((select max(seat) + 1 from public.spy_room_players where room_id = r.id), 0));
  return jsonb_build_object('id', r.id, 'code', r.code);
end;
$$;

create or replace function public.spy_start_round(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.spy_rooms;
  n int;
  cnt int;
  idx int;
  spy_count int;
  v_ids text[];
  v_names text[];
  v_items jsonb;
  v_item_id text;
  v_item_name text;
  v_roles text[];
  v_last text;
  v_spies uuid[];
  v_options jsonb;
  p record;
  k int := 0;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host <> uid then raise exception 'not_host'; end if;
  if r.status not in ('lobby', 'result') then raise exception 'bad_state'; end if;
  if r.expires_at < now() then raise exception 'room_expired'; end if;
  select count(*) into n from public.spy_room_players where room_id = p_room;
  if n < 3 then raise exception 'not_enough_players'; end if;
  if n > 12 then raise exception 'too_many_players'; end if;
  spy_count := case when n >= 8 then 2 else 1 end;

  select last_item into v_last from public.spy_room_answers where room_id = p_room;

  -- candidate items (official pack or the host's custom pack)
  if r.custom_pack is not null then
    select cp.items into v_items from public.spy_custom_packs cp where cp.id = r.custom_pack;
    select array_agg(coalesce(e.value ->> 'id', e.ordinality::text) order by e.ordinality),
           array_agg(e.value ->> 'name_ar' order by e.ordinality)
      into v_ids, v_names
      from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) with ordinality e
      where coalesce(e.value ->> 'name_ar', '') <> '';
  else
    select array_agg(i.id order by i.sort), array_agg(i.name_ar order by i.sort)
      into v_ids, v_names
      from public.spy_pack_items i where i.pack_id = r.pack_id;
  end if;
  cnt := coalesce(array_length(v_ids, 1), 0);
  if cnt < 3 then raise exception 'pack_too_small'; end if;

  -- never the same item twice in a row
  select g into idx from generate_series(1, cnt) g where v_ids[g] is distinct from v_last order by random() limit 1;
  v_item_id := v_ids[idx];
  v_item_name := v_names[idx];

  if r.custom_pack is not null then
    select coalesce(array_agg(x), '{}') into v_roles
      from jsonb_array_elements_text(coalesce((select e.value -> 'roles_ar' from jsonb_array_elements(v_items) e where e.value ->> 'name_ar' = v_item_name limit 1), '[]'::jsonb)) x;
  else
    select roles_ar into v_roles from public.spy_pack_items where pack_id = r.pack_id and id = v_item_id;
  end if;
  select coalesce(array_agg(x order by random()), '{}') into v_roles from unnest(v_roles) x;

  -- spy guess grid: the answer + up to 15 others
  select jsonb_agg(s.x order by random()) into v_options from (
    (select v_names[g] as x from generate_series(1, cnt) g where g <> idx order by random() limit 15)
    union all select v_item_name
  ) s;

  v_spies := array(select user_id from public.spy_room_players where room_id = p_room order by random() limit spy_count);

  -- one card per player (upsert: no deletes needed between rounds)
  for p in select user_id from public.spy_room_players where room_id = p_room order by random() loop
    if p.user_id = any (v_spies) then
      insert into public.spy_room_secrets (room_id, user_id, round, kind, place, role, word)
      values (p_room, p.user_id, r.round + 1, 'spy', null, null, null)
      on conflict (room_id, user_id) do update set round = excluded.round, kind = excluded.kind, place = null, role = null, word = null;
    elsif r.mode = 'places' then
      insert into public.spy_room_secrets (room_id, user_id, round, kind, place, role, word)
      values (p_room, p.user_id, r.round + 1, 'place', v_item_name,
              case when coalesce(array_length(v_roles, 1), 0) > 0 then v_roles[(k % array_length(v_roles, 1)) + 1] end, null)
      on conflict (room_id, user_id) do update set round = excluded.round, kind = excluded.kind, place = excluded.place, role = excluded.role, word = null;
      k := k + 1;
    else
      insert into public.spy_room_secrets (room_id, user_id, round, kind, place, role, word)
      values (p_room, p.user_id, r.round + 1, 'word', null, null, v_item_name)
      on conflict (room_id, user_id) do update set round = excluded.round, kind = excluded.kind, place = null, role = null, word = excluded.word;
    end if;
  end loop;

  insert into public.spy_room_answers (room_id, item_id, item_name, spies, last_item)
  values (p_room, v_item_id, v_item_name, v_spies, v_item_id)
  on conflict (room_id) do update set item_id = excluded.item_id, item_name = excluded.item_name, spies = excluded.spies, last_item = excluded.last_item;

  update public.spy_rooms set
    status = 'playing',
    round = r.round + 1,
    ends_at = now() + make_interval(mins => r.minutes),
    first_asker = (select user_id from public.spy_room_players where room_id = p_room and not (user_id = any (v_spies)) order by random() limit 1),
    accused = null,
    votes_count = 0,
    result = null,
    options = v_options,
    locations = to_jsonb(v_names)
  where id = p_room;
end;
$$;

-- Host can open the vote any time; any member can once the timer has run out.
create or replace function public.spy_call_vote(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.spy_rooms;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if not found or not public.spy_is_member(p_room) then raise exception 'not_member'; end if;
  if r.status <> 'playing' then return; end if;
  if r.host <> uid and now() < r.ends_at then raise exception 'not_host'; end if;
  update public.spy_rooms set status = 'voting', ends_at = least(ends_at, now()) where id = p_room;
end;
$$;

create or replace function public.spy_cast_vote(p_room uuid, p_target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.spy_rooms;
  n int;
  c int;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if not found or not public.spy_is_member(p_room) then raise exception 'not_member'; end if;
  if r.status = 'playing' and now() >= r.ends_at then
    update public.spy_rooms set status = 'voting' where id = p_room;
    r.status := 'voting';
  end if;
  if r.status <> 'voting' then raise exception 'not_voting'; end if;
  if p_target = uid then raise exception 'self_vote'; end if;
  if not exists (select 1 from public.spy_room_players where room_id = p_room and user_id = p_target) then
    raise exception 'bad_target';
  end if;
  insert into public.spy_votes (room_id, round, voter, target) values (p_room, r.round, uid, p_target)
  on conflict (room_id, round, voter) do update set target = excluded.target, created_at = now();
  select count(*) into c from public.spy_votes v
    where v.room_id = p_room and v.round = r.round
      and exists (select 1 from public.spy_room_players rp where rp.room_id = p_room and rp.user_id = v.voter);
  select count(*) into n from public.spy_room_players where room_id = p_room;
  update public.spy_rooms set votes_count = c where id = p_room;
  if c >= n then
    perform public.spy_resolve(p_room);
  end if;
end;
$$;

-- Host closes the vote early (e.g. someone is AFK).
create or replace function public.spy_close_vote(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.spy_rooms;
begin
  select * into r from public.spy_rooms where id = p_room;
  if not found or r.host <> auth.uid() then raise exception 'not_host'; end if;
  perform public.spy_resolve(p_room);
end;
$$;

create or replace function public.spy_submit_guess(p_room uuid, p_guess text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.spy_rooms;
  a public.spy_room_answers;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if not found or r.status <> 'guess' then raise exception 'not_guessing'; end if;
  if r.accused is distinct from auth.uid() then raise exception 'not_accused'; end if;
  select * into a from public.spy_room_answers where room_id = p_room;
  perform public.spy_finalize(p_room, case when btrim(p_guess) = a.item_name then 'guessed' else 'caught' end, left(p_guess, 60));
end;
$$;

create or replace function public.spy_close_room(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.spy_rooms set status = 'closed' where id = p_room and host = auth.uid();
end;
$$;

-- Official content as one JSON document; null when the client is already up to date.
create or replace function public.spy_get_content(p_since int default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when m.version <= coalesce(p_since, 0) then null else jsonb_build_object(
    'version', m.version,
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name_ar', p.name_ar, 'icon', p.icon, 'mode', p.mode,
        'items', (select jsonb_agg(
                   jsonb_strip_nulls(jsonb_build_object(
                     'id', i.id, 'name_ar', i.name_ar,
                     'roles_ar', case when p.mode = 'places' then to_jsonb(i.roles_ar) end,
                     'close_ar', i.close_ar))
                   order by i.sort)
                  from public.spy_pack_items i where i.pack_id = p.id)
      ) order by p.sort)
      from public.spy_packs p where p.published), '[]'::jsonb),
    'dares', coalesce((select jsonb_agg(d.text_ar order by d.id) from public.spy_dares d where d.published), '[]'::jsonb)
  ) end
  from public.spy_content_meta m;
$$;

-- Rooms expire after 3 hours (closed by the cron job; rows are purged by migration 0006).
create or replace function public.spy_cleanup()
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.spy_rooms set status = 'closed'
  where status <> 'closed' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.spy_create_room(text, text, text, text, int) from public, anon;
revoke all on function public.spy_join_room(text, text, text) from public, anon;
revoke all on function public.spy_start_round(uuid) from public, anon;
revoke all on function public.spy_call_vote(uuid) from public, anon;
revoke all on function public.spy_cast_vote(uuid, uuid) from public, anon;
revoke all on function public.spy_close_vote(uuid) from public, anon;
revoke all on function public.spy_submit_guess(uuid, text) from public, anon;
revoke all on function public.spy_close_room(uuid) from public, anon;
revoke all on function public.spy_cleanup() from public, anon, authenticated;
grant execute on function public.spy_create_room(text, text, text, text, int) to authenticated;
grant execute on function public.spy_join_room(text, text, text) to authenticated;
grant execute on function public.spy_start_round(uuid) to authenticated;
grant execute on function public.spy_call_vote(uuid) to authenticated;
grant execute on function public.spy_cast_vote(uuid, uuid) to authenticated;
grant execute on function public.spy_close_vote(uuid) to authenticated;
grant execute on function public.spy_submit_guess(uuid, text) to authenticated;
grant execute on function public.spy_close_room(uuid) to authenticated;
grant execute on function public.spy_get_content(int) to anon, authenticated;
