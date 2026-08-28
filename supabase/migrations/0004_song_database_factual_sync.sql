-- ============================================================================
--  bayoutonefm — factual song card fields for song_database
--  The live song_database table (created by songdb.html's setup SQL) stores
--  producer / songwriters / bpm / key / duration / record_label / track_number
--  / streaming_links, but has no explicit / release_date / artist_website.
--  Add them so every factual field on a song card can be stored, and make sure
--  authenticated users can update rows (some table origins only granted
--  insert/select). Idempotent: safe to run more than once.
-- ============================================================================

alter table public.song_database add column if not exists explicit boolean default false;
alter table public.song_database add column if not exists release_date text default '';
alter table public.song_database add column if not exists artist_website text default '';

drop policy if exists "song_database_update" on public.song_database;
create policy "song_database_update"
  on public.song_database
  for update
  using (auth.role() = 'authenticated');