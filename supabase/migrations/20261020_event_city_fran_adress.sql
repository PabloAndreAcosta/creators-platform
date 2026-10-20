-- Fyll i event_city på listningar som bara har en skriven adress.
--
-- event_city sätts av platsväljaren, men bara när värden använder den. Skrivs
-- adressen för hand blir kolumnen tom, och då försvinner listningen ur
-- /upplevelser/<stad>, ur sidfoten och ur stadssidorna i sitemapen — den
-- filtreringen går på staden, inte på adressen, eftersom adressen inleds med
-- lokalens namn och ett namn aldrig är en ort.
--
-- Samma regel som src/lib/listings/city.ts använder vid skrivning: leta upp
-- det svenska postnumret (fem siffror, med eller utan mellanslag) och ta
-- ledet efter det, fram till nästa komma. Hittas inget postnummer lämnas
-- raden i fred — en gissad stad är sämre än ingen stad alls.

update listings
set event_city = btrim(
      (regexp_match(event_location, '\d{3}\s?\d{2}\s+([^,]+)'))[1]
    )
where event_city is null
  and event_location is not null
  and event_location ~ '\d{3}\s?\d{2}\s+[^,]+'
  and lower(btrim((regexp_match(event_location, '\d{3}\s?\d{2}\s+([^,]+)'))[1]))
      not in ('sverige', 'sweden');
