-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX (stöd): släpp-funktion för reserverade rabattkods-användningar
--
-- Rabattkoder (event_access_codes med discount_price) validerades bara (read) vid
-- checkout-skapande och förbrukades först i webhooken vid betalning. En kod med
-- max_uses=1 kunde därför lösas in obegränsat: N parallella anrop passerade alla
-- validate-only-kontrollen innan någon betalning consumade koden → N rabatterade
-- biljetter på en engångskod.
--
-- Fixen (i app-koden) reserverar en användning atomiskt vid checkout-skapande via
-- den befintliga redeem_access_code() (used_count++ med max_uses-guard). Denna
-- funktion släpper reservationen om checkouten löper ut, avbryts eller om Stripe-
-- anropet misslyckas. Endast service_role (webhook/route).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_access_code(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.event_access_codes
  SET used_count = greatest(used_count - 1, 0)
  WHERE id = p_id;
$$;

REVOKE EXECUTE ON FUNCTION public.release_access_code(uuid) FROM public, anon, authenticated;
