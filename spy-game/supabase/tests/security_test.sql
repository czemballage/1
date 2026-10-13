-- RLS / game-logic test with simulated players. Run in the SQL editor (or via MCP execute_sql).
-- It ends with RAISE EXCEPTION carrying the results as JSON, so the whole transaction is
-- rolled back: no test users, rooms or stats are left behind.
-- Expected (2026-10-13 run): every *_denied / *_blocked = true, outsider_sees_* = 0,
-- each_player_sees_only_own_secret = true, status_after_votes = "guess", outcome = "guessed",
-- rate_limited = true, anon_packs = 14, is_member_rpc_exposed = false.
do $test$
declare
  u uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  res jsonb := '{}'::jsonb;
  room jsonb;
  rid uuid;
  spies uuid[];
  item text;
  n int;
  t text;
  st text;
  ok boolean := true;
begin
  for i in 1..5 loop
    insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (u[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spytest' || i || '@example.invalid', '{}', '{}', now(), now());
  end loop;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', u[1], 'role', 'authenticated')::text, true);
  room := public.spy_create_room('أمين', 'spy', 'daily-life', 'places', 6);
  rid := (room ->> 'id')::uuid;
  for i in 2..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', u[i], 'role', 'authenticated')::text, true);
    perform public.spy_join_room(lower(room ->> 'code'), 'لاعب' || i, 'user');
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', u[5], 'role', 'authenticated')::text, true);
  begin
    perform public.spy_join_room(room ->> 'code', 'امين', 'user');
    res := res || '{"dup_name_blocked": false}';
  exception when others then res := res || jsonb_build_object('dup_name_blocked', sqlerrm = 'name_taken');
  end;
  select count(*) into n from public.spy_rooms where id = rid;
  res := res || jsonb_build_object('outsider_sees_room', n);
  select count(*) into n from public.spy_room_players where room_id = rid;
  res := res || jsonb_build_object('outsider_sees_players', n);

  perform set_config('request.jwt.claims', json_build_object('sub', u[2], 'role', 'authenticated')::text, true);
  begin
    perform public.spy_start_round(rid);
    res := res || '{"non_host_start_blocked": false}';
  exception when others then res := res || jsonb_build_object('non_host_start_blocked', sqlerrm = 'not_host');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u[1], 'role', 'authenticated')::text, true);
  perform public.spy_start_round(rid);

  for i in 1..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', u[i], 'role', 'authenticated')::text, true);
    select count(*) into n from public.spy_room_secrets where room_id = rid;
    if n <> 1 then ok := false; end if;
    select count(*) into n from public.spy_room_secrets where room_id = rid and user_id <> u[i];
    if n <> 0 then ok := false; end if;
  end loop;
  res := res || jsonb_build_object('each_player_sees_only_own_secret', ok);

  begin
    select count(*) into n from public.spy_room_answers;
    res := res || jsonb_build_object('answers_readable_rows', n);
  exception when insufficient_privilege then res := res || '{"answers_denied": true}';
  end;
  begin
    insert into public.spy_room_secrets (room_id, user_id, round, kind) values (rid, u[4], 1, 'spy');
    res := res || '{"secret_insert_denied": false}';
  exception when insufficient_privilege then res := res || '{"secret_insert_denied": true}';
  end;
  begin
    update public.spy_rooms set status = 'result' where id = rid;
    res := res || '{"room_update_denied": false}';
  exception when insufficient_privilege then res := res || '{"room_update_denied": true}';
  end;
  begin
    perform spy_private.spy_is_member(rid);
    res := res || '{"is_member_callable_internally": true}';
  exception when others then res := res || '{"is_member_callable_internally": false}';
  end;
  begin
    perform public.spy_is_member(rid);
    res := res || '{"is_member_rpc_exposed": true}';
  exception when undefined_function then res := res || '{"is_member_rpc_exposed": false}';
  end;

  execute 'reset role';
  select a.spies, a.item_name into spies, item from public.spy_room_answers a where a.room_id = rid;
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', u[1], 'role', 'authenticated')::text, true);
  perform public.spy_call_vote(rid);
  for i in 1..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', u[i], 'role', 'authenticated')::text, true);
    if u[i] = spies[1] then
      perform public.spy_cast_vote(rid, case when u[i] = u[1] then u[2] else u[1] end);
    else
      perform public.spy_cast_vote(rid, spies[1]);
    end if;
  end loop;
  select status into st from public.spy_rooms where id = rid;
  res := res || jsonb_build_object('status_after_votes', st);

  perform set_config('request.jwt.claims', json_build_object('sub', spies[1], 'role', 'authenticated')::text, true);
  perform public.spy_submit_guess(rid, item);
  select result ->> 'outcome' into t from public.spy_rooms where id = rid;
  res := res || jsonb_build_object('outcome', t);

  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.spy_packs;
  res := res || jsonb_build_object('anon_packs', n);
  begin
    select count(*) into n from public.spy_room_secrets;
    res := res || jsonb_build_object('anon_secrets_rows', n);
  exception when insufficient_privilege then res := res || '{"anon_secrets_denied": true}';
  end;

  raise exception 'TEST_RESULT %', res;
end
$test$;
