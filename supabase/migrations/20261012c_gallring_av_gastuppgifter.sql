-- Gallring av gästuppgifter: markör + index.
--
-- Anonymisering, inte radering. Bokföringen behöver beloppet och datumet, och
-- en borttagen rad skulle få kvällens siffror att sluta stämma. anonymized_at
-- gör jobbet idempotent och gör det möjligt att svara på NÄR en uppgift togs
-- bort — frågan kommer alltid efteråt, aldrig före.

alter table public.bookings
  add column if not exists anonymized_at timestamptz;

comment on column public.bookings.anonymized_at is
  'När gästens namn och mejladress gallrades. Null = uppgifterna finns kvar.';

-- Jobbet letar efter gästbokningar som ännu inte gallrats. Partiellt index så
-- det inte växer med varje redan gallrad rad.
create index if not exists bookings_gallring_idx
  on public.bookings (created_at)
  where guest_email is not null and anonymized_at is null;
