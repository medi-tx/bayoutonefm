-- ============================================================================
--  bayoutonefm — add detailed song fields to global_songs + song_database
--  Idempotent: safe to run more than once.
-- ============================================================================

-- ============ ADD COLUMNS TO global_songs ============
alter table public.global_songs add column if not exists producers text default '';
alter table public.global_songs add column if not exists songwriters text default '';
alter table public.global_songs add column if not exists bpm integer;
alter table public.global_songs add column if not exists key text default '';
alter table public.global_songs add column if not exists duration text default '';
alter table public.global_songs add column if not exists record_label text default '';
alter table public.global_songs add column if not exists spotify_url text default '';
alter table public.global_songs add column if not exists apple_music_url text default '';
alter table public.global_songs add column if not exists youtube_music_url text default '';
alter table public.global_songs add column if not exists tidal_url text default '';
alter table public.global_songs add column if not exists release_date text default '';
alter table public.global_songs add column if not exists artist_website text default '';
alter table public.global_songs add column if not exists track_number text default '';

-- ============ ADD COLUMNS TO song_database ============
alter table public.song_database add column if not exists producers text default '';
alter table public.song_database add column if not exists songwriters text default '';
alter table public.song_database add column if not exists bpm integer;
alter table public.song_database add column if not exists key text default '';
alter table public.song_database add column if not exists duration text default '';
alter table public.song_database add column if not exists record_label text default '';
alter table public.song_database add column if not exists spotify_url text default '';
alter table public.song_database add column if not exists apple_music_url text default '';
alter table public.song_database add column if not exists youtube_music_url text default '';
alter table public.song_database add column if not exists tidal_url text default '';
alter table public.song_database add column if not exists release_date text default '';
alter table public.song_database add column if not exists artist_website text default '';
alter table public.song_database add column if not exists track_number text default '';

-- ============ UPDATED upsert_global_song RPC ============
create or replace function public.upsert_global_song(
  p_title text, p_artist text,
  p_album text default '', p_year text default '',
  p_genres text[] default '{}', p_cover_art text default '',
  p_preview_url text default '', p_explicit boolean default false,
  p_added_by uuid default null,
  p_producers text default '', p_songwriters text default '',
  p_bpm integer default null, p_key text default '',
  p_duration text default '', p_record_label text default '',
  p_spotify_url text default '', p_apple_music_url text default '',
  p_youtube_music_url text default '', p_tidal_url text default '',
  p_release_date text default '', p_artist_website text default '',
  p_track_number text default ''
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.global_songs (
    title, artist, album, year, genres, cover_art, preview_url, explicit, added_by,
    created_at, updated_at,
    producers, songwriters, bpm, key, duration, record_label,
    spotify_url, apple_music_url, youtube_music_url, tidal_url,
    release_date, artist_website, track_number
  )
  values (
    p_title, p_artist, p_album, p_year, p_genres, p_cover_art, p_preview_url, p_explicit, p_added_by,
    now(), now(),
    p_producers, p_songwriters, p_bpm, p_key, p_duration, p_record_label,
    p_spotify_url, p_apple_music_url, p_youtube_music_url, p_tidal_url,
    p_release_date, p_artist_website, p_track_number
  )
  on conflict (title, artist) do update set
    album = coalesce(nullif(p_album, ''), global_songs.album),
    year = coalesce(nullif(p_year, ''), global_songs.year),
    genres = case when array_length(p_genres, 1) > 0 then p_genres else global_songs.genres end,
    cover_art = coalesce(nullif(p_cover_art, ''), global_songs.cover_art),
    preview_url = coalesce(nullif(p_preview_url, ''), global_songs.preview_url),
    explicit = p_explicit,
    producers = coalesce(nullif(p_producers, ''), global_songs.producers),
    songwriters = coalesce(nullif(p_songwriters, ''), global_songs.songwriters),
    bpm = coalesce(p_bpm, global_songs.bpm),
    key = coalesce(nullif(p_key, ''), global_songs.key),
    duration = coalesce(nullif(p_duration, ''), global_songs.duration),
    record_label = coalesce(nullif(p_record_label, ''), global_songs.record_label),
    spotify_url = coalesce(nullif(p_spotify_url, ''), global_songs.spotify_url),
    apple_music_url = coalesce(nullif(p_apple_music_url, ''), global_songs.apple_music_url),
    youtube_music_url = coalesce(nullif(p_youtube_music_url, ''), global_songs.youtube_music_url),
    tidal_url = coalesce(nullif(p_tidal_url, ''), global_songs.tidal_url),
    release_date = coalesce(nullif(p_release_date, ''), global_songs.release_date),
    artist_website = coalesce(nullif(p_artist_website, ''), global_songs.artist_website),
    track_number = coalesce(nullif(p_track_number, ''), global_songs.track_number),
    updated_at = now();
end;
$$;
grant execute on function public.upsert_global_song(
  text,text,text,text,text[],text,text,boolean,uuid,
  text,text,integer,text,text,text,
  text,text,text,text,
  text,text,text
) to authenticated;
