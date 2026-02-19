-- ==========================================
-- FULL DATABASE MIGRATION
-- Usha Platform
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ==========================================

-- ═══════════════════════════════════════════
-- PART 1: BASE SCHEMA
-- ═══════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  category TEXT,
  location TEXT,
  hourly_rate INTEGER,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SUBSCRIPTIONS ───
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'premium', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')) DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PAYMENTS ───
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'sek',
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── LISTINGS ───
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price INTEGER,
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BOOKINGS ───
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled')) DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS POLICIES ───

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Active listings are viewable" ON public.listings
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own listings" ON public.listings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = customer_id);

CREATE POLICY "Customers can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Creators can update bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = creator_id);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── UPDATED_AT TRIGGER ───
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ═══════════════════════════════════════════
-- PART 2: TIERS, DYNAMIC DISCOUNTS & PAYOUTS
-- ═══════════════════════════════════════════

-- ─── 1. CREATOR TIERS ───
ALTER TABLE public.profiles
  ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'silver'
  CHECK (tier IN ('silver', 'gold', 'platinum'));

COMMENT ON COLUMN public.profiles.tier IS
  'Creator tier: silver (20% commission), gold (10%), platinum (5%)';

-- ─── 2. LISTING EVENT TIERS & GOLD RELEASE ───
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
CREATE TABLE public.booking_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_booked BOOLEAN NOT NULL DEFAULT false,
  auto_booked_at TIMESTAMPTZ,
  UNIQUE (listing_id, user_id)
);

CREATE INDEX idx_booking_queue_listing ON public.booking_queue (listing_id, position);

COMMENT ON TABLE public.booking_queue IS
  'Waitlist queue for fully booked events. Auto-books when spots open.';

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
CREATE TABLE public.payouts (
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

CREATE INDEX idx_payouts_creator ON public.payouts (creator_id, created_at DESC);
CREATE INDEX idx_payouts_status ON public.payouts (status) WHERE status != 'paid';

COMMENT ON TABLE public.payouts IS
  'Creator payout records. Commission based on tier: silver 20%, gold 10%, platinum 5%.';

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view own payouts" ON public.payouts
  FOR SELECT USING (auth.uid() = creator_id);

-- ─── 5. COMMISSION FUNCTION ───
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

COMMENT ON FUNCTION public.get_creator_commission IS
  'Returns commission rate (decimal) for a creator based on their tier';
