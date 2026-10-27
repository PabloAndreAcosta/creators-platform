-- Skuggrader för lön: vad ett slutfört uppdrag HADE gett om kreatören
-- anställts av Usha, räknat både i egen regi och via SAMekonomi.
--
-- Ingen pengar rör sig på grund av en rad här. Tabellen finns för att
-- skuggkörningen ska kunna jämföras mot verkliga uppdrag och, när lönen går
-- skarpt, mot verkliga lönebesked. En rad per bokning (unik), så att samma
-- uppdrag aldrig räknas två gånger.
--
-- Bara service-rollen skriver och läser. Ingen policy för användare: det här
-- är ett internt underlag, inte en lönespecifikation.

create table if not exists public.payroll_shadow_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  pass_date date not null,
  paid_on date not null,
  price_ore integer not null check (price_ore >= 0),
  vat_ore integer not null check (vat_ore >= 0),
  commission_ore integer not null check (commission_ore >= 0),
  labour_budget_ore integer not null check (labour_budget_ore >= 0),
  gross_ore integer not null check (gross_ore >= 0),
  holiday_pay_ore integer not null check (holiday_pay_ore >= 0),
  employer_fee_ore integer not null check (employer_fee_ore >= 0),
  fee_basis text not null check (fee_basis in ('full','senior','none','youth')),
  withholding_ore integer not null check (withholding_ore >= 0),
  net_ore integer not null check (net_ore >= 0),
  rounding_rest_ore integer not null check (rounding_rest_ore >= 0),
  sam_fee_ore integer not null check (sam_fee_ore >= 0),
  sam_net_ore integer not null check (sam_net_ore >= 0),
  estimated boolean not null,
  created_at timestamptz not null default now(),
  constraint payroll_shadow_sums check (
    vat_ore + commission_ore + gross_ore + employer_fee_ore + rounding_rest_ore = price_ore
  )
);

create index if not exists idx_payroll_shadow_lines_creator on public.payroll_shadow_lines (creator_id, paid_on);

alter table public.payroll_shadow_lines enable row level security;
revoke all on public.payroll_shadow_lines from anon, authenticated;
