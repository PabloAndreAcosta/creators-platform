-- Friskvårdsberättigade kort.
--
-- Klippkorten delas i två kategorier, och skillnaden är inte marknadsföring
-- utan skatterätt:
--
--   FRISKVÅRD — practica och workshop. Ren undervisning och motion. Det är
--   sådant Skatteverket godtar som friskvård och som ett friskvårdsbidrag får
--   betala. Det är korten som ska gå att betala med Epassi när ansökan är
--   godkänd.
--
--   ALLT — hela kvällen, socialen inräknad. En social danskväll med barservering
--   är inte friskvård, och att låta den betalas med friskvårdsbidrag vore att
--   be någon annan ta en skatterisk de inte känner till.
--
-- Flaggan finns för att gränsen ska sitta i datan, inte i minnet hos den som
-- lägger upp nästa kort. När Epassi-flödet byggs är det den här kolumnen som
-- avgör vad som får betalas med bidraget.
--
-- Epassi-ansökan är ÄNNU INTE GJORD (SNI-bytet skickades 9 sep 2026). Flaggan
-- beskriver alltså vad som är berättigat, inte vad som går att betala i dag.

alter table listings
  add column if not exists is_wellness_eligible boolean not null default false;

comment on column listings.is_wellness_eligible is
  'Kortet/kvällen innehåller bara undervisning och motion, aldrig social med barservering — alltså friskvårdsberättigat och betalbart med Epassi när det flödet finns.';
