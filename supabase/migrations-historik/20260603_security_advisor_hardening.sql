-- Security-advisor hardening (Supabase database linter), 2026-06-03.
--
-- 1) Pin search_path on the three functions the linter flagged as
--    "function_search_path_mutable". Prevents a malicious search_path from
--    resolving unqualified object references inside the function body.
ALTER FUNCTION public.min_rate(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_openclaw_tasks_updated_at() SET search_path = public, pg_temp;

-- 2) These two SECURITY DEFINER functions are TRIGGER functions only — they are
--    never meant to be invoked directly through the REST `/rest/v1/rpc` endpoint.
--    Triggers fire as part of the table DML regardless of the caller's EXECUTE
--    privilege, so revoking EXECUTE here removes the public RPC surface without
--    affecting the triggers. (Linter: anon/authenticated_security_definer_function_executable)
--
--    NOTE: is_bankid_cleared(uuid) and get_creator_commission(uuid) are
--    intentionally LEFT executable — the former is called inside RLS policies
--    (anon + authenticated need it, see 20260522_grant_anon_is_bankid_cleared.sql)
--    and the latter is read-only and used by client code to display commission.
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_bankid_for_public_creator() FROM PUBLIC, anon, authenticated;
