-- ─── PROMO CODES ───
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Discount type: 'percent' or 'fixed' (fixed = SEK amount)
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')) DEFAULT 'percent',
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  -- Scope: 'subscription', 'ticket', 'both'
  scope TEXT NOT NULL CHECK (scope IN ('subscription', 'ticket', 'both')) DEFAULT 'both',
  -- Optional: restrict to specific plan keys (null = all plans)
  allowed_plans TEXT[] DEFAULT NULL,
  -- Usage limits
  max_uses INTEGER DEFAULT NULL, -- null = unlimited
  current_uses INTEGER DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  -- Validity period
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ DEFAULT NULL, -- null = no expiry
  is_active BOOLEAN DEFAULT true,
  -- Optional Stripe coupon ID (for subscription discounts)
  stripe_coupon_id TEXT DEFAULT NULL,
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track individual promo code usage
CREATE TABLE public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What it was used for
  used_for TEXT NOT NULL CHECK (used_for IN ('subscription', 'ticket')),
  -- Reference to the checkout/booking
  reference_id TEXT, -- booking ID or Stripe session ID
  discount_amount NUMERIC, -- actual discount applied in SEK
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promo_code_id, user_id, reference_id)
);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Anyone can read active promo codes (to validate)
CREATE POLICY "Active promo codes are readable" ON public.promo_codes
  FOR SELECT USING (is_active = true);

-- Only creators/admins can manage promo codes
CREATE POLICY "Creators can manage own promo codes" ON public.promo_codes
  FOR ALL USING (auth.uid() = created_by);

-- Users can see their own promo code usage
CREATE POLICY "Users can view own promo usage" ON public.promo_code_uses
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can record own promo usage" ON public.promo_code_uses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for fast code lookup
CREATE INDEX idx_promo_codes_code ON public.promo_codes (code) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Atomic increment function for promo code usage counter
CREATE OR REPLACE FUNCTION public.increment_promo_uses(promo_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.promo_codes
  SET current_uses = current_uses + 1
  WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
