-- Venues / Platser catalog
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  place_id TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_place_id ON public.venues(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view venues" ON public.venues
  FOR SELECT USING (true);

-- Populate from existing listings
INSERT INTO public.venues (name, address, place_id, lat, lng)
SELECT DISTINCT ON (event_place_id)
  event_location,
  event_location,
  event_place_id,
  event_lat,
  event_lng
FROM public.listings
WHERE event_place_id IS NOT NULL
  AND event_location IS NOT NULL
ON CONFLICT (place_id) DO NOTHING;

-- Extract city from address (first part before comma)
UPDATE public.venues
SET city = split_part(name, ',', 1)
WHERE city IS NULL AND name IS NOT NULL;
