-- Reversible soft-archive of clearly-test data (no hard DELETEs).
--
-- Adds archive markers and flips the visibility flags that every public surface
-- (/marketplace, /upplevelser, /creators) and the sitemap already filter on
-- (listings.is_active, profiles.is_public). The rows therefore disappear from
-- all public surfaces and search indexing while staying fully intact in the DB.
-- Linked bookings/media/followers are left untouched (no orphaned rows); a later
-- hard-delete pass can follow after sign-off.
--
-- Scope (see docs/test-data-cleanup-report.md):
--   1 profile  : "Test Kreatör" (testgrupp@usha.se) — the only public test creator
--   8 listings : its 5 demo listings + 3 listings literally titled "Test"
--
-- Rollback is at the bottom of this file.

alter table public.profiles add column if not exists archived_at timestamptz;
alter table public.profiles add column if not exists archived_reason text;
alter table public.listings add column if not exists archived_at timestamptz;
alter table public.listings add column if not exists archived_reason text;

-- Profile: "Test Kreatör"
update public.profiles
set archived_at = now(), archived_reason = 'test-cleanup-2026-06-14', is_public = false
where id = '968dedcb-9037-43d1-83c6-1a35850c2727'
  and archived_at is null;

-- Listings: Test Kreatör's 5 demo listings + 3 literal "Test" listings
update public.listings
set archived_at = now(), archived_reason = 'test-cleanup-2026-06-14', is_active = false
where id in (
  '88eb2f19-27dc-4fd9-83dd-669f80ecf09a', -- Vinyasa Yoga - Morgonklass
  'b2e116aa-71a9-4cf7-be89-2f2773898d1b', -- Yin Yoga & Sound Healing
  'aa1e3ece-472b-401e-a6a9-29b1dc762703', -- Salsa Night - Social Dance Event
  '9cfc4af7-b44f-4f72-9c6d-3ada2703f31a', -- Meditation & Breathwork
  'adf1a5c8-00ee-4147-a4be-56a83e4be194', -- Contemporary Dance Workshop
  '0922490e-f073-4729-a5cb-884b9a18ade6', -- "Test" (music, 400 kr)
  '43d036c8-e71f-41ca-b44d-772dc8accf15', -- "Test" (dance, 2026-04-03)
  '418a2329-921f-4a26-9fc0-d74388581adb'  -- "Test" (dance, 2026-04-10)
)
  and archived_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually to fully reverse this migration). All archived rows
-- were is_public=true / is_active=true before, so restoring is unconditional
-- for rows tagged by this cleanup:
--
--   update public.profiles
--   set is_public = true, archived_at = null, archived_reason = null
--   where archived_reason = 'test-cleanup-2026-06-14';
--
--   update public.listings
--   set is_active = true, archived_at = null, archived_reason = null
--   where archived_reason = 'test-cleanup-2026-06-14';
-- ─────────────────────────────────────────────────────────────────────────
