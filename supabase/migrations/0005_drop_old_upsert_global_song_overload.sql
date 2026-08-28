-- ============================================================================
--  bayoutonefm — remove ambiguous upsert_global_song overload
--  The live DB has BOTH the migration 0001 9-arg upsert_global_song and the
--  migration 0002 22-arg version. PostgREST cannot pick a candidate when named
--  args match multiple overloads, so every RPC call 400s with
--  "Could not choose the best candidate function between...".
--  Drop the old 9-arg overload: the 22-arg version has defaults for every
--  extra param, so both the client's full and base payloads resolve to it.
-- ============================================================================

drop function if exists public.upsert_global_song(
  text, text, text, text, text[], text, text, boolean, uuid
);