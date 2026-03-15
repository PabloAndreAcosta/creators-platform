-- Cleanup: Remove legacy tier references
-- The old silver/gold/platinum tier system has been fully replaced by gratis/guld/premium
-- (see 20260310_unified_membership.sql)

-- Remove legacy plan values from subscriptions CHECK constraint
-- Only keep the new role_tier format
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN (
    'publik_guld', 'publik_premium',
    'kreator_guld', 'kreator_premium',
    'upplevelse_guld', 'upplevelse_premium'
  ));

-- Update payouts table comment to reflect new tier names
COMMENT ON TABLE public.payouts IS
  'Creator payout records. Commission based on tier: gratis 15%, guld 8%, premium 3%.';

-- Update profiles tier comment
COMMENT ON COLUMN public.profiles.tier IS
  'Creator tier: gratis (15% commission), guld (8%), premium (3%)';
