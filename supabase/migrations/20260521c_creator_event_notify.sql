-- Creator-calendar: notify followers when a creator posts a new event.

-- Dedup: which event listings have already had their followers notified.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS followers_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_listings_followers_notify_pending
  ON public.listings (created_at)
  WHERE followers_notified_at IS NULL AND is_active = true AND listing_type = 'event';

-- Opt-out preference for "a creator you follow posted a new event" emails.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notif_creator_events BOOLEAN DEFAULT true NOT NULL;
