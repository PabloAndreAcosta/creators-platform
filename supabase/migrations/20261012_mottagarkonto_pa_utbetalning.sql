-- Vilket Stripe-konto pengarna faktiskt gick till.
--
-- Bacchi hörde av sig 8 oktober och sa att de 1 980 kr vi registrerat som
-- utbetalda aldrig kommit in på deras konto. Vi kunde inte svara, för vi
-- sparade bara partner_profile_id och överförings-id. Mottagaren lästes ur
-- profilen i samma stund som överföringen gjordes och kastades sedan bort.
--
-- Byter ett konto på profilen — vilket har hänt förut, acct_1THYIe bär
-- −215 kr efter ett manuellt byte i augusti — går det inte längre att se
-- vart en enskild överföring tog vägen. Enda spåret ligger hos Stripe.
--
-- Ett system som flyttar andras pengar ska kunna svara på var de hamnade.
--
-- NULL = okänt. Raderna som skapades före den här migrationen får aldrig ett
-- värde; de måste slås upp i Stripe på stripe_transfer_id.
alter table public.event_settlement_payouts
  add column if not exists destination_account_id text;

comment on column public.event_settlement_payouts.destination_account_id is
  'Stripe-kontot överföringen gick till. Sätts till den avsedda mottagaren när raden skapas och skrivs över med transfer.destination när Stripe svarat. NULL = rad från före 2026-10-12, slå upp i Stripe på stripe_transfer_id.';

alter table public.affiliate_payouts
  add column if not exists destination_account_id text;

comment on column public.affiliate_payouts.destination_account_id is
  'Stripe-kontot överföringen gick till. Samma skäl som för event_settlement_payouts. NULL = rad från före 2026-10-12.';

-- Att hitta alla utbetalningar till ett visst konto ska gå snabbt när någon
-- frågar var pengarna tog vägen.
create index if not exists event_settlement_payouts_destination_idx
  on public.event_settlement_payouts (destination_account_id)
  where destination_account_id is not null;
