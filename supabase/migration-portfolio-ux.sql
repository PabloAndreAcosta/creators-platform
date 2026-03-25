-- Portfolio UX improvements: hero media + sections
ALTER TABLE public.creator_media
  ADD COLUMN IF NOT EXISTS is_hero BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS section TEXT;
