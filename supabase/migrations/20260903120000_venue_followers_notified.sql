-- Lokalens följare notifierades aldrig.
--
-- Notisjobbet mejlade arrangörens OCH lokalens följare i samma svep, och
-- markerade sedan evenemanget som notifierat. Men lokalens godkännande kommer
-- nästan alltid EFTER att jobbet redan kört — arrangören lägger upp kvällen,
-- jobbet mejlar arrangörens följare inom en timme, och lokalen godkänner dagen
-- efter. Då är evenemanget redan stämplat och hoppas över för alltid.
--
-- Följden: lokalens följare fick i praktiken aldrig veta något, vilket var hela
-- poängen med lokalkopplingen. Felet var tyst — inget kraschade, det gick bara
-- inga mejl.
--
-- Egen stämpel för lokalens följare löser det. De två notiserna sker vid olika
-- tillfällen och ska räknas var för sig.

alter table public.listings
  add column if not exists venue_followers_notified_at timestamptz;

comment on column public.listings.venue_followers_notified_at is
  'När lokalens följare notifierades. Skilt från followers_notified_at, eftersom lokalens godkännande kommer efter att arrangörens följare redan fått besked.';

-- Stämpla allt som finns i dag, så att den första körningen efter den här
-- migrationen inte mejlar ut ett halvår av historik. Samma skäl som
-- recency-spärren i själva jobbet.
update public.listings
   set venue_followers_notified_at = now()
 where venue_followers_notified_at is null;

create index if not exists listings_venue_notify_idx
  on public.listings(venue_profile_id)
  where venue_profile_id is not null and venue_followers_notified_at is null;
