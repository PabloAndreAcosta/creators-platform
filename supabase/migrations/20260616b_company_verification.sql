-- Company (organisationsnummer) verification for venues.
--
-- Venues are companies (or sole traders). They verify via org-nr against the
-- free EU VIES VAT registry → "Verifierat bolag" badge. Personal Mobile BankID
-- becomes optional for venues (adds the "BankID" badge). Creators still need
-- BankID. A venue is marketplace-visible when EITHER company- OR BankID-verified.
--
-- This migration is purely additive and backward-compatible, so it can be
-- applied before the app code ships.

-- 1. Columns -------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_number TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS company_verification_method TEXT;

-- 2. Protect the new verification columns (only service_role may set them) ------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  NEW.org_number := OLD.org_number;
  NEW.company_name := OLD.company_name;
  NEW.company_verified_at := OLD.company_verified_at;
  NEW.company_verification_method := OLD.company_verification_method;

  RETURN NEW;
END;
$function$;

-- 3. A venue may be public via company OR BankID verification -------------------
CREATE OR REPLACE FUNCTION public.require_bankid_for_public_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_public = true THEN
    IF NEW.role IN ('venue', 'experience', 'upplevelse') THEN
      IF NEW.bankid_verified_at IS NULL AND NEW.company_verified_at IS NULL THEN
        NEW.is_public := false;
      END IF;
    ELSIF NEW.role IN ('creator', 'kreator', 'volunteer') THEN
      IF NEW.bankid_verified_at IS NULL THEN
        NEW.is_public := false;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Single source of truth for "may appear on the marketplace" ----------------
--    venue  → company OR BankID verified
--    creator → BankID verified
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_marketplace_verified BOOLEAN
  GENERATED ALWAYS AS (
    CASE
      WHEN role IN ('venue', 'experience', 'upplevelse')
        THEN (company_verified_at IS NOT NULL OR bankid_verified_at IS NOT NULL)
      WHEN role IN ('creator', 'kreator')
        THEN bankid_verified_at IS NOT NULL
      ELSE false
    END
  ) STORED;
