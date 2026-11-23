-- Add checked_in_at column to bookings for ticket scanning
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
