-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX: stäng authenticated → andras känsliga profilfält
--
-- #178 låste profiles för `anon` (kolumn-allowlist). Men `authenticated` hade
-- fortfarande bred tabell-SELECT, så en INLOGGAD användare kunde köra t.ex.
--   GET /rest/v1/profiles?select=calendar_sync_token,is_admin&is_public=eq.true
-- och läsa andra publika användares fält. Värst: calendar_sync_token är en
-- bärartoken → /api/calendar/feed lämnar då ut hela deras bokningskalender.
--
-- RLS är radbaserad och kan inte begränsa kolumner, så vi drar in dessa kolumner
-- för `authenticated` med kolumn-REVOKE. De läses bara för EGEN rad på ett fåtal
-- ställen, som i samma PR rerouteras till service-role (calendar, referral) resp.
-- till funktionen nedan (navigeringens admin-flagga).
--
-- Ej med här (medvetet): contact_phone/contact_email visas avsiktligt som publik
-- kreatörskontakt; `email` (login) har breda notis-läsare och tas i egen runda.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT (
  calendar_sync_token,
  is_admin,
  referral_code,
  referred_by
) ON public.profiles FROM authenticated;

-- Navigeringen (klientkomponent) behöver bara veta OM den inloggade är admin —
-- inte kunna läsa is_admin-kolumnen. SECURITY DEFINER så kolumnen förblir dold.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
