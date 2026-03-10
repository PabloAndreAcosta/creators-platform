-- ==========================================
-- Stripe Checkout migration
-- Updates CHECK constraints for new membership model
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Update subscriptions.plan to allow new role-based plan keys
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN (
    'basic', 'premium', 'enterprise', 'creator_gold', 'creator_platinum',
    'publik_guld', 'publik_premium',
    'kreator_guld', 'kreator_premium',
    'upplevelse_guld', 'upplevelse_premium'
  ));

-- 2. Update profiles.tier to allow new tier values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('silver', 'gold', 'platinum', 'gratis', 'guld', 'premium'));

-- 3. Update profiles.role to allow new role values
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('creator', 'experience', 'customer', 'publik', 'kreator', 'upplevelse'));
