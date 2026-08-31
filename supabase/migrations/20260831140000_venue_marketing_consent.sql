-- Samtycke till att höra från lokalen.
--
-- Det här är det som gör att en samarbetspartner kan nå publiken utan att få
-- deltagarlistor utlämnade till sig. Deltagaren säger ja till LOKALEN, hos oss,
-- och vi levererar. Lokalen håller aldrig uppgifterna.
--
-- Kraven på ett giltigt samtycke styr hela tabellen:
--
--   FRIVILLIGT — frågan ställs efter köpet, på biljettsidan, aldrig i kassan.
--     Ingenting i köpet beror på svaret.
--   SPECIFIKT — samtycket gäller en namngiven lokal, inte "partners".
--   INFORMERAT — den exakta texten som visades sparas på raden.
--   BEVISBART — tidpunkt, text, språk och vilket evenemang det gällde sparas.
--   ÅTERKALLELIGT — withdrawn_at, och lika lätt att göra som att ge: samma sida.

create table if not exists public.venue_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  venue_profile_id uuid not null references public.profiles(id) on delete cascade,

  -- Exakt en av dessa. Gäster har inget konto men köper biljetter, och deras
  -- samtycke är lika giltigt — identiteten är då mejladressen.
  profile_id uuid references public.profiles(id) on delete cascade,
  email text,

  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,

  -- Bevisningen. Utan den går det inte att visa VAD någon sagt ja till.
  consent_text text not null,
  locale text not null default 'sv',
  source_listing_id uuid references public.listings(id) on delete set null,

  created_at timestamptz not null default now(),

  -- Vem raden gäller, som ETT värde.
  --
  -- Första försöket var två partiella unika index — ett för konton, ett för
  -- gäster. Det gick inte att göra upsert mot: Postgres kan bara använda ett
  -- partiellt index som arbiter om satsen bär samma WHERE-villkor, och det kan
  -- klienten inte skicka. Det syntes först när upserten kördes skarpt.
  --
  -- Med identiteten i en kolumn blir det ett vanligt unikt index som fungerar
  -- för båda fallen, och NULL-krånglet försvinner helt.
  subject text generated always as (coalesce(profile_id::text, lower(email))) stored,

  constraint venue_consent_identity check (
    (profile_id is not null and email is null) or
    (profile_id is null and email is not null)
  )
);

comment on table public.venue_marketing_consents is
  'Samtycke att ta emot information från en lokal. Lokalen får aldrig uppgifterna utlämnade — utskick sker genom plattformen.';

-- Ett svar per person och lokal. Ångrar man sig uppdateras raden i stället för
-- att en ny läggs till, annars går det inte att avgöra vad som gäller nu.
create unique index if not exists venue_consent_subject_uniq
  on public.venue_marketing_consents(venue_profile_id, subject);

-- Utskick frågar "vilka har sagt ja och inte ångrat sig".
create index if not exists venue_consent_active_idx
  on public.venue_marketing_consents(venue_profile_id)
  where withdrawn_at is null;

alter table public.venue_marketing_consents enable row level security;

-- Utloggade har ingenting här att göra. RLS stoppar dem redan — auth.uid() är
-- NULL och ingen policy matchar — men en tabell-grant som ingen behöver ska
-- ändå bort. Ett skydd som vilar på en enda mekanism är ett skydd som faller
-- när den mekanismen råkar stängas av.
revoke all on public.venue_marketing_consents from anon;

-- Den som har ett konto ser och återkallar sitt eget samtycke. Gästers rader
-- nås bara via biljettsidans API, som går på service_role och verifierar
-- bokningen — en gäst har ingen inloggning att göra RLS på.
create policy "Man ser sitt eget samtycke"
  on public.venue_marketing_consents for select
  using (profile_id = auth.uid());

create policy "Man återkallar sitt eget samtycke"
  on public.venue_marketing_consents for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Lokalen får INTE läsa raderna. Den behöver veta hur många, inte vilka — och
-- hela poängen med konstruktionen är att lokalen aldrig ser uppgifterna.
-- Antalet exponeras separat via en funktion som bara returnerar en siffra.
create or replace function public.venue_consent_count(p_venue uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
    from public.venue_marketing_consents
   where venue_profile_id = p_venue
     and withdrawn_at is null
     and p_venue = auth.uid();
$$;

revoke all on function public.venue_consent_count(uuid) from public;
revoke all on function public.venue_consent_count(uuid) from anon;
grant execute on function public.venue_consent_count(uuid) to authenticated;
