-- Migration: Add ticket purchase columns to bookings table
-- Run this in Supabase SQL Editor

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid INTEGER,
  ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'manual'
    CHECK (booking_type IN ('manual', 'ticket'));

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment
  ON public.bookings (stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;
