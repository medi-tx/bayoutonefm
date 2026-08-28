-- ============================================================================
--  bayoutonefm — align global_songs with the upsert_global_song RPC
--  The live global_songs table was created before migration 0001, so it is
--  missing updated_at and (most likely) the unique (title, artist) index the
--  RPC's ON CONFLICT requires, plus a default for its bigint id. Align it
--  idempotently. If duplicate (title, artist) rows already exist, the unique
--  index is skipped with a notice so it can be deduped first.
-- ============================================================================

alter table public.global_songs add column if not exists updated_at timestamptz not null default now();

do $$
declare
  dup_groups   int;
  has_unique   boolean;
  id_default   text;
  seq_name     text;
begin
  select count(*) into dup_groups
  from (
    select lower(trim(title)) || '|||' || lower(trim(artist)) as k
    from public.global_songs
    group by 1 having count(*) > 1
  ) d;

  select exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.global_songs'::regclass
      and i.indisunique
      and i.indnkeyatts = 2
      and i.indkey::smallint[] @> (
        select array_agg(a.attnum::smallint)
        from pg_attribute a
        where a.attrelid = 'public.global_songs'::regclass
          and a.attname in ('title', 'artist')
          and not a.attisdropped
      )
  ) into has_unique;

  if has_unique then
    raise notice 'global_songs: unique (title, artist) index already exists';
  elsif dup_groups = 0 then
    create unique index global_songs_title_artist_key on public.global_songs (title, artist);
    raise notice 'global_songs: created unique (title, artist) index';
  else
    raise notice 'global_songs: % duplicate (title, artist) groups present - dedupe before adding the unique index', dup_groups;
  end if;

  select column_default into id_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'global_songs' and column_name = 'id';

  if id_default is null then
    seq_name := 'global_songs_id_seq';
    if not exists (select 1 from pg_class where relname = 'global_songs_id_seq') then
      execute 'create sequence public.global_songs_id_seq';
    end if;
    execute 'alter table public.global_songs alter column id set default nextval(''public.global_songs_id_seq'')';
    raise notice 'global_songs: set id default to global_songs_id_seq';
  end if;
end $$;