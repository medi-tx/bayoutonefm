-- mus$icmaker Supabase setup
-- Run this in your Supabase project's SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  time_ms bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.beats (
  id bigint generated always as identity primary key,
  owner uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  pattern jsonb not null,
  bpm int not null,
  root text not null,
  scale text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lyrics (
  id bigint generated always as identity primary key,
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  text text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.beat_shares (
  beat_id bigint not null references public.beats(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (beat_id, shared_with)
);

create table if not exists public.lyric_shares (
  lyric_id bigint not null references public.lyrics(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lyric_id, shared_with)
);

create table if not exists public.friend_requests (
  "from" uuid not null references public.profiles(id) on delete cascade,
  "to" uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  primary key ("from", "to"),
  check ("from" <> "to")
);

create or replace view public.users_public as
  select id, username, created_at from public.profiles;
grant select on public.users_public to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.beats enable row level security;
alter table public.lyrics enable row level security;
alter table public.beat_shares enable row level security;
alter table public.lyric_shares enable row level security;
alter table public.friend_requests enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "beats_select" on public.beats for select to authenticated
  using (owner = auth.uid() or exists(select 1 from public.beat_shares bs where bs.beat_id = beats.id and bs.shared_with = auth.uid()));
create policy "beats_insert_own" on public.beats for insert to authenticated with check (owner = auth.uid());
create policy "beats_update_own" on public.beats for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "beats_delete_own" on public.beats for delete to authenticated using (owner = auth.uid());

create policy "lyrics_select" on public.lyrics for select to authenticated
  using (owner = auth.uid() or exists(select 1 from public.lyric_shares ls where ls.lyric_id = lyrics.id and ls.shared_with = auth.uid()));
create policy "lyrics_insert_own" on public.lyrics for insert to authenticated with check (owner = auth.uid());
create policy "lyrics_update_own" on public.lyrics for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "lyrics_delete_own" on public.lyrics for delete to authenticated using (owner = auth.uid());

create policy "beat_shares_select" on public.beat_shares for select to authenticated
  using (shared_with = auth.uid() or shared_by = auth.uid());
create policy "beat_shares_insert" on public.beat_shares for insert to authenticated
  with check (shared_by = auth.uid() and exists(select 1 from public.beats b where b.id = beat_id and b.owner = auth.uid()));
create policy "beat_shares_delete" on public.beat_shares for delete to authenticated
  using (shared_with = auth.uid() or shared_by = auth.uid());

create policy "lyric_shares_select" on public.lyric_shares for select to authenticated
  using (shared_with = auth.uid() or shared_by = auth.uid());
create policy "lyric_shares_insert" on public.lyric_shares for insert to authenticated
  with check (shared_by = auth.uid() and exists(select 1 from public.lyrics l where l.id = lyric_id and l.owner = auth.uid()));
create policy "lyric_shares_delete" on public.lyric_shares for delete to authenticated
  using (shared_with = auth.uid() or shared_by = auth.uid());

create policy "fr_select" on public.friend_requests for select to authenticated
  using ("from" = auth.uid() or "to" = auth.uid());
create policy "fr_insert" on public.friend_requests for insert to authenticated
  with check ("from" = auth.uid() and "to" <> auth.uid());
create policy "fr_update" on public.friend_requests for update to authenticated
  using ("to" = auth.uid()) with check ("to" = auth.uid());
create policy "fr_delete" on public.friend_requests for delete to authenticated
  using ("from" = auth.uid() or "to" = auth.uid());

create or replace function public.increment_time(delta bigint)
returns void language sql security definer as $$
  update public.profiles set time_ms = coalesce(time_ms, 0) + delta where id = auth.uid();
$$;
grant execute on function public.increment_time(bigint) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username')
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();