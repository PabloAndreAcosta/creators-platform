-- Lokalteam, fas 1: flera personer kan tillhöra en lokal.
--
-- En lokal är ett konto, inte en abstrakt organisation. Det är medvetet:
-- Stripe legitimerar en PERSON som företrädare, BankID verifierar en PERSON och
-- bolagsverifieringen hänger på en profilrad. En lokal som "äger" sitt
-- Stripe-konto vore en identitet ingen utanför plattformen känner igen.
--
-- Därför är ÄGAREN IMPLICIT: den som är lokalen. Ägaren har ingen rad här, och
-- får inte ha en — två källor till samma sanning blir förr eller senare två
-- olika svar. Se check-villkoret nedan.
--
-- Principen som styr allt: den som hanterar ekonomin ÄR ägaren. Pengar är därför
-- inte något man delegerar, och utbetalningar/Stripe/bolagsverifiering finns
-- inte med bland behörigheterna. Ska någon annan sköta ekonomin byter man ägare.

create table if not exists public.venue_members (
  id uuid primary key default gen_random_uuid(),
  venue_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Den inbjudne. user_id är NULL tills inbjudan accepterats, eftersom man ska
  -- kunna bjuda in någon som ännu inte har konto.
  user_id uuid references public.profiles(id) on delete cascade,
  invited_email text,

  -- Vad personen får göra. Listan är uppräknad i ett check-villkor med flit:
  -- att lägga till en sjunde behörighet blir en migration, så att ett nytt
  -- verktyg inte tyst vidgar vad en inbjuden person kommer åt. Samma resonemang
  -- som admin_capabilities.
  capabilities text[] not null default '{}',

  token text unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Identiteten som ETT värde, så unikheten blir ett vanligt index.
  -- Partiella unika index går inte att göra upsert mot: Postgres kan bara
  -- använda ett sådant som ON CONFLICT-arbiter om satsen bär samma WHERE-villkor,
  -- och det kan klienten inte skicka.
  subject text generated always as (coalesce(user_id::text, lower(invited_email))) stored,

  constraint venue_member_identity check (user_id is not null or invited_email is not null),

  constraint venue_member_capabilities check (
    capabilities <@ ARRAY['events','bookings','scan','messages','stats','page']::text[]
  ),

  -- Ägaren är lokalen. Att lägga ägaren som medlem vore att skapa en andra,
  -- konkurrerande sanning om vem som bestämmer.
  constraint venue_member_not_owner check (user_id is null or user_id <> venue_profile_id)
);

comment on table public.venue_members is
  'Personer som tillhör en lokal. Ägaren är IMPLICIT (= lokalens eget konto) och har ingen rad här.';

create unique index if not exists venue_members_subject_uniq
  on public.venue_members(venue_profile_id, subject);

create index if not exists venue_members_user_idx
  on public.venue_members(user_id) where removed_at is null;

alter table public.venue_members enable row level security;

revoke all on public.venue_members from anon;

-- Ägaren styr sitt eget team helt. Kontrollen är venue_profile_id = auth.uid(),
-- vilket är precis vad "ägaren är lokalen" betyder.
drop policy if exists "Ägaren hanterar sitt team" on public.venue_members;
create policy "Ägaren hanterar sitt team"
  on public.venue_members for all
  using (venue_profile_id = auth.uid())
  with check (venue_profile_id = auth.uid());

-- Medlemmen ser sin egen rad, men ändrar den inte. Att kunna se vad man blivit
-- tilldelad är rimligt; att kunna ändra det vore att dela ut behörigheter till
-- sig själv.
drop policy if exists "Medlemmen ser sitt eget medlemskap" on public.venue_members;
create policy "Medlemmen ser sitt eget medlemskap"
  on public.venue_members for select
  using (user_id = auth.uid());
