-- ==========================================
-- Migration: Fix Constraints & Add Missing Columns
-- Usha Platform
-- Date: 2026-02-22
--
-- CRITICAL FIX: subscriptions.plan CHECK constraint only allows
-- 'basic/premium/enterprise' but webhook writes 'creator_gold/creator_platinum'.
-- This migration fixes that and ensures all columns/tables exist.
-- ==========================================

-- ─── 1. FIX subscriptions.plan CHECK CONSTRAINT ───
-- Drop the old constraint and recreate with creator tier plans included.
-- The constraint name may vary; use the column check approach.
DO $$
BEGIN
  -- Drop existing CHECK on plan column
  ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

  -- Also try the auto-generated name pattern
  ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_check;

  -- Add updated constraint that includes creator tier plans
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('basic', 'premium', 'enterprise', 'creator_gold', 'creator_platinum'));
END $$;

-- ─── 2. ADD stripe_account_id TO profiles (if missing) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN stripe_account_id VARCHAR(255);
    COMMENT ON COLUMN public.profiles.stripe_account_id IS
      'Stripe Connect Express account ID for creator payouts';
  END IF;
END $$;

-- ─── 3. ADD tier TO profiles (if missing) ───
-- This was added in 20260216 but included here for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'tier'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'silver'
      CHECK (tier IN ('silver', 'gold', 'platinum'));
    COMMENT ON COLUMN public.profiles.tier IS
      'Creator tier: silver (20% commission), gold (10%), platinum (5%)';
  END IF;
END $$;

-- ─── 4. ADD event_tier + release_to_gold_at TO listings (if missing) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'event_tier'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN event_tier VARCHAR(1) NOT NULL DEFAULT 'a'
      CHECK (event_tier IN ('a', 'b', 'c'));
    COMMENT ON COLUMN public.listings.event_tier IS
      'Dynamic discount tier: a = full price, b = moderate discount, c = max discount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'release_to_gold_at'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN release_to_gold_at TIMESTAMPTZ;
    COMMENT ON COLUMN public.listings.release_to_gold_at IS
      'When this listing becomes available to Gold/Platinum members (early access)';
  END IF;
END $$;

-- ─── 5. ADD capacity TO listings (if missing) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'capacity'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN capacity INT;
    COMMENT ON COLUMN public.listings.capacity IS
      'Maximum number of bookings for this listing (NULL = unlimited)';
  END IF;
END $$;

-- ─── 6. CREATE booking_queue TABLE (if missing) ───
CREATE TABLE IF NOT EXISTS public.booking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_booked BOOLEAN NOT NULL DEFAULT false,
  auto_booked_at TIMESTAMPTZ,
  UNIQUE (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_queue_listing
  ON public.booking_queue (listing_id, position);

ALTER TABLE public.booking_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies (use DO block to avoid errors if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_queue' AND policyname = 'Users can view own queue entries'
  ) THEN
    CREATE POLICY "Users can view own queue entries" ON public.booking_queue
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_queue' AND policyname = 'Creators can view queue for their listings'
  ) THEN
    CREATE POLICY "Creators can view queue for their listings" ON public.booking_queue
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.listings
          WHERE listings.id = booking_queue.listing_id
          AND listings.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_queue' AND policyname = 'Users can join queue'
  ) THEN
    CREATE POLICY "Users can join queue" ON public.booking_queue
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'booking_queue' AND policyname = 'Users can leave queue'
  ) THEN
    CREATE POLICY "Users can leave queue" ON public.booking_queue
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 7. CREATE payouts TABLE (if missing) ───
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_gross DECIMAL(10,2) NOT NULL,
  amount_commission DECIMAL(10,2) NOT NULL,
  amount_net DECIMAL(10,2) NOT NULL,
  payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('batch', 'instant')),
  stripe_payout_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'paid', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  CHECK (amount_net = amount_gross - amount_commission),
  CHECK (amount_gross > 0),
  CHECK (amount_commission >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator
  ON public.payouts (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_status
  ON public.payouts (status) WHERE status != 'paid';

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payouts' AND policyname = 'Creators can view own payouts'
  ) THEN
    CREATE POLICY "Creators can view own payouts" ON public.payouts
      FOR SELECT USING (auth.uid() = creator_id);
  END IF;
END $$;

-- ─── 8. CREATE/REPLACE get_creator_commission FUNCTION ───
CREATE OR REPLACE FUNCTION public.get_creator_commission(p_creator_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  creator_tier VARCHAR(20);
BEGIN
  SELECT tier INTO creator_tier
  FROM public.profiles
  WHERE id = p_creator_id;

  IF creator_tier IS NULL THEN
    RETURN 0.20;
  END IF;

  RETURN CASE creator_tier
    WHEN 'platinum' THEN 0.05
    WHEN 'gold'     THEN 0.10
    WHEN 'silver'   THEN 0.20
    ELSE 0.20
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
