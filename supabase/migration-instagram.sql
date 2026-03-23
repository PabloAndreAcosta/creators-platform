-- Instagram integration for creators
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_access_token TEXT;
