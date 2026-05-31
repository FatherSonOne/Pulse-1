-- Harden SECURITY DEFINER functions against search_path hijacking (Supabase
-- advisor 0011 "function_search_path_mutable"). A definer function with a
-- mutable search_path can be tricked into resolving an unqualified name against
-- an attacker-controlled schema (especially pg_temp, searched first by default),
-- executing their code with the function owner's privileges.
--
-- Pin to `public, extensions, pg_temp`:
--   * public      — unqualified app tables + pg_trgm/vector resolve as before
--   * extensions  — unqualified pgcrypto/uuid-ossp (e.g. generate_api_key) resolve
--   * pg_temp last — can't shadow real objects, but temp tables still work
--
-- Verified before applying: every auth/net/vault reference in the affected
-- function bodies is schema-qualified (unaffected by path), and only
-- generate_api_key uses unqualified crypto (covered by `extensions`). Live-tested
-- is_handle_available / get_online_users_count / pgcrypto resolution afterward.
--
-- Idempotent: only targets public SECURITY DEFINER functions that don't already
-- have a search_path set. Reverse with: ALTER FUNCTION ... RESET search_path;
do $$
declare r record;
begin
  for r in
    select p.oid, n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, extensions, pg_temp',
      r.nspname, r.proname, r.args
    );
  end loop;
end $$;
