-- Hard-delete the "Test Kreatör" test account (id 968dedcb…, testgrupp@usha.se)
-- and the broken duplicate "The Kiz Lab" listing (8d1e2773…), per explicit
-- request. Reversible: every deleted row is first copied (as jsonb) into
-- public.archived_deleted_rows. No other accounts are touched.
--
-- Footprint verified before writing this migration: the test account has only
-- 1 profile + 5 listings + 7 bookings (all self / "Pablo Test" alt — no real
-- external user, no reviews/posts/follows/payments/subscriptions/collaborators).
-- The duplicate listing has 0 bookings. (The single real Stripe payment was a
-- test purchase under the "Pablo Test" account, which is kept.)

create table if not exists public.archived_deleted_rows (
  id bigserial primary key,
  table_name text not null,
  row_data jsonb not null,
  reason text,
  deleted_at timestamptz not null default now()
);
alter table public.archived_deleted_rows enable row level security; -- service_role only

-- ── Backup ───────────────────────────────────────────────────────────────
insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'bookings', to_jsonb(b), 'delete-test-account-2026-06-14'
from public.bookings b
where b.creator_id = '968dedcb-9037-43d1-83c6-1a35850c2727'
   or b.customer_id = '968dedcb-9037-43d1-83c6-1a35850c2727'
   or b.listing_id in (select id from public.listings where user_id = '968dedcb-9037-43d1-83c6-1a35850c2727');

insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'listings', to_jsonb(l), 'delete-test-account-2026-06-14'
from public.listings l where l.user_id = '968dedcb-9037-43d1-83c6-1a35850c2727';

insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'listings', to_jsonb(l), 'delete-kizlab-duplicate-2026-06-14'
from public.listings l where l.id = '8d1e2773-0211-4120-a24c-c2a93283b115';

insert into public.archived_deleted_rows (table_name, row_data, reason)
select 'profiles', to_jsonb(p), 'delete-test-account-2026-06-14'
from public.profiles p where p.id = '968dedcb-9037-43d1-83c6-1a35850c2727';

-- ── Delete (FK-safe order) ─────────────────────────────────────────────────
delete from public.bookings
where creator_id = '968dedcb-9037-43d1-83c6-1a35850c2727'
   or customer_id = '968dedcb-9037-43d1-83c6-1a35850c2727'
   or listing_id in (select id from public.listings where user_id = '968dedcb-9037-43d1-83c6-1a35850c2727');

delete from public.listings where user_id = '968dedcb-9037-43d1-83c6-1a35850c2727';
delete from public.listings where id = '8d1e2773-0211-4120-a24c-c2a93283b115';

-- Removes the auth login and cascades public.profiles (FK ON DELETE CASCADE).
delete from auth.users where id = '968dedcb-9037-43d1-83c6-1a35850c2727';

-- ── ROLLBACK (manual) ──────────────────────────────────────────────────────
-- Rows are preserved in public.archived_deleted_rows. To restore, re-insert
-- from the jsonb (auth.users login must be recreated separately — test account):
--   insert into public.profiles select * from jsonb_populate_record(null::public.profiles, row_data) ...
--   (filter archived_deleted_rows by reason). Listings/bookings likewise.
