-- Two-flow payments (moms clarity): track Connect capability status + flag
-- Usha-owned seller accounts. Additive, non-retroactive — existing charges are
-- unaffected. These columns are webhook/service-role-derived, so they are added
-- to the privileged-column protect trigger (authenticated users cannot set them).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_card_payments_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted     BOOLEAN NOT NULL DEFAULT false,
  -- When true, this seller is Usha itself → principal/gross flow (no on_behalf_of,
  -- no transfer, Usha is merchant of record). Lets us add Usha seller accounts
  -- beyond the env owner id without a code deploy.
  ADD COLUMN IF NOT EXISTS is_usha_owned_seller         BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.stripe_card_payments_enabled IS
  'Stripe Connect card_payments capability is active — required before on_behalf_of (merchant-of-record shift to the organizer).';
COMMENT ON COLUMN public.profiles.is_usha_owned_seller IS
  'Seller is Usha itself → principal/gross accounting flow, not third-party/net.';

-- Extend the privileged-column protect trigger with the new columns.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.tier := OLD.tier;
  NEW.role := OLD.role;
  NEW.is_admin := OLD.is_admin;
  NEW.creator_subcategory := OLD.creator_subcategory;
  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.bankid_verified_at := OLD.bankid_verified_at;
  NEW.bankid_personal_number := OLD.bankid_personal_number;
  NEW.bankid_name := OLD.bankid_name;
  NEW.bankid_grandfathered_at := OLD.bankid_grandfathered_at;
  NEW.stripe_card_payments_enabled := OLD.stripe_card_payments_enabled;
  NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
  NEW.stripe_details_submitted := OLD.stripe_details_submitted;
  NEW.is_usha_owned_seller := OLD.is_usha_owned_seller;

  RETURN NEW;
END;
$func$;

-- Trigger definition unchanged (same name) — function body replaced above.

-- ── ROLLBACK ──
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS stripe_card_payments_enabled,
--     DROP COLUMN IF EXISTS stripe_charges_enabled,
--     DROP COLUMN IF EXISTS stripe_details_submitted,
--     DROP COLUMN IF EXISTS is_usha_owned_seller;
--   (and restore protect_profile_privileged_columns() from 20260514_...sql)
