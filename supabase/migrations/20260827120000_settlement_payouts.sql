-- Automatisk utbetalning av partnerns andel efter att kvällen ägt rum.
--
-- Utbetalningen sker som en separat Stripe-överföring och inte som en delning
-- vid köptillfället. Skälet är att Usha är säljare mot biljettköparen — hela
-- intäkten är Ushas omsättning och partnerns andel en kostnad — och att
-- underlaget inte är känt förrän kvällen är över och återbetalningarna landat.

alter table public.event_revenue_shares
  add column if not exists payout_delay_days integer not null default 1
    check (payout_delay_days between 0 and 30);

comment on column public.event_revenue_shares.payout_delay_days is
  'Antal hela dagar efter evenemangsdatum innan utbetalningen görs. 1 = dagen efter.';

-- En rad per kväll och utbetalning. Tabellens viktigaste egenskap är UNIQUE på
-- listing_id: en kväll kan betalas ut högst en gång, oavsett hur många gånger
-- cronjobbet råkar köra eller köra om. Raden skapas FÖRE överföringen och blir
-- därmed det lås som gör dubbelbetalning omöjlig.
create table if not exists public.event_settlement_payouts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete restrict,
  partner_profile_id uuid not null references public.profiles(id) on delete restrict,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'dry_run', 'skipped')),

  -- Beloppet som förs över, i öre.
  amount_ore integer not null check (amount_ore >= 0),

  -- Underlaget som beloppet räknades fram ur, fruset vid utbetalningstillfället.
  -- Sparas för att en utbetalning måste gå att förklara i efterhand även om
  -- bokningarna ändras senare — en sen återbetalning får inte skriva om
  -- historien om vad som faktiskt betalades ut och varför.
  gross_ore integer not null,
  refunded_ore integer not null,
  vat_ore integer not null,
  basis_ore integer not null,
  partner_percent integer not null,
  vat_rate numeric(4,3) not null,

  stripe_transfer_id text unique,
  error text,

  created_at timestamptz not null default now(),
  paid_at timestamptz
);

comment on table public.event_settlement_payouts is
  'Utbetalning av partnerns andel per kväll. UNIQUE(listing_id) hindrar dubbelbetalning.';

create index if not exists event_settlement_payouts_status_idx
  on public.event_settlement_payouts(status);
create index if not exists event_settlement_payouts_partner_idx
  on public.event_settlement_payouts(partner_profile_id);

alter table public.event_settlement_payouts enable row level security;

-- Ingen INSERT- eller UPDATE-policy: rader skapas bara av cronjobbet via
-- service_role, som går förbi RLS. Att låta en inloggad användare skriva här
-- vore att låta den beordra en utbetalning.
create policy "Arrangören ser sina utbetalningar"
  on public.event_settlement_payouts for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = event_settlement_payouts.listing_id and l.user_id = auth.uid()
    )
  );

create policy "Partnern ser sina utbetalningar"
  on public.event_settlement_payouts for select
  using (partner_profile_id = auth.uid());
