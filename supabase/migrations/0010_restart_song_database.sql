-- ============================================================================
--  bayoutonefm — start the song database over
--  Wipes the collaborative song data so it can be rebuilt fresh from every
--  user's local collection. Truncating global_songs also removes any leftover
--  duplicate (title, artist) groups, so the unique index the upsert RPC relies
--  on can be created here idempotently.
-- ============================================================================

truncate table public.song_database restart identity;
truncate table public.global_songs restart identity;

create unique index if not exists global_songs_title_artist_key on public.global_songs (title, artist);