-- Advisor fixes.
-- 1) The RLS membership helper must not be callable as an RPC: move it to a non-exposed schema.
--    Policies reference functions by OID, so they follow the move automatically.
create schema if not exists spy_private;
revoke all on schema spy_private from public, anon;
grant usage on schema spy_private to authenticated;
alter function public.spy_is_member(uuid) set schema spy_private;

-- Functions that call it by name must point at the new schema.
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
  if not found or not spy_private.spy_is_member(p_room) then raise exception 'not_member'; end if;
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
  if not found or not spy_private.spy_is_member(p_room) then raise exception 'not_member'; end if;
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

-- 2) Public content does not need elevated rights: RLS already allows reading published packs.
alter function public.spy_get_content(int) security invoker;

-- 3) Make the "nobody can read the answer key" rule explicit.
create policy spy_room_answers_no_client_access on public.spy_room_answers
  for select to anon, authenticated using (false);
