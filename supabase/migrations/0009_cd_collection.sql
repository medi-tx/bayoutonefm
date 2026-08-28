-- ============ CD COLLECTION (certified testers only) ============
-- A personal shelf of physically-owned CDs. Certified testers scan the
-- barcode on the CD case (or type the number), the app looks the album
-- up on MusicBrainz + adds Deezer stream links, and it is saved here so
-- it is always available on their device.
--
-- Access is gated to certified testers at the database level: inserts and
-- updates require the account to have profiles.certified_tester = true.

create table if not exists public.cd_collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text not null default '',
  title text not null default '',
  artist text not null default '',
  year text default '',
  label text default '',
  country text default '',
  cover_art text default '',
  genres text[] default '{}',
  tracklist jsonb not null default '[]'::jsonb,
  mb_id text default '',
  stream_urls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, barcode)
);
alter table public.cd_collection enable row level security;

drop policy if exists "cd_collection_select_own" on public.cd_collection;
create policy "cd_collection_select_own" on public.cd_collection
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "cd_collection_insert_tester_only" on public.cd_collection;
create policy "cd_collection_insert_tester_only" on public.cd_collection
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.certified_tester = true)
  );

drop policy if exists "cd_collection_update_tester_only" on public.cd_collection;
create policy "cd_collection_update_tester_only" on public.cd_collection
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.certified_tester = true)
  );

drop policy if exists "cd_collection_delete_own" on public.cd_collection;
create policy "cd_collection_delete_own" on public.cd_collection
  for delete to authenticated using (user_id = auth.uid());