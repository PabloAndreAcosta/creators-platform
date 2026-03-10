-- Unified Membership Model Migration
-- Replaces old Silver/Gold/Platinum tiers with Gratis/Guld/Premium
-- Adds role column (publik/kreator/upplevelse)

-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'publik'
  CHECK (role IN ('publik', 'kreator', 'upplevelse'));

-- Update tier CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ALTER COLUMN tier SET DEFAULT 'gratis';
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('gratis', 'guld', 'premium'));

-- Migrate existing tier values
UPDATE profiles SET tier = 'gratis' WHERE tier = 'silver' OR tier IS NULL;
UPDATE profiles SET tier = 'guld' WHERE tier = 'gold';
UPDATE profiles SET tier = 'premium' WHERE tier = 'platinum';

-- Update subscriptions plan CHECK
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN (
    'publik_guld', 'publik_premium',
    'kreator_guld', 'kreator_premium',
    'upplevelse_guld', 'upplevelse_premium',
    -- Keep old values for backwards compatibility during transition
    'basic', 'premium', 'enterprise', 'creator_gold', 'creator_platinum'
  ));

-- Update commission function
CREATE OR REPLACE FUNCTION public.get_creator_commission(p_creator_id UUID)
RETURNS DECIMAL AS $$
DECLARE v_tier VARCHAR(20);
BEGIN
  SELECT tier INTO v_tier FROM profiles WHERE id = p_creator_id;
  RETURN CASE v_tier
    WHEN 'premium' THEN 0.03
    WHEN 'guld' THEN 0.08
    ELSE 0.15
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
