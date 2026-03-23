-- ==========================================
-- Creator features: contact info, media gallery,
-- digital products, creator promo codes
-- Run this in Supabase SQL Editor
-- ==========================================

-- ─── CONTACT INFO on profiles ───
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ─── CREATOR MEDIA (portfolio gallery) ───
CREATE TABLE IF NOT EXISTS public.creator_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'instagram', 'instagram-profile', 'vimeo', 'youtube')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_media_user ON public.creator_media (user_id, sort_order);

ALTER TABLE public.creator_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media"
  ON public.creator_media FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view media"
  ON public.creator_media FOR SELECT
  USING (true);

-- ─── DIGITAL PRODUCTS ───
CREATE TABLE IF NOT EXISTS public.digital_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0, -- in SEK
  product_type TEXT NOT NULL CHECK (product_type IN ('video', 'course', 'download', 'other')),
  file_url TEXT, -- stored file (for downloads)
  video_url TEXT, -- hosted video URL
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_products_creator ON public.digital_products (creator_id);

ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own products"
  ON public.digital_products FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Anyone can view active products"
  ON public.digital_products FOR SELECT
  USING (is_active = true);

-- ─── DIGITAL PRODUCT PURCHASES ───
CREATE TABLE IF NOT EXISTS public.digital_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paid INTEGER NOT NULL,
  stripe_payment_id TEXT,
  promo_code TEXT,
  creator_promo_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, buyer_id)
);

ALTER TABLE public.digital_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own purchases"
  ON public.digital_purchases FOR SELECT
  USING (auth.uid() = buyer_id);

CREATE POLICY "Creators can view sales of own products"
  ON public.digital_purchases FOR SELECT
  USING (
    product_id IN (SELECT id FROM public.digital_products WHERE creator_id = auth.uid())
  );

-- ─── CREATOR PROMO CODES ───
CREATE TABLE IF NOT EXISTS public.creator_promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount INTEGER DEFAULT 0, -- fixed amount in SEK
  max_uses INTEGER, -- null = unlimited
  times_used INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code)
);

CREATE INDEX IF NOT EXISTS idx_creator_promo_creator ON public.creator_promo_codes (creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_promo_code ON public.creator_promo_codes (code);

ALTER TABLE public.creator_promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own promo codes"
  ON public.creator_promo_codes FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Anyone can view active promo codes"
  ON public.creator_promo_codes FOR SELECT
  USING (is_active = true);

-- ─── STORAGE BUCKET for creator media ───
-- Note: Run this separately if the bucket doesn't exist:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('creator-media', 'creator-media', true, 52428800,
--   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
