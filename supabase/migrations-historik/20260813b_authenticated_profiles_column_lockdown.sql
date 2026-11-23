-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX (P0): stäng authenticated → andras känsliga profilfält, PÅ RIKTIGT.
--
-- Bakgrund: #178 och #189 försökte redan detta med enbart kolumn-REVOKE:
--     REVOKE SELECT (calendar_sync_token, is_admin, ...) ON profiles FROM authenticated;
-- Det är en TYST NO-OP så länge rollen har ett TABELL-brett SELECT-privilegium.
-- Postgres kolumn-revokar inte bort en tabell-grant; den bredare grant:en gäller
-- fortfarande. Verifierat mot produktion 2026-08-13: en vanlig inloggad användare
-- kunde fortfarande läsa alla publika profilers email, bankid_personal_number,
-- calendar_sync_token (bärartoken → /api/calendar/feed lämnar ut hela kalendern),
-- instagram_access_token, stripe_account_id och is_admin.
--
-- Rätt mönster är detsamma som #178 använde för anon och som bevisligen tog:
-- först REVOKE av tabell-grant:en, sedan GRANT på en explicit kolumn-allowlist.
-- Allowlisten är identisk med anons — inget fält som en inloggad användare får se
-- på någon annans rad är känsligt.
--
-- Egen rads känsliga fält läses inte längre med användarklienten: samtliga sådana
-- ställen är i samma PR flyttade till service-role efter en getUser()-ägarkontroll
-- (app/page, app/profile, dashboard/profile, dashboard/payouts, stripe/connect{,/status},
-- events/actions, events/open, my-collaborations) resp. till RPC (has_stripe_connect,
-- is_current_user_admin). Andras e-post i notismejl går också via service-role.
--
-- OBS: bara SELECT revokas. INSERT/UPDATE lämnas orörda — calendar_sync_token och
-- email SKRIVS av användarklienten (app/calendar/actions, api/calendar/rotate,
-- dashboard/profile/actions) och de skrivningarna måste fortsätta fungera.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

REVOKE SELECT ON public.profiles FROM authenticated;

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
) ON public.profiles TO authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verifiering efter körning (ska ge noll rader):
--   SELECT privilege_type FROM information_schema.table_privileges
--    WHERE table_schema='public' AND table_name='profiles'
--      AND grantee='authenticated' AND privilege_type='SELECT';
--
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_schema='public' AND table_name='profiles' AND grantee='authenticated'
--      AND privilege_type='SELECT'
--      AND column_name IN ('email','calendar_sync_token','is_admin','stripe_account_id',
--                          'bankid_personal_number','org_number','referral_code',
--                          'instagram_access_token');
--
-- KVARSTÅENDE (egen runda): rotera hemligheter som redan exponerats — den läckta
-- instagram_access_token samt samtliga calendar_sync_token — och droppa de döda
-- token-kolumnerna i profiles (paritet mot social_connections verifierad).
-- ─────────────────────────────────────────────────────────────────────────────
