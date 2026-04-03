-- Add latitude/longitude to listings for map integration
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_lat DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_lng DOUBLE PRECISION;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_place_id TEXT;
