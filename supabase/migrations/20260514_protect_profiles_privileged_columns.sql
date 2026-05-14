-- Block user-context updates to privileged profile columns.
-- Service role (Stripe webhooks, admin scripts) bypasses this check.
-- Restores privileged columns to OLD values when updated from authenticated user context.

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

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_columns();

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS
  'Defense-in-depth: prevents authenticated users from elevating tier/role/is_admin or tampering with BankID/Stripe-derived columns via direct PATCH /profiles. Service role bypasses.';
