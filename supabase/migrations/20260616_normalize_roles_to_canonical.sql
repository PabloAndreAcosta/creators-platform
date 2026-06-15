-- Normalize profiles.role to a single canonical English set:
--   creator  (was: kreator)
--   venue    (was: upplevelse / experience)
--   customer (was: publik)
--
-- The app code (deployed alongside this) uses these canonical values. This
-- migration also updates every DB object that hard-coded the old role values:
-- two trigger functions (handle_new_user, require_bankid_for_public_creator)
-- and two RLS policies (gigs, posts). Role lists are kept tolerant (legacy +
-- canonical) so nothing breaks in the brief deploy→migrate window.
--
-- NOT changed (intentional): subscription plan identifiers (publik_guld /
-- kreator_guld / upplevelse_guld) are Stripe-bound keys, not role values.

-- 1. Data: normalize existing role values --------------------------------------
UPDATE public.profiles SET role = 'creator'  WHERE role = 'kreator';
UPDATE public.profiles SET role = 'venue'    WHERE role IN ('upplevelse', 'experience');
UPDATE public.profiles SET role = 'customer' WHERE role = 'publik';

-- 2. handle_new_user: accept the canonical 'venue' role from signup metadata ----
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
BEGIN
  resolved_role := CASE
    WHEN new.raw_user_meta_data->>'role' IN ('creator', 'venue', 'experience', 'customer', 'volunteer')
      THEN new.raw_user_meta_data->>'role'
    ELSE 'customer'
  END;
  -- tolerate the old 'experience' value, store canonical
  IF resolved_role = 'experience' THEN resolved_role := 'venue'; END IF;

  resolved_subcategory := CASE
    WHEN resolved_role = 'creator'
      AND new.raw_user_meta_data->>'creator_subcategory' IN ('general', 'taxi_dancer')
      THEN new.raw_user_meta_data->>'creator_subcategory'
    ELSE 'general'
  END;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, creator_subcategory)
  VALUES (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    resolved_role, resolved_subcategory
  );
  RETURN new;
END;
$function$;

-- 3. require_bankid_for_public_creator: include 'venue' in the BankID gate ------
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

  IF NEW.is_public = true
     AND NEW.role IN ('creator', 'venue', 'experience', 'kreator', 'upplevelse', 'volunteer')
     AND NEW.bankid_verified_at IS NULL
  THEN
    NEW.is_public := false;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. RLS: gigs — was hard-coded to role = 'experience' -------------------------
DROP POLICY IF EXISTS "Cleared experience manages own gigs" ON public.gigs;
CREATE POLICY "Cleared venue manages own gigs" ON public.gigs
  FOR ALL
  USING (
    (arranger_id = (SELECT auth.uid()))
    AND is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role IN ('venue', 'experience', 'upplevelse')))
  WITH CHECK (
    (arranger_id = (SELECT auth.uid()))
    AND is_bankid_cleared((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = (SELECT auth.uid())
                  AND p.role IN ('venue', 'experience', 'upplevelse')));

-- 5. RLS: posts — array was missing 'venue' ------------------------------------
DROP POLICY IF EXISTS "Kreators and upplevelser can create posts" ON public.posts;
CREATE POLICY "Creators and venues can create posts" ON public.posts
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)
    AND EXISTS (SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                  AND profiles.role = ANY (ARRAY['creator','venue','kreator','experience','upplevelse'])));

-- event_instructors policy ['creator','kreator'] is left as-is: 'creator' still
-- matches after migration, so no change is needed there.
