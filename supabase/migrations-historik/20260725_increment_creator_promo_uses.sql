-- Atomic increment for creator promo code usage.
--
-- product-checkout previously did a read-modify-write on creator_promo_codes
-- (SELECT times_used → UPDATE times_used = value + 1), which loses updates under
-- concurrency: two simultaneous redemptions both read N and both write N+1, so
-- one use is never counted and max_uses can be exceeded. This function does the
-- increment in a single atomic UPDATE, guarded by max_uses so a code can never
-- be consumed past its limit.
--
-- Mirrors public.increment_promo_uses (platform promo_codes). Match its hardened
-- shape: SECURITY DEFINER + pinned search_path, execute revoked from anon/auth
-- (callers reach it via the service-role admin client only).

CREATE OR REPLACE FUNCTION public.increment_creator_promo_uses(p_code text)
RETURNS void AS $$
BEGIN
  UPDATE public.creator_promo_codes
  SET times_used = times_used + 1
  WHERE code = upper(btrim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR times_used < max_uses);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.increment_creator_promo_uses(text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.increment_creator_promo_uses(text) FROM anon, authenticated, PUBLIC;
