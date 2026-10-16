-- Kompletterande avräkning: efterbetalning för en kväll som redan reglerats.
--
-- event_settlement_payouts har UNIQUE(listing_id), och den begränsningen är
-- inget misstag — den är låset som hindrar att en kväll betalas ut två gånger
-- om jobbet råkar köra parallellt. Därför läggs kompletteringarna i en EGEN
-- tabell i stället för att låsa upp den.
--
-- En kväll kan behöva flera kompletteringar över tid (en sen betalning i dag,
-- ett efterregistrerat klipp i morgon), så nyckeln är (listing_id, seq).
-- Löpnumret ger också varje överföring en egen Stripe-grupp; delade de grupp
-- med ursprungsavräkningen skulle den hittas som "redan gjord".

create table if not exists public.event_settlement_supplements (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references public.listings(id) on delete cascade,
  partner_profile_id    uuid not null references public.profiles(id) on delete restrict,
  seq                   integer not null,
  status                text not null default 'pending'
                        check (status in ('pending','paid','failed','dry_run')),

  -- Mellanskillnaden som förs över nu.
  amount_ore            integer not null check (amount_ore > 0),
  -- Vad partnern SKA ha totalt för kvällen, och vad som redan gått iväg.
  -- Båda sparas så att en rad går att granska utan att räkna om något.
  due_ore               integer not null,
  previously_paid_ore   integer not null,

  -- Underlaget vid omräkningen, samma fält som ursprungsavräkningen bär.
  gross_ore             integer not null,
  refunded_ore          integer not null default 0,
  vat_ore               integer not null,
  basis_ore             integer not null,
  partner_percent       numeric not null,
  vat_rate              numeric not null,

  destination_account_id text,
  stripe_transfer_id     text,
  error                  text,
  created_at             timestamptz not null default now(),
  paid_at                timestamptz,

  unique (listing_id, seq)
);

comment on table public.event_settlement_supplements is
  'Efterbetalningar till partner för kvällar vars ursprungliga avräkning redan är betald. En rad per komplettering.';
comment on column public.event_settlement_supplements.amount_ore is
  'Mellanskillnaden som förs över. Alltid > 0 — en överbetalning rättas aldrig automatiskt.';
comment on column public.event_settlement_supplements.seq is
  'Löpnummer per kväll. Ger raden sin egen Stripe-grupp, skild från ursprungsavräkningens.';

create index if not exists event_settlement_supplements_listing_idx
  on public.event_settlement_supplements (listing_id);
create index if not exists event_settlement_supplements_status_idx
  on public.event_settlement_supplements (status);

-- RLS speglar event_settlement_payouts exakt. Hade kompletteringarna varit
-- osynliga för parterna skulle en efterbetalning se ut som pengar från
-- ingenstans på Stripe-kontot, utan motsvarighet i appen — och partnern som
-- själv vill stämma av skulle få ett underlag som inte går ihop.
--
-- Skrivning sker bara via service-role (nattjobbet). Ingen INSERT- eller
-- UPDATE-policy finns, så RLS nekar allt annat.
alter table public.event_settlement_supplements enable row level security;

create policy "Arrangören ser sina kompletteringar"
  on public.event_settlement_supplements for select
  using (exists (
    select 1 from public.listings l
    where l.id = event_settlement_supplements.listing_id
      and l.user_id = auth.uid()
  ));

create policy "Partnern ser sina kompletteringar"
  on public.event_settlement_supplements for select
  using (partner_profile_id = auth.uid());
