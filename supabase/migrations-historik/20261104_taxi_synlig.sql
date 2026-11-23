-- Taxidansare och instruktörer syns med förnamn på kvällens publika sida, i
-- serielistan och i kalendern — det är en del av rollen och står vid anmälan,
-- så det går inte att välja bort. Bilden går att välja bort: show_photo_on_event.
-- Bara den som själv anmält sig till ett pass syns.
ALTER TABLE public.taxi_signups
  ADD COLUMN IF NOT EXISTS show_photo_on_event boolean NOT NULL DEFAULT true;
-- Kolumnen hette en kort stund show_on_event (lades i prod 2026-11-04 men
-- användes aldrig av driftsatt kod).
ALTER TABLE public.taxi_signups DROP COLUMN IF EXISTS show_on_event;
