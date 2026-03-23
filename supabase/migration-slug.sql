-- Add slug column for vanity URLs (e.g., usha.se/pabloacosta)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug TEXT;

-- Ensure slugs are unique (only among non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_unique ON public.profiles (slug) WHERE slug IS NOT NULL;

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS profiles_slug_idx ON public.profiles (slug) WHERE slug IS NOT NULL;
