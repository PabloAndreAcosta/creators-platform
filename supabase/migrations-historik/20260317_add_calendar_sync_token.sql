-- Add calendar sync token to profiles for iCal feed authentication
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_sync_token UUID DEFAULT NULL;

-- Index for fast lookup by token
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_sync_token ON public.profiles (calendar_sync_token) WHERE calendar_sync_token IS NOT NULL;
