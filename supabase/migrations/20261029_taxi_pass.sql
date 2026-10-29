-- Taxipass: volontärpass som taxidansare på en kväll.
--
-- Arrangören lägger upp pass (minst 2 h, mellan 17 och 23) på en kväll.
-- Dansare anmäler sig till ett eller flera, checkar in och ut, och får en
-- matkupong (burgare + alkoholfri dryck) per kväll. Taxidansare är
-- volontärer — ingen lön. Reglerna bor i src/lib/taxi/rules.ts.
--
-- Allt läses och skrivs via servern efter behörighetskontroll (service-role),
-- så tabellerna har RLS påslaget utan policies: ingen direktåtkomst från
-- webbläsaren till andras anmälningar, samtycken eller närvaro.

create table if not exists public.taxi_shifts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 50),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint taxi_shift_min_two_hours check (ends_at - starts_at >= interval '2 hours')
);
create index if not exists idx_taxi_shifts_listing on public.taxi_shifts (listing_id, starts_at);

create table if not exists public.taxi_signups (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.taxi_shifts (id) on delete cascade,
  dancer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  cancelled_at timestamptz,
  late_cancel boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  photo_consent boolean not null,
  volunteer_ack_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (shift_id, dancer_id),
  constraint taxi_checkout_after_checkin check (checked_out_at is null or (checked_in_at is not null and checked_out_at >= checked_in_at))
);
create index if not exists idx_taxi_signups_dancer on public.taxi_signups (dancer_id);

-- En matkupong per dansare och kväll. Raden finns först när den lösts in.
create table if not exists public.taxi_vouchers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  dancer_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (listing_id, dancer_id)
);

alter table public.taxi_shifts enable row level security;
alter table public.taxi_signups enable row level security;
alter table public.taxi_vouchers enable row level security;
revoke all on public.taxi_shifts, public.taxi_signups, public.taxi_vouchers from anon, authenticated;
