-- ============ STICKERS STORAGE POLICIES ============
-- Shareable cataloguex cards and custom stickers upload to the `stickers`
-- bucket but storage.objects had no INSERT policy -> 403 RLS `AccessDenied`.
-- Also make the bucket public so card/sticker images load for everyone.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 52428800, null)
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "stickers-upload" on storage.objects;
create policy "stickers-upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stickers');

drop policy if exists "stickers-update" on storage.objects;
create policy "stickers-update" on storage.objects
  for update to authenticated
  with check (bucket_id = 'stickers');

drop policy if exists "stickers-delete" on storage.objects;
create policy "stickers-delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stickers');

drop policy if exists "stickers-read" on storage.objects;
create policy "stickers-read" on storage.objects
  for select to authenticated
  using (bucket_id = 'stickers');

drop policy if exists "stickers-public-read" on storage.objects;
create policy "stickers-public-read" on storage.objects
  for select to anon
  using (bucket_id = 'stickers');