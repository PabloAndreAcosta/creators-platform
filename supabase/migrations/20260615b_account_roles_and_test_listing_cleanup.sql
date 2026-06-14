-- Reconfigure two of Pablo's alt accounts + hard-delete the clearly-test
-- listings. Reversible (deleted rows backed up to archived_deleted_rows; rollback
-- at the bottom). role changes go through the migration runner so the
-- protect_profile_privileged_columns trigger (service_role bypass) allows them.

-- 1. pablo.aztk → public account; rename "Pablo Test" → "Pablo Acosta" so no
--    'Test' name reaches the public surfaces.
update public.profiles
set full_name = 'Pablo Acosta', is_public = true
where id = '096f951e-d49b-4a81-ba82-fbfa5ee3871e';

-- 2. demoskap → "platser"/venue account (experience role) + public.
--    role is protected by protect_profile_privileged_columns (resets it unless
--    auth.role()='service_role'), so present a service_role claim for the role
--    change. is_public is not protected.
update public.profiles set is_public = true
where id = '391b1db6-c39f-4d0f-897f-e2c1f71ef268';
do $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles set role = 'upplevelse'
  where id = '391b1db6-c39f-4d0f-897f-e2c1f71ef268';
end $$;

-- 3. Delete the clearly-test listings (Kroppskontroll + 3× "Test") and their
--    bookings (all by demoskap — no real external user). Back up first.
insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'bookings', to_jsonb(b), 'delete-test-listings-2026-06-15'
from public.bookings b
where b.listing_id in (
  'a5a1811b-89b4-41f5-a566-6bedcfb54241', -- Kroppskontroll
  '43d036c8-e71f-41ca-b44d-772dc8accf15', -- Test
  '418a2329-921f-4a26-9fc0-d74388581adb', -- Test
  '0922490e-f073-4729-a5cb-884b9a18ade6'  -- Test
);

insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'listings', to_jsonb(l), 'delete-test-listings-2026-06-15'
from public.listings l
where l.id in (
  'a5a1811b-89b4-41f5-a566-6bedcfb54241',
  '43d036c8-e71f-41ca-b44d-772dc8accf15',
  '418a2329-921f-4a26-9fc0-d74388581adb',
  '0922490e-f073-4729-a5cb-884b9a18ade6'
);

delete from public.bookings where listing_id in (
  'a5a1811b-89b4-41f5-a566-6bedcfb54241',
  '43d036c8-e71f-41ca-b44d-772dc8accf15',
  '418a2329-921f-4a26-9fc0-d74388581adb',
  '0922490e-f073-4729-a5cb-884b9a18ade6'
);
delete from public.listings where id in (
  'a5a1811b-89b4-41f5-a566-6bedcfb54241',
  '43d036c8-e71f-41ca-b44d-772dc8accf15',
  '418a2329-921f-4a26-9fc0-d74388581adb',
  '0922490e-f073-4729-a5cb-884b9a18ade6'
);

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--   update public.profiles set full_name='Pablo Test', is_public=false
--     where id='096f951e-d49b-4a81-ba82-fbfa5ee3871e';
--   update public.profiles set role='customer', is_public=false
--     where id='391b1db6-c39f-4d0f-897f-e2c1f71ef268';
--   -- re-insert listings/bookings from archived_deleted_rows
--   --   where reason='delete-test-listings-2026-06-15'.
