-- ─────────────────────────────────────────────────────────────────────────────
-- P0 SÄKERHETSFIX: lås ned kolumnåtkomst på public.profiles
--
-- Bakgrund: policyn "Public profiles are viewable" USING (is_public = true) ger
-- SELECT på HELA raden. Eftersom anon-nyckeln ligger i webbläsarbundeln kunde vem
-- som helst köra
--   GET /rest/v1/profiles?select=*&is_public=eq.true
-- och få ut e-post, personnummer-hash (bankid_personal_number), calendar_sync_token
-- (bearer-token), stripe_account_id, is_admin, referral_code samt giltiga OAuth-
-- access-tokens. Verifierat mot produktion 2026-08-12.
--
-- RLS är radbaserad och kan inte begränsa kolumner. Fixen är därför kolumn-GRANTs:
-- PostgREST returnerar bara kolumner som rollen har SELECT-privilegium på.
--
-- Denna migration är REN (inga DROP COLUMN) och rör inte `authenticated`s tabell-
-- grant, så alla server-komponenter och API-routes som läser egen rad fungerar
-- oförändrat. Den enda publika (anon-renderade) sida som läste en exkluderad kolumn
-- var /creators/[id] (stripe_account_id, endast som boolean) — den ersätts av
-- funktionen public.has_stripe_connect() nedan + en app-patch i samma PR.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. ANON: dra in tabell-bred SELECT och ge tillbaka enbart en säker allowlist.
--    Allt som utelämnas nedan blir oläsbart för anon: email, bankid_personal_number,
--    calendar_sync_token, stripe_account_id, is_admin, referral_code, referred_by,
--    org_number, company_verification_method, bankid_grandfathered_at,
--    deleted_at/deleted_reason, archived_at/archived_reason, samt OAuth-access-tokens.
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id,
  full_name,
  avatar_url,
  bio,
  category,
  categories,
  location,
  locations,
  hourly_rate,
  rates,
  slug,
  role,
  tier,
  is_public,
  is_marketplace_verified,
  created_at,
  updated_at,
  -- verifieringsbadgar (bara tidsstämplar/namn, ej personnummer)
  bankid_verified_at,
  bankid_name,
  company_verified_at,
  company_name,
  -- avsiktligt publik kontakt (skild från login-email `email`)
  contact_email,
  contact_phone,
  -- publika länkar & handles (ej access-tokens)
  website,
  websites,
  social_instagram,
  social_x,
  social_facebook,
  instagram_username,
  instagram_user_id,
  facebook_page_id,
  facebook_page_name,
  tiktok_username,
  tiktok_user_id,
  -- kreatörsprofil
  creator_subcategory,
  dance_styles,
  dance_languages,
  dance_experience_years,
  offers_coaching,
  coaching_hourly_rate_sek,
  coaching_specialties,
  coaching_bio,
  -- whitelabel-branding (publik)
  whitelabel_enabled,
  whitelabel_brand_name,
  whitelabel_logo_url,
  whitelabel_primary_color,
  whitelabel_accent_color,
  whitelabel_accent_color_2,
  whitelabel_accent_color_3
) ON public.profiles TO anon;

-- 2. AUTHENTICATED: dra in de kolumner som ALDRIG läses av en användar-klient
--    (varken egen eller annans rad) — de rörs bara av service-role i API-routes.
--    bankid_personal_number: läses bara vid server-side dedup (service-role).
--    OAuth-access-tokens: appen läser dem numera enbart från social_connections
--    (verifierat: inga profiles-läsningar av dessa i src/). Detta stoppar även en
--    inloggad användare från att läsa andras personnummer-hash/tokens på publika rader.
REVOKE SELECT (
  bankid_personal_number,
  instagram_access_token,
  tiktok_access_token,
  tiktok_refresh_token,
  facebook_page_access_token
) ON public.profiles FROM authenticated;

-- 3. Ersätt anon-läsning av stripe_account_id med en boolean-funktion.
--    /creators/[id] behövde bara veta OM kreatören har ett Connect-konto.
CREATE OR REPLACE FUNCTION public.has_stripe_connect(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_id
      AND p.is_public = true
      AND p.stripe_account_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.has_stripe_connect(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_stripe_connect(uuid) TO anon, authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- KVARSTÅENDE (medvetet UTANFÖR denna migration, kräver separat beslut/verifiering):
--
--  a) `authenticated` kan fortfarande läsa email, contact_phone, calendar_sync_token,
--     is_admin m.fl. på ANDRAS publika rader (policyn är inte roll-scopad, och dessa
--     kolumner läses för EGEN rad via användar-klienten så de kan inte kolumn-revokas
--     globalt). Korrekt fix: en `public_profiles`-vy eller RPC för egen känslig data +
--     radpolicy USING (auth.uid() = id). Kräver omskrivning av flera queries → egen PR.
--
--  b) Fysisk DROP av de döda kolumnerna profiles.instagram_access_token,
--     tiktok_access_token, tiktok_refresh_token, facebook_page_access_token gjordes
--     INTE här — paritet mot social_connections kunde inte verifieras utan service-role.
--     Kör efter verifiering:
--       -- säkerställ paritet först:
--       -- SELECT count(*) FROM profiles p WHERE p.instagram_access_token IS NOT NULL
--       --   AND NOT EXISTS (SELECT 1 FROM social_connections s
--       --   WHERE s.user_id = p.id AND s.instagram_access_token IS NOT NULL);
--       ALTER TABLE public.profiles
--         DROP COLUMN instagram_access_token,
--         DROP COLUMN tiktok_access_token,
--         DROP COLUMN tiktok_refresh_token,
--         DROP COLUMN facebook_page_access_token;
--
--  c) MANUELLT (kan inte göras i SQL): rotera hemligheter som redan exponerats —
--     den läckta instagram_access_token samt alla calendar_sync_token
--     (POST /api/calendar/rotate per användare, eller UPDATE ... = gen_random_uuid()).
-- ─────────────────────────────────────────────────────────────────────────────
