-- ============ UPDATES LOG (read by testers, written by samannleblanc) ============
-- A running log of what's currently being worked on so testers know the state
-- of each item. Certified testers can read it; only samannleblanc can post
-- entries or flip an entry's status.
--   status 'broken'  = ✕ not working
--   status 'fixing'  = ○ actively fixing
--   status 'working' = ✓ working

create or replace function public.is_updates_owner()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and username = 'samannleblanc'
  );
$$;

create table if not exists public.updates_log (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  status text not null default 'fixing' check (status in ('broken','fixing','working')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.updates_log enable row level security;

drop policy if exists "updates_log_select_tester_only" on public.updates_log;
create policy "updates_log_select_tester_only" on public.updates_log
  for select to authenticated
  using (
    public.is_updates_owner()
    or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.certified_tester = true)
  );

drop policy if exists "updates_log_insert_owner_only" on public.updates_log;
create policy "updates_log_insert_owner_only" on public.updates_log
  for insert to authenticated with check (public.is_updates_owner());

drop policy if exists "updates_log_update_owner_only" on public.updates_log;
create policy "updates_log_update_owner_only" on public.updates_log
  for update to authenticated using (public.is_updates_owner());

drop policy if exists "updates_log_delete_owner_only" on public.updates_log;
create policy "updates_log_delete_owner_only" on public.updates_log
  for delete to authenticated using (public.is_updates_owner());

-- keep updated_at current on any in-place edit (status flips)
create or replace function public.touch_updates_log_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists trg_updates_log_touch on public.updates_log;
create trigger trg_updates_log_touch
  before update on public.updates_log
  for each row execute function public.touch_updates_log_updated_at();

-- publish to realtime so open logs update without polling
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'updates_log'
  ) then
    execute 'alter publication supabase_realtime add table public.updates_log';
  end if;
end $$;
alter table public.updates_log replica identity full;