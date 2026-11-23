-- Create social_connections table for secure token storage
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Instagram
  instagram_user_id TEXT,
  instagram_username TEXT,
  instagram_access_token TEXT,
  -- Facebook
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  facebook_page_access_token TEXT,
  -- TikTok
  tiktok_user_id TEXT,
  tiktok_username TEXT,
  tiktok_access_token TEXT,
  tiktok_refresh_token TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Strict RLS: users can only access their own tokens
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social connections" ON public.social_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own social connections" ON public.social_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own social connections" ON public.social_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Migrate existing data from profiles
INSERT INTO public.social_connections (user_id, instagram_user_id, instagram_username, instagram_access_token, facebook_page_id, facebook_page_name, facebook_page_access_token, tiktok_user_id, tiktok_username, tiktok_access_token, tiktok_refresh_token)
SELECT id, instagram_user_id, instagram_username, instagram_access_token, facebook_page_id, facebook_page_name, facebook_page_access_token, tiktok_user_id, tiktok_username, tiktok_access_token, tiktok_refresh_token
FROM public.profiles
WHERE instagram_user_id IS NOT NULL OR facebook_page_id IS NOT NULL OR tiktok_user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
