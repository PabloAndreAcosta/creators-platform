-- Reversible soft-archive of all remaining non–"The Kiz Lab" listings.
--
-- Policy (2026-06-14): keep ALL accounts (no profile changes), but only The Kiz
-- Lab is a current event — archive every other active listing. Same reversible
-- mechanism as 20260614_archive_test_data (flips is_active + archive markers;
-- bookings left intact). Rollback at the bottom.
--
-- Archives 4 listings (Kroppskontroll, Practica, Privat danslektion, Värdskap);
-- keeps the 4 "The Kiz Lab" listings active.

update public.listings
set archived_at = now(), archived_reason = 'only-kizlab-2026-06-14', is_active = false
where id in (
  'a5a1811b-89b4-41f5-a566-6bedcfb54241', -- Kroppskontroll
  'abc3ee4c-3b91-4dbc-8db2-87963bc39f3b', -- Practica
  '950a2e9c-14f9-4c21-a555-c16b65d603ad', -- Privat danslektion
  '16f45fc1-343f-4f68-94ff-9233ae22e77d'  -- Värdskap
)
  and archived_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK:
--   update public.listings
--   set is_active = true, archived_at = null, archived_reason = null
--   where archived_reason = 'only-kizlab-2026-06-14';
-- ─────────────────────────────────────────────────────────────────────────
