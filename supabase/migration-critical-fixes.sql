-- ==========================================
-- Critical fixes migration
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Allow creator_gold and creator_platinum in subscriptions plan check
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('basic', 'premium', 'enterprise', 'creator_gold', 'creator_platinum'));

-- 2. Add stripe_account_id to profiles (for Stripe Connect payouts)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- 3. Add tier column to profiles (silver/gold/platinum)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'silver'
  CHECK (tier IN ('silver', 'gold', 'platinum'));

-- 4. Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_gross NUMERIC(10,2) NOT NULL,
  amount_commission NUMERIC(10,2) NOT NULL,
  amount_net NUMERIC(10,2) NOT NULL,
  payout_type TEXT NOT NULL CHECK (payout_type IN ('batch', 'instant')),
  stripe_payout_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payouts" ON public.payouts
  FOR SELECT USING (auth.uid() = creator_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
