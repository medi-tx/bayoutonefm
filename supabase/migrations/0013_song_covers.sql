-- ============ PER-SONG COVER ART (survives large-library syncs) ============
-- The user_data row has to stay small enough to submit in one request, so on
-- large libraries doSync strips cover art from the songs payload to fit.
-- Covers are kept here keyed by song id so they can be reattached on load and
-- never vanish between sessions.
--
-- Access: cover art belongs to the user who added the song.

create table if not exists public.song_covers (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null,
  cover_art text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
alter table public.song_covers enable row level security;

drop policy if exists "song_covers_select_own" on public.song_covers;
create policy "song_covers_select_own" on public.song_covers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "song_covers_insert_own" on public.song_covers;
create policy "song_covers_insert_own" on public.song_covers
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "song_covers_update_own" on public.song_covers;
create policy "song_covers_update_own" on public.song_covers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "song_covers_delete_own" on public.song_covers;
create policy "song_covers_delete_own" on public.song_covers
  for delete to authenticated using (user_id = auth.uid());