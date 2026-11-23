-- Anna-feedback: per-event språk. När satt ('sv'|'en') renderas hela event-sidan
-- (chrome + kassa + väntelista) på det språket för ALLA besökare, oavsett deras
-- egen språkinställning. null = följ besökarens språk (nuvarande beteende).
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS content_language text;

COMMENT ON COLUMN public.listings.content_language IS
  'Tvingat visningsspråk för event-sidan (sv|en); null = följ besökarens locale.';
