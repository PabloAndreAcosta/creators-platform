-- White-label branding for Premium users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_brand_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_accent_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_enabled BOOLEAN DEFAULT false;
