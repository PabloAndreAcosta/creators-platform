-- Add image_url column to listings table for event images
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url TEXT;
