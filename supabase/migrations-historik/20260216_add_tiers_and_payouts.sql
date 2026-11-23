-- ==========================================
-- Migration: Add Tiers, Dynamic Discounts & Payouts
-- Usha Platform
-- Date: 2026-02-16
-- ==========================================

-- ─── 1. CREATOR TIERS ───
-- Add tier column to profiles table.
-- Silver = default (new creators), Gold = established, Platinum = top creators.
-- Tier determines commission rate and visibility perks.
ALTER TABLE public.profiles
  ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'silver'
  CHECK (tier IN ('silver', 'gold', 'platinum'));

COMMENT ON COLUMN public.profiles.tier IS
  'Creator tier: silver (20% commission), gold (10%), platinum (5%)';

-- ─── 2. LISTING EVENT TIERS & GOLD RELEASE ───
-- event_tier controls dynamic discount levels:
--   A = full price (new/hot events)
--   B = moderate discount
--   C = highest discount (older/low-demand events)
-- release_to_gold_at: when the event becomes bookable by Gold members
--   (before public release, giving Gold members early access)
ALTER TABLE public.listings
  ADD COLUMN event_tier VARCHAR(1) NOT NULL DEFAULT 'a'
  CHECK (event_tier IN ('a', 'b', 'c'));

ALTER TABLE public.listings
  ADD COLUMN release_to_gold_at TIMESTAMPTZ;

COMMENT ON COLUMN public.listings.event_tier IS
  'Dynamic discount tier: a = full price, b = moderate discount, c = max discount';
COMMENT ON COLUMN public.listings.release_to_gold_at IS
  'When this listing becomes available to Gold/Platinum members (early access)';

-- ─── 3. BOOKING QUEUE ───
-- Supports waitlist and auto-booking functionality.
-- When an event is full, users join the queue.
-- If a spot opens, the next person in queue is auto-booked.
CREATE TABLE public.booking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_booked BOOLEAN NOT NULL DEFAULT false,
  auto_booked_at TIMESTAMPTZ,

  -- Prevent duplicate queue entries per user per listing
  UNIQUE (listing_id, user_id)
);

CREATE INDEX idx_booking_queue_listing ON public.booking_queue (listing_id, position);

COMMENT ON TABLE public.booking_queue IS
  'Waitlist queue for fully booked events. Auto-books when spots open.';

-- RLS: users can see their own queue entries, creators can see queue for their listings
ALTER TABLE public.booking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queue entries" ON public.booking_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Creators can view queue for their listings" ON public.booking_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = booking_queue.listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join queue" ON public.booking_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave queue" ON public.booking_queue
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 4. PAYOUTS ───
-- Tracks creator payouts via Stripe.
-- Supports both batch (weekly) and instant payouts.
-- Commission is deducted based on creator tier.
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_gross DECIMAL(10,2) NOT NULL,        -- Total before commission
  amount_commission DECIMAL(10,2) NOT NULL,   -- Platform commission deducted
  amount_net DECIMAL(10,2) NOT NULL,          -- Amount paid to creator
  payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('batch', 'instant')),
  stripe_payout_id VARCHAR(255),              -- Stripe payout reference
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'paid', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,

  -- Net should equal gross minus commission
  CHECK (amount_net = amount_gross - amount_commission),
  CHECK (amount_gross > 0),
  CHECK (amount_commission >= 0)
);

CREATE INDEX idx_payouts_creator ON public.payouts (creator_id, created_at DESC);
CREATE INDEX idx_payouts_status ON public.payouts (status) WHERE status != 'paid';

COMMENT ON TABLE public.payouts IS
  'Creator payout records. Commission based on tier: silver 20%, gold 10%, platinum 5%.';

-- RLS: creators can view their own payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payouts" ON public.payouts
  FOR SELECT USING (auth.uid() = creator_id);

-- ─── 5. COMMISSION FUNCTION ───
-- Returns the commission rate for a creator based on their tier.
-- Silver: 20%, Gold: 10%, Platinum: 5%
CREATE OR REPLACE FUNCTION public.get_creator_commission(p_creator_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  creator_tier VARCHAR(20);
BEGIN
  SELECT tier INTO creator_tier
  FROM public.profiles
  WHERE id = p_creator_id;

  -- Default to highest commission if creator not found
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

COMMENT ON FUNCTION public.get_creator_commission IS
  'Returns commission rate (decimal) for a creator based on their tier';

-- ─── 6. UPDATED_AT TRIGGER FOR NEW TABLES ───
-- booking_queue doesn't need updated_at (immutable queue position)
-- payouts don't use updated_at (status changes tracked via paid_at)
