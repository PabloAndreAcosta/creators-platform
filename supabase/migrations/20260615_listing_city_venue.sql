-- Separate CITY from VENUE on listings.
--
-- event_location is a Google-formatted address ("Venue, Street, 127 34 City,
-- Sverige"), and the UI used split(",")[0] as the "city" — surfacing venue
-- names (Värmeverket, Yoga Studio …) under "Alla städer". Add explicit columns:
--   event_city  – real locality (e.g. Stockholm)
--   event_venue – the venue name
-- Filters/SEO use event_city; the venue is shown as a field on the listing.
--
-- Going forward both are captured from Google Place address_components at
-- creation. This migration backfills existing rows. Reversible: drop the two
-- columns (rollback at the bottom).

alter table public.listings add column if not exists event_city text;
alter table public.listings add column if not exists event_venue text;

-- Venue = the first address segment.
update public.listings
set event_venue = nullif(btrim(split_part(event_location, ',', 1)), '')
where event_location is not null and event_venue is null;

-- City = Stockholm for the existing Stockholm-area addresses (incl. the
-- Skärholmen postal town). Per product decision: locality-level city.
update public.listings
set event_city = 'Stockholm'
where event_city is null
  and (event_location ilike '%stockholm%' or event_location ilike '%skärholmen%');

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--   alter table public.listings drop column if exists event_city;
--   alter table public.listings drop column if exists event_venue;
