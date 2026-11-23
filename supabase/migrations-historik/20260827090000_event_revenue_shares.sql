-- Delning av biljettintäkt med en samarbetspartner, per evenemang.
--
-- Bakgrund: en kväll kan arrangeras tillsammans med en lokal som tar en andel
-- av biljettintäkten (Bacchi Syre, måndagar från 7 september). Usha är säljare
-- mot köparen — hela beloppet är Ushas omsättning — och partnerns andel är en
-- kostnad som förs över efter att kvällen ägt rum.
--
-- Egen tabell i stället för kolumner på listings, av tre skäl. De allra flesta
-- evenemang har ingen partner, så kolumnerna hade stått tomma på nästan varje
-- rad. Villkoren ska kunna läsas av partnern utan att den får läsa hela
-- evenemanget. Och när överföringarna byggs behöver de något att hänga i, och
-- det ska vara raden som beskriver överenskommelsen.
--
-- Ett evenemang har högst en partner: unique på listing_id. Fler parter är inte
-- ett behov som finns, och att låtsas annat hade gjort avrundningen svårare.

create table if not exists public.event_revenue_shares (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,

  -- Partnerns konto på plattformen. Måste finnas innan en krona kan föras
  -- över — betalningsgrinden kräver verifierat bolag, och utbetalningen kräver
  -- ett Stripe-konto som partnern själv äger.
  partner_profile_id uuid not null references public.profiles(id) on delete restrict,

  -- Partnerns andel av underlaget, i procent. Heltal: halva procent är inget
  -- avtal någon skriver, och det hade bara gjort avrundningen otydligare.
  partner_percent integer not null check (partner_percent between 0 and 100),

  -- Momssats som decimal, t.ex. 0.25. Biljettpriser anges inklusive moms, så
  -- momsen räknas ur beloppet innan delningen och inte ovanpå.
  --
  -- Sparas per avtal och inte som en konstant i koden: vilken sats som gäller
  -- entré till dansevenemang ska bekräftas av revisor, och när svaret kommer
  -- får redan avräknade kvällar inte räknas om i efterhand.
  vat_rate numeric(4,3) not null default 0.25 check (vat_rate >= 0 and vat_rate < 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.event_revenue_shares is
  'Avtalad intäktsdelning mellan arrangör och samarbetspartner för ett evenemang.';

create index if not exists event_revenue_shares_partner_idx
  on public.event_revenue_shares(partner_profile_id);

alter table public.event_revenue_shares enable row level security;

-- Arrangören äger villkoren och är den enda som får ändra dem. Kontrollen går
-- via listings.user_id, så ett ägarbyte på evenemanget följer med automatiskt.
create policy "Arrangören hanterar delningen"
  on public.event_revenue_shares for all
  using (
    exists (
      select 1 from public.listings l
      where l.id = event_revenue_shares.listing_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = event_revenue_shares.listing_id and l.user_id = auth.uid()
    )
  );

-- Partnern får läsa sina egna villkor, men inte ändra dem. Att kunna se vad man
-- kommit överens om är själva poängen med att villkoren ligger i systemet.
create policy "Partnern läser sin egen delning"
  on public.event_revenue_shares for select
  using (partner_profile_id = auth.uid());
