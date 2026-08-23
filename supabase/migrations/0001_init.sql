-- ============================================================================
--  bayoutonefm — complete database migration (reconstructed from app source)
--  Idempotent: safe to run more than once.
--
--  NOTE: This file reconstructs the tables/RPCs the app queries but that were NOT
--  present in the inline SQL comments shipped in the source. Reconcile with your
--  actual production schema if it differs. Also required OUTSIDE this script:
--    1) Supabase Auth enabled (Email provider).
--    2) A PUBLIC storage bucket named `stickers` (Storage > New bucket).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============ PROFILES ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  bio text default '',
  photo text default '',
  theme text,
  custom_themes jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated using (user_id = auth.uid());

-- ============ FRIENDS ============  (referenced by messages policies — create before messages)
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);
alter table public.friends enable row level security;
drop policy if exists "friends_select" on public.friends;
create policy "friends_select" on public.friends for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friends_insert" on public.friends;
create policy "friends_insert" on public.friends for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "friends_update" on public.friends;
create policy "friends_update" on public.friends for update to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friends_delete" on public.friends;
create policy "friends_delete" on public.friends for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ============ USER DATA (cloud sync row) ============
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  songs jsonb not null default '[]'::jsonb,
  people jsonb not null default '[]'::jsonb,
  wishlist jsonb not null default '[]'::jsonb,
  stickers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "user_data_select" on public.user_data;
create policy "user_data_select" on public.user_data for select to authenticated using (user_id = auth.uid());
drop policy if exists "user_data_insert" on public.user_data;
create policy "user_data_insert" on public.user_data for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user_data_update" on public.user_data;
create policy "user_data_update" on public.user_data for update to authenticated using (user_id = auth.uid());

-- ============ GLOBAL SONGS + RPCs (Discover) ============
create table if not exists public.global_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album text default '',
  year text default '',
  genres text[] default '{}',
  cover_art text default '',
  preview_url text default '',
  explicit boolean default false,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, artist)
);
alter table public.global_songs enable row level security;
drop policy if exists "global_songs_select" on public.global_songs;
create policy "global_songs_select" on public.global_songs for select to authenticated using (true);
drop policy if exists "global_songs_update" on public.global_songs;
create policy "global_songs_update" on public.global_songs for update to authenticated using (true);

create or replace function public.upsert_global_song(
  p_title text, p_artist text,
  p_album text default '', p_year text default '',
  p_genres text[] default '{}', p_cover_art text default '',
  p_preview_url text default '', p_explicit boolean default false,
  p_added_by uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.global_songs (title, artist, album, year, genres, cover_art, preview_url, explicit, added_by, created_at, updated_at)
  values (p_title, p_artist, p_album, p_year, p_genres, p_cover_art, p_preview_url, p_explicit, p_added_by, now(), now())
  on conflict (title, artist) do update set
    album = coalesce(nullif(p_album, ''), global_songs.album),
    year = coalesce(nullif(p_year, ''), global_songs.year),
    genres = case when array_length(p_genres, 1) > 0 then p_genres else global_songs.genres end,
    cover_art = coalesce(nullif(p_cover_art, ''), global_songs.cover_art),
    preview_url = coalesce(nullif(p_preview_url, ''), global_songs.preview_url),
    explicit = p_explicit,
    updated_at = now();
end;
$$;
grant execute on function public.upsert_global_song(text,text,text,text,text[],text,text,boolean,uuid) to authenticated;

create or replace function public.search_global_songs(search_term text, result_limit int default 25)
returns setof public.global_songs language sql stable security definer set search_path = public as $$
  select * from public.global_songs
  where title ilike '%' || search_term || '%'
     or artist ilike '%' || search_term || '%'
     or coalesce(genres, '{}') && array[search_term]
  order by created_at desc
  limit result_limit;
$$;
grant execute on function public.search_global_songs(text,int) to authenticated;

-- ============ SONG DATABASE (deezer/enrich cache) ============
create table if not exists public.song_database (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  album text default '',
  year text default '',
  genres text[] default '{}',
  explicit boolean default false,
  cover_art text,
  source text default 'user',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (title, artist)
);
alter table public.song_database enable row level security;
drop policy if exists "song_database_select" on public.song_database;
create policy "song_database_select" on public.song_database for select to authenticated using (true);
drop policy if exists "song_database_insert" on public.song_database;
create policy "song_database_insert" on public.song_database for insert to authenticated with check (added_by = auth.uid());

-- ============ SONG OF THE DAY ============
create table if not exists public.song_of_the_day (
  song_date date primary key,
  song jsonb not null,
  picked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.song_of_the_day enable row level security;
drop policy if exists "sotd_select" on public.song_of_the_day;
create policy "sotd_select" on public.song_of_the_day for select to authenticated using (true);
drop policy if exists "sotd_insert" on public.song_of_the_day;
create policy "sotd_insert" on public.song_of_the_day for insert to authenticated with check (true);
drop policy if exists "sotd_update" on public.song_of_the_day;
create policy "sotd_update" on public.song_of_the_day for update to authenticated using (true);

create table if not exists public.sotd_reactions (
  song_date date not null references public.song_of_the_day(song_date) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (song_date, user_id)
);
alter table public.sotd_reactions enable row level security;
drop policy if exists "sotdr_select" on public.sotd_reactions;
create policy "sotdr_select" on public.sotd_reactions for select to authenticated using (true);
drop policy if exists "sotdr_upsert" on public.sotd_reactions;
create policy "sotdr_upsert" on public.sotd_reactions for insert to authenticated with check (true);
drop policy if exists "sotdr_update" on public.sotd_reactions;
create policy "sotdr_update" on public.sotd_reactions for update to authenticated using (true);
drop policy if exists "sotdr_delete" on public.sotd_reactions;
create policy "sotdr_delete" on public.sotd_reactions for delete using (true);

-- ============ NOTIFICATIONS (realtime) ============
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'sotd_reaction',
  message text not null default '',
  payload jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert to authenticated with check (user_id <> auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid());
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
alter table public.notifications replica identity full;

-- ============ FEED REACTIONS ============
create table if not exists public.feed_reactions (
  id uuid primary key default gen_random_uuid(),
  song_owner_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null,
  reactor_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (song_owner_id, song_id, reactor_id)
);
alter table public.feed_reactions enable row level security;
drop policy if exists "feedr_select" on public.feed_reactions;
create policy "feedr_select" on public.feed_reactions for select to authenticated using (true);
drop policy if exists "feedr_insert" on public.feed_reactions;
create policy "feedr_insert" on public.feed_reactions for insert to authenticated with check (reactor_id = auth.uid());
drop policy if exists "feedr_delete" on public.feed_reactions;
create policy "feedr_delete" on public.feed_reactions for delete using (reactor_id = auth.uid());

-- ============ FRIENDS-ONLY MESSAGING ============
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text default '',
  song jsonb,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "messages_select_friends_only" on public.messages;
create policy "messages_select_friends_only" on public.messages for select
  to authenticated using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and exists (
      select 1 from public.friends f where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = (case when sender_id = auth.uid() then recipient_id else sender_id end))
          or (f.addressee_id = auth.uid() and f.requester_id = (case when sender_id = auth.uid() then recipient_id else sender_id end)))
    )
  );
drop policy if exists "messages_insert_friends_only" on public.messages;
create policy "messages_insert_friends_only" on public.messages for insert
  to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friends f where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recipient_id))
    )
  );

-- ============================================================================
--  After running this SQL also:
--   * Supabase dashboard > Authentication > Providers: enable Email.
--   * Supabase dashboard > Storage: create a PUBLIC bucket named `stickers`.
-- ============================================================================
