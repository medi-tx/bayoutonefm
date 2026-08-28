-- Publish messages to realtime so recipients get live updates without polling.
-- Idempotent / additive: safe to re-run on db push.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
alter table public.messages replica identity full;