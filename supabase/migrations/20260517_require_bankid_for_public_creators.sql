-- Block creator/experience accounts from setting is_public = true unless
-- BankID-verified. Defense-in-depth atop the signup-flow check (which
-- already requires BankID for creator/experience role selection).
--
-- Service role bypasses this check (admin scripts, webhooks).

CREATE OR REPLACE FUNCTION public.require_bankid_for_public_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  IF (SELECT auth.role()) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_public = true
     AND NEW.role IN ('creator', 'experience', 'kreator', 'upplevelse')
     AND NEW.bankid_verified_at IS NULL
  THEN
    NEW.is_public := false;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS require_bankid_for_public_creator_trigger ON public.profiles;
CREATE TRIGGER require_bankid_for_public_creator_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.require_bankid_for_public_creator();

COMMENT ON FUNCTION public.require_bankid_for_public_creator() IS
  'Defense-in-depth: prevents creator/experience profiles from being made public without BankID verification. Service role bypasses.';
