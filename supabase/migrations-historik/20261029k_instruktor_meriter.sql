-- Meriter för instruktörer: utbildning, certifikat, försäkring. Frivilligt —
-- meriterande, inget krav (Pablo 2026-10-29). Fri text per rad, max 10.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coaching_credentials text[]
    CHECK (coaching_credentials IS NULL OR cardinality(coaching_credentials) <= 10);

GRANT SELECT (coaching_credentials) ON public.profiles TO anon, authenticated;
