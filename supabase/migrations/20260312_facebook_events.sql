-- Facebook Events integration
-- Stores the connected Facebook Page info on the user's profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_name TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT;

-- Store the Facebook event ID on listings so we can update/link them
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS facebook_event_id TEXT;
