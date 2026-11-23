-- Set immutable search_path on mutable SECURITY DEFINER functions.
-- Prevents schema-shadowing privilege escalation.
ALTER FUNCTION public.award_points(uuid, text, integer, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_creator_commission(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_promo_uses(uuid) SET search_path = public, pg_temp;

-- Revoke EXECUTE from anon and authenticated on functions that should only
-- run server-side via service_role (or via triggers).
-- handle_new_user runs as a trigger on auth.users — trigger context is unaffected.
-- award_points, increment_promo_uses, get_creator_commission should only be
-- invoked by server code; revoking direct REST callability prevents anon abuse.
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, integer, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_promo_uses(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- get_creator_commission is read-only and used by client code to display
-- commission rates. Keep authenticated EXECUTE but revoke anon.
REVOKE EXECUTE ON FUNCTION public.get_creator_commission(uuid) FROM anon, PUBLIC;

-- is_bankid_cleared is used by RLS policies — must be callable by authenticated
-- in policy context. Already has search_path set. Belt-and-suspenders: ensure
-- PUBLIC and anon do not have it.
REVOKE EXECUTE ON FUNCTION public.is_bankid_cleared(uuid) FROM anon, PUBLIC;
