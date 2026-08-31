-- Koppla ett evenemang till lokalen där det äger rum.
--
-- Bakgrund: plattformens syfte är att koppla ihop besökare med lokaler, men den
-- kopplingen har inte funnits. event_venue är ett fritextfält som Google Places
-- fyller i — bra som adress, oanvändbart som relation. Följer man en lokal här
-- får man alltså inte veta något om vad som händer där.
--
-- Med den här kopplingen kan en lokal få en publik sida med sina arrangemang och
-- nå sina följare när något nytt läggs upp hos dem. Det ersätter behovet av att
-- lämna ut deltagarlistor: lokalen når publiken GENOM plattformen i stället för
-- att få personuppgifter utlämnade till sig.

alter table public.listings
  add column if not exists venue_profile_id uuid references public.profiles(id) on delete set null;

comment on column public.listings.venue_profile_id is
  'Lokalen (profil med rollen venue) där evenemanget äger rum. Skilt från event_venue, som bara är ett namn från Google Places.';

-- Bekräftelsen är inte byråkrati, den är ett spärrdon.
--
-- Kopplingen ger arrangören möjlighet att synas på någon annans profilsida och
-- att utlösa mejl till någon annans följare. Utan bekräftelse kan vem som helst
-- tagga en populär lokal och skicka post i dess namn. Därför: kopplingen får
-- sparas fritt, men den får ingen verkan förrän lokalen sagt ja.
alter table public.listings
  add column if not exists venue_confirmed_at timestamptz;

comment on column public.listings.venue_confirmed_at is
  'När lokalen bekräftade kopplingen. NULL = obekräftad; evenemanget syns då inte på lokalens sida och lokalens följare notifieras inte.';

-- Endast bekräftade kopplingar frågas ut, så indexet täcker just dem.
create index if not exists listings_venue_confirmed_idx
  on public.listings(venue_profile_id, venue_confirmed_at)
  where venue_profile_id is not null;

-- Lokalen måste kunna bekräfta, alltså skriva på en rad den inte äger. RLS på
-- listings tillåter bara ägaren att uppdatera, så bekräftelsen görs via en
-- funktion med security definer i stället för en bredare UPDATE-policy — annars
-- hade lokalen kunnat ändra pris och titel på andras evenemang.
create or replace function public.confirm_venue_listing(p_listing uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
     set venue_confirmed_at = case when p_confirm then now() else null end
   where id = p_listing
     and venue_profile_id = auth.uid();

  if not found then
    raise exception 'Ingen sådan förfrågan för den här lokalen';
  end if;
end;
$$;

revoke all on function public.confirm_venue_listing(uuid, boolean) from public;
grant execute on function public.confirm_venue_listing(uuid, boolean) to authenticated;
