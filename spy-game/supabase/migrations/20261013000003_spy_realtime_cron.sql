-- Realtime: only the public lobby/game tables. Secrets, answers and votes are NOT published.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.spy_rooms, public.spy_room_players;

-- Scheduled cleanup every 15 minutes.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('spy-cleanup-rooms', '*/15 * * * *', $$select public.spy_cleanup();$$);
