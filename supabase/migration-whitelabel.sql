-- White-label branding for Premium users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_brand_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_accent_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_primary_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_accent_color_2 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whitelabel_accent_color_3 TEXT;
