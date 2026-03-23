-- ==========================================
-- Multi-value profile fields
-- Run this in Supabase SQL Editor
-- ==========================================

-- Add new multi-value columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rates JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS websites TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_x TEXT,
  ADD COLUMN IF NOT EXISTS social_facebook TEXT;

-- Migrate existing data from single-value columns
UPDATE public.profiles
  SET categories = ARRAY[category]
  WHERE category IS NOT NULL AND category != '' AND (categories IS NULL OR categories = '{}');

UPDATE public.profiles
  SET locations = ARRAY[location]
  WHERE location IS NOT NULL AND location != '' AND (locations IS NULL OR locations = '{}');

UPDATE public.profiles
  SET rates = jsonb_build_object(category, hourly_rate)
  WHERE category IS NOT NULL AND category != ''
    AND hourly_rate IS NOT NULL
    AND (rates IS NULL OR rates = '{}');

UPDATE public.profiles
  SET websites = ARRAY[website]
  WHERE website IS NOT NULL AND website != '' AND (websites IS NULL OR websites = '{}');

-- Helper function for marketplace price filtering/sorting
CREATE OR REPLACE FUNCTION min_rate(rates JSONB) RETURNS INTEGER AS $$
  SELECT COALESCE(MIN(value::int), 0) FROM jsonb_each_text(rates);
$$ LANGUAGE sql IMMUTABLE;
