-- Add slug column to listings for SEO-friendly URLs
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_slug ON public.listings(slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing listings
UPDATE public.listings
SET slug = lower(
  regexp_replace(
    regexp_replace(
      regexp_replace(title, '[åäÅÄ]', 'a', 'g'),
      '[öÖ]', 'o', 'g'
    ),
    '[^a-z0-9]+', '-', 'gi'
  )
) || '-' || left(id::text, 8)
WHERE slug IS NULL AND title IS NOT NULL;
