-- Usha onboarding & payment domain (§5 of Usha_byggspec_onboarding.md).
--
-- Standalone, mock-stage module: NEW tables (prefixed `ob_`) that do NOT touch
-- the live profiles/bookings/payments tables. NOT YET APPLIED to the live
-- project — apply when ready. No real payments are wired (config.PAYMENTS_LIVE
-- is false); real money movement is gated on the §9 legal sign-off.

-- ── ob_users (§5 User) ───────────────────────────────────────────────────────
create table if not exists public.ob_users (
  id uuid primary key references auth.users (id) on delete cascade,
  bankid_verified boolean not null default false,
  name text,
  personal_no text,
  email text,
  phone text,
  tax_residence_country text,
  created_at timestamptz not null default now()
);

-- ── ob_creator_profiles (§5 CreatorProfile) ──────────────────────────────────
create table if not exists public.ob_creator_profiles (
  user_id uuid primary key references public.ob_users (id) on delete cascade,
  track text not null check (track in ('C1','C2','C3','C4')),
  org_no text,
  fskatt_status text not null default 'unknown' check (fskatt_status in ('active','inactive','unknown')),
  fskatt_checked_at timestamptz,
  vat_no text,
  stripe_account_id text,
  eor_worker_id text,
  bank_account text,
  updated_at timestamptz not null default now()
);

-- ── ob_venue_profiles (§5 VenueProfile) ──────────────────────────────────────
create table if not exists public.ob_venue_profiles (
  user_id uuid primary key references public.ob_users (id) on delete cascade,
  type text not null check (type in ('V1','V2','V3')),
  org_no text not null,
  vat_no text,
  billing_info text,
  po_reference text,
  updated_at timestamptz not null default now()
);

-- ── ob_track_changes (G5 history) ────────────────────────────────────────────
create table if not exists public.ob_track_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ob_users (id) on delete cascade,
  from_track text not null,
  to_track text not null,
  changed_at timestamptz not null default now()
);

-- ── ob_bookings (§5 Booking, §6 states) ──────────────────────────────────────
create table if not exists public.ob_bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.ob_users (id),
  creator_id uuid not null references public.ob_users (id),
  amount_gross integer not null check (amount_gross >= 0),
  commission integer not null check (commission >= 0),
  status text not null default 'requested'
    check (status in ('requested','accepted','in_escrow','completed','settled','disputed','cancelled','refunded')),
  vat_on_commission_only boolean not null default false, -- G6
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  -- G4: gross must never be credited to Usha; only commission is Usha revenue.
  constraint commission_not_exceeding_gross check (commission <= amount_gross)
);

-- ── ob_payouts (§5 Payout, §6 states) ────────────────────────────────────────
create table if not exists public.ob_payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.ob_bookings (id) on delete cascade,
  provider text not null check (provider in ('stripe','eor')),
  state text not null default 'pending'
    check (state in ('pending','held','released','paid','blocked','failed')),
  kind text not null default 'payout' check (kind in ('payout','expense_reimbursement')), -- G3
  gross integer not null default 0,
  tax integer not null default 0,
  fees integer not null default 0,
  commission integer not null default 0,
  net integer not null default 0,
  released_at timestamptz
);

-- ── ob_dac7_records (§5 Dac7Record, G7) ──────────────────────────────────────
create table if not exists public.ob_dac7_records (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.ob_users (id),
  quarter smallint not null check (quarter between 1 and 4),
  year smallint not null,
  consideration integer not null default 0,
  currency text not null default 'SEK',
  unique (seller_id, quarter, year)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Users manage their own onboarding rows. Money tables (bookings/payouts/dac7)
-- are read-only to the involved parties and mutated only by the service role
-- (server-side payout pipeline) — no client may move money (G4).
alter table public.ob_users enable row level security;
alter table public.ob_creator_profiles enable row level security;
alter table public.ob_venue_profiles enable row level security;
alter table public.ob_track_changes enable row level security;
alter table public.ob_bookings enable row level security;
alter table public.ob_payouts enable row level security;
alter table public.ob_dac7_records enable row level security;

create policy "own ob_user" on public.ob_users
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own ob_creator_profile" on public.ob_creator_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own ob_venue_profile" on public.ob_venue_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own ob_track_changes read" on public.ob_track_changes
  for select to authenticated using (user_id = auth.uid());

create policy "party can read ob_booking" on public.ob_bookings
  for select to authenticated using (venue_id = auth.uid() or creator_id = auth.uid());

create policy "party can read ob_payout" on public.ob_payouts
  for select to authenticated using (
    exists (
      select 1 from public.ob_bookings b
      where b.id = booking_id and (b.venue_id = auth.uid() or b.creator_id = auth.uid())
    )
  );

create policy "seller can read own ob_dac7" on public.ob_dac7_records
  for select to authenticated using (seller_id = auth.uid());
-- (no client INSERT/UPDATE/DELETE policy on bookings/payouts/dac7 → service role only)
