-- Add event date, time and location fields to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS event_date DATE,
  ADD COLUMN IF NOT EXISTS event_time TIME,
  ADD COLUMN IF NOT EXISTS event_location TEXT;
