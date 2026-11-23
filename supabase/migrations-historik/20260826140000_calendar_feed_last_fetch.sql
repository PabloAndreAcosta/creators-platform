-- Spåra när kalenderflödet senast hämtades, och av vad.
--
-- Appen kan inte veta vilken kalender som prenumererar — den delar bara ut en
-- adress. Men den kan se vem som hämtar den. Det är den enda ärliga signalen
-- på om synken faktiskt fungerar, och den svarar på användarens fråga:
-- "är något kopplat, och vad?"
--
-- Kolumnerna läses av /app/calendar via service-role (som calendar_sync_token),
-- så authenticated behöver ingen SELECT här.
--
-- OBS filnamnet: Supabase kräver <timestamp>_name.sql med full 14-siffrig
-- tidsstämpel. Ett tjugotal äldre migrationer i det här repot heter
-- "20260722b_..." och hoppas därför över tyst av CLI:t.

alter table public.profiles
  add column if not exists calendar_feed_last_fetched_at timestamptz,
  add column if not exists calendar_feed_last_client text;

comment on column public.profiles.calendar_feed_last_fetched_at is
  'När kalenderflödet senast hämtades av en kalenderklient.';
comment on column public.profiles.calendar_feed_last_client is
  'Grov gissning av vilken kalender som hämtade: google | apple | outlook | other.';
