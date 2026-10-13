-- PENDING: needs the project owner's confirmation (contains DELETE statements, which the
-- Supabase MCP gate refuses to run unattended). Apply from the SQL editor or `supabase db push`.
-- Until applied: players leave a room by closing the app (the host can close the vote early),
-- and expired rooms are only marked closed by spy_cleanup().

create or replace function public.spy_leave_room(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.spy_rooms;
  next_host uuid;
  n int;
begin
  select * into r from public.spy_rooms where id = p_room for update;
  if not found then return; end if;
  delete from public.spy_room_players where room_id = p_room and user_id = uid;
  delete from public.spy_room_secrets where room_id = p_room and user_id = uid;
  select count(*) into n from public.spy_room_players where room_id = p_room;
  if n = 0 then
    update public.spy_rooms set status = 'closed' where id = p_room;
    return;
  end if;
  if r.host = uid then
    select user_id into next_host from public.spy_room_players where room_id = p_room order by seat limit 1;
    update public.spy_rooms set host = next_host where id = p_room;
  end if;
  if n < 3 and r.status in ('playing', 'voting', 'guess') then
    update public.spy_rooms set status = 'lobby', ends_at = null, accused = null where id = p_room;
  end if;
end;
$$;

revoke all on function public.spy_leave_room(uuid) from public, anon;
grant execute on function public.spy_leave_room(uuid) to authenticated;

-- Purge expired / long-closed rooms (cascade removes players, secrets, answers, votes).
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
  delete from public.spy_rooms
  where expires_at < now() or (status = 'closed' and created_at < now() - interval '1 hour');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.spy_cleanup() from public, anon, authenticated;
