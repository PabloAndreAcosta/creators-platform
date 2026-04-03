-- Add end time for events
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS event_end_time TIME;
