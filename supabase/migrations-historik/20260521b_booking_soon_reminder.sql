-- T-2h "starts soon" reminder: separate dedup column so it's independent of the
-- day-before reminder (reminder_sent_at).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_soon_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_soon_pending
  ON public.bookings (scheduled_at)
  WHERE reminder_soon_sent_at IS NULL AND status = 'confirmed';
