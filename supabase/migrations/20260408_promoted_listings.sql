-- Add promoted listing support
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ;

-- Index for efficient promoted-first sorting
CREATE INDEX IF NOT EXISTS idx_listings_promoted ON public.listings(is_promoted, promoted_until);
