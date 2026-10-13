-- مين الجاسوس؟ — schema. Every table is prefixed spy_ (shared project) and has RLS enabled.
-- Secrets (who is the spy, the location) live in spy_room_secrets / spy_room_answers and are
-- never readable by other players and never added to the realtime publication.

-- ---------------------------------------------------------------- accounts
create table public.spy_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 16),
  avatar text not null default 'spy' check (avatar in ('spy', 'user', 'crown', 'paw', 'ball', 'plane', 'lantern', 'dallah')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spy_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  players jsonb not null default '[]'::jsonb
    check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) <= 12 and pg_column_size(players) < 2000),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 2000),
  updated_at timestamptz not null default now()
);

create table public.spy_user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  games_played int not null default 0,
  times_spy int not null default 0,
  spy_wins int not null default 0,
  innocent_wins int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- official content
create table public.spy_packs (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name_ar text not null,
  icon text not null,
  mode text not null check (mode in ('places', 'words')),
  sort int not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.spy_pack_items (
  pack_id text not null references public.spy_packs (id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9-]{1,40}$'),
  name_ar text not null,
  roles_ar text[] not null default '{}',
  close_ar text,
  sort int not null default 0,
  primary key (pack_id, id)
);

create table public.spy_dares (
  id serial primary key,
  text_ar text not null,
  published boolean not null default true
);

-- Single row: bump version whenever packs/dares change so clients download the update.
create table public.spy_content_meta (
  id boolean primary key default true check (id),
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- user-made packs
create table public.spy_custom_packs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 30),
  mode text not null check (mode in ('places', 'words')),
  items jsonb not null
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 3 and 150 and pg_column_size(items) < 60000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spy_custom_packs_owner_idx on public.spy_custom_packs (owner);

-- ---------------------------------------------------------------- online rooms
create table public.spy_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),
  host uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'voting', 'guess', 'result', 'closed')),
  pack_id text not null,
  pack_name text not null default '',
  custom_pack uuid references public.spy_custom_packs (id) on delete set null,
  mode text not null default 'places' check (mode in ('places', 'words')),
  minutes int not null default 6 check (minutes between 1 and 15),
  round int not null default 0,
  ends_at timestamptz,
  first_asker uuid,
  accused uuid,
  votes_count int not null default 0,
  options jsonb,
  locations jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours'
);
create unique index spy_rooms_code_open_idx on public.spy_rooms (code) where status <> 'closed';
create index spy_rooms_host_idx on public.spy_rooms (host, created_at);
create index spy_rooms_expires_idx on public.spy_rooms (expires_at);
create index spy_rooms_custom_pack_idx on public.spy_rooms (custom_pack);

create table public.spy_room_players (
  room_id uuid not null references public.spy_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 16),
  avatar text not null default 'spy',
  seat int not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index spy_room_players_user_idx on public.spy_room_players (user_id);
alter table public.spy_room_players replica identity full; -- realtime DELETE events keep room_id for filters

-- One row per player: what THEY see on their card. RLS: own row only.
create table public.spy_room_secrets (
  room_id uuid not null references public.spy_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  round int not null,
  kind text not null check (kind in ('place', 'word', 'spy')),
  place text,
  role text,
  word text,
  primary key (room_id, user_id)
);
create index spy_room_secrets_user_idx on public.spy_room_secrets (user_id);

-- The answer key. RLS enabled with NO policies: only security-definer functions can read it.
create table public.spy_room_answers (
  room_id uuid primary key references public.spy_rooms (id) on delete cascade,
  item_id text,
  item_name text not null,
  spies uuid[] not null,
  last_item text
);

create table public.spy_votes (
  room_id uuid not null references public.spy_rooms (id) on delete cascade,
  round int not null,
  voter uuid not null references auth.users (id) on delete cascade,
  target uuid not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round, voter)
);
create index spy_votes_voter_idx on public.spy_votes (voter);

-- ---------------------------------------------------------------- RLS
alter table public.spy_profiles enable row level security;
alter table public.spy_user_data enable row level security;
alter table public.spy_user_stats enable row level security;
alter table public.spy_packs enable row level security;
alter table public.spy_pack_items enable row level security;
alter table public.spy_dares enable row level security;
alter table public.spy_content_meta enable row level security;
alter table public.spy_custom_packs enable row level security;
alter table public.spy_rooms enable row level security;
alter table public.spy_room_players enable row level security;
alter table public.spy_room_secrets enable row level security;
alter table public.spy_room_answers enable row level security;
alter table public.spy_votes enable row level security;

-- Membership helper (security definer avoids recursive RLS on spy_room_players).
create or replace function public.spy_is_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spy_room_players
    where room_id = p_room and user_id = (select auth.uid())
  );
$$;
revoke all on function public.spy_is_member(uuid) from public, anon;
grant execute on function public.spy_is_member(uuid) to authenticated;

-- profiles: each user manages their own row
create policy spy_profiles_select_own on public.spy_profiles for select to authenticated using (id = (select auth.uid()));
create policy spy_profiles_insert_own on public.spy_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy spy_profiles_update_own on public.spy_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- cloud sync of player lists & settings
create policy spy_user_data_select_own on public.spy_user_data for select to authenticated using (user_id = (select auth.uid()));
create policy spy_user_data_insert_own on public.spy_user_data for insert to authenticated with check (user_id = (select auth.uid()));
create policy spy_user_data_update_own on public.spy_user_data for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy spy_user_data_delete_own on public.spy_user_data for delete to authenticated using (user_id = (select auth.uid()));

-- stats: read own; written only by game functions
create policy spy_user_stats_select_own on public.spy_user_stats for select to authenticated using (user_id = (select auth.uid()));

-- official content: public read of published rows
create policy spy_packs_read on public.spy_packs for select to anon, authenticated using (published);
create policy spy_pack_items_read on public.spy_pack_items for select to anon, authenticated
  using (exists (select 1 from public.spy_packs p where p.id = pack_id and p.published));
create policy spy_dares_read on public.spy_dares for select to anon, authenticated using (published);
create policy spy_content_meta_read on public.spy_content_meta for select to anon, authenticated using (true);

-- custom packs: owner only
create policy spy_custom_packs_select_own on public.spy_custom_packs for select to authenticated using (owner = (select auth.uid()));
create policy spy_custom_packs_insert_own on public.spy_custom_packs for insert to authenticated with check (owner = (select auth.uid()));
create policy spy_custom_packs_update_own on public.spy_custom_packs for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy spy_custom_packs_delete_own on public.spy_custom_packs for delete to authenticated using (owner = (select auth.uid()));

-- rooms & players: visible to members only; all writes go through functions
create policy spy_rooms_select_member on public.spy_rooms for select to authenticated using ((select public.spy_is_member(id)));
create policy spy_room_players_select_member on public.spy_room_players for select to authenticated using ((select public.spy_is_member(room_id)));

-- secrets: ONLY your own card
create policy spy_room_secrets_select_own on public.spy_room_secrets for select to authenticated using (user_id = (select auth.uid()));

-- votes: only your own vote (tally is server-side)
create policy spy_votes_select_own on public.spy_votes for select to authenticated using (voter = (select auth.uid()));

-- spy_room_answers: intentionally no policy at all.

-- Table privileges: no direct writes on game tables from clients.
revoke insert, update, delete on public.spy_rooms, public.spy_room_players, public.spy_room_secrets, public.spy_room_answers,
  public.spy_votes, public.spy_user_stats, public.spy_packs, public.spy_pack_items, public.spy_dares, public.spy_content_meta
  from anon, authenticated;
revoke all on public.spy_room_answers from anon, authenticated;
