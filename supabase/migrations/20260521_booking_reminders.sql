-- Booking reminders: dedup column so the daily reminder cron is idempotent.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Partial index: the cron only scans upcoming, not-yet-reminded bookings.
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending
  ON public.bookings (scheduled_at)
  WHERE reminder_sent_at IS NULL AND status = 'confirmed';
