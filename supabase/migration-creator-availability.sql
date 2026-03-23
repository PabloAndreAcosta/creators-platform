-- ==========================================
-- Creator Availability
-- Run this in Supabase SQL Editor
-- ==========================================

-- ─── CREATOR AVAILABILITY ───
CREATE TABLE public.creator_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, available_date)
);

-- Index for fast lookups by user + date range
CREATE INDEX idx_creator_availability_user_date
  ON public.creator_availability (user_id, available_date);

-- ─── RLS ───
ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own availability
CREATE POLICY "Users can view own availability"
  ON public.creator_availability FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own availability"
  ON public.creator_availability FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own availability"
  ON public.creator_availability FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view any creator's availability (for booking pages)
CREATE POLICY "Anyone can view creator availability"
  ON public.creator_availability FOR SELECT
  USING (true);
