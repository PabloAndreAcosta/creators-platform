-- Lucka 4: olistade event ("hemlig länk").
-- Additiv kolumn, DEFAULT true → alla befintliga event förblir publika.
--
-- VIKTIGT: medvetet UTANFÖR RLS. RLS-policyn på listings förblir
--   "Active listings are viewable" => USING (is_active = true)
-- så att den anonyma event-detaljsidan (/event/[slug]) kan fortsätta servera
-- ett olistat event via direktlänk. Synlighet i marknadsplats/browse styrs i
-- app-frågorna (.eq('is_public', true)), inte i RLS.
--
-- is_public = true  → normalt, syns i browse + nåbart via länk
-- is_public = false → olistat, dolt i browse men nåbart via direktlänk (slug)

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.listings.is_public IS
  'Olistat event om false: nåbart via direktlänk (slug) men dolt från marknadsplats/browse. Gating sker i app-queries, ej RLS.';
