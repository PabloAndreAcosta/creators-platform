-- TikTok integration: add credentials to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tiktok_user_id TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_username TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_access_token TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_refresh_token TEXT;
