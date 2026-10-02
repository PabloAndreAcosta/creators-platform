-- Kreatörsskuld: utbetalt som sedan återbetalats.
--
-- Avräkningen betalar ut partnerns andel dagen efter kvällen. En kortbetalning
-- kan reklameras långt senare, och ett event kan ställas in efter att pengarna
-- lämnat oss. Då har partnern fått betalt för en intäkt som inte längre finns.
--
-- Via egenanställning går det dessutom inte att backa. SAMgruppen: när lönen är
-- utbetald är skatt och arbetsgivaravgifter inbetalda till Skatteverket, och en
-- utbetald lön kan inte återkallas. Deras anvisning är att kvittningen sköts hos
-- oss — returen blir ett minussaldo som dras av nästa gång vi skickar underlag.
--
-- Tabellen är den platsen. Utan den bokförs skulden i någons huvud.
--
-- TECKEN: positivt = partnern är skyldig Usha. Negativt = skulden kvittades.
-- Saldot är summan. Båda riktningarna bor i samma tabell så att historiken går
-- att läsa — vad som uppstod och vad som drogs av, inte bara ett tal som ändrats.

create table if not exists public.creator_debts (
  id uuid primary key default gen_random_uuid(),
  partner_profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  amount_ore bigint not null,
  reason text not null check (reason in ('refund_after_payout', 'offset', 'manual')),
  note text,
  created_at timestamptz not null default now()
);

comment on table public.creator_debts is
  'Skuld som uppstår när en redan utbetald andel återbetalas. Positivt belopp = partnern är skyldig Usha, negativt = kvittat. Saldo = summan per partner_profile_id.';

comment on column public.creator_debts.amount_ore is
  'Ören. Positivt = ny skuld, negativt = kvittning mot ett underlag.';

-- Saldot läses per partner, och en skuld skrivs en gång per bokning. Indexet
-- bär båda frågorna.
create index if not exists creator_debts_partner_idx
  on public.creator_debts (partner_profile_id, created_at desc);

-- En återbetalning får bli skuld exakt en gång, hur många gånger webhooken än
-- levereras. Stripe levererar om vid fel, och utan den här spärren växer
-- skulden för varje omleverans.
create unique index if not exists creator_debts_refund_once_idx
  on public.creator_debts (booking_id)
  where reason = 'refund_after_payout';

alter table public.creator_debts enable row level security;

-- Ingen policy för anon/authenticated: skuldboken rör pengar mellan Usha och
-- en partner och läses bara av service_role (avräkningen, admin). Att lägga
-- till en läspolicy för partnern själv är rimligt senare, men ska då vara ett
-- medvetet beslut och inte en bieffekt av att tabellen skapades.
