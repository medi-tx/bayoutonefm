-- ============ CERTIFIED TESTERS ============
-- Marks an account as a certified tester. Owners flip this via SQL, e.g.
--   update public.profiles set certified_tester = true where username in ('alice','bob');
alter table public.profiles add column if not exists certified_tester boolean not null default false;

-- add column if not exists, then backfill false in case the column pre-exists defaultless
update public.profiles set certified_tester = false where certified_tester is null;