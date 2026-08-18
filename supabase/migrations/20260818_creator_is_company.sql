-- Creator "med bolag": a creator who sells as a company gets the company steps
-- (org.nr verification → org.nr on receipts → on_behalf_of MoR path). Chosen at
-- signup (privatperson vs företag). Venues are implicitly companies; customers N/A.
-- Same secure pattern as 20260430: only allow-listed metadata is written by the
-- SECURITY DEFINER trigger.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_company BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_company IS
  'Creator sells as a company (chosen at signup) → gets org.nr verification + company receipt/MoR path.';

-- handle_new_user: preserve existing role + subcategory logic, additionally read
-- is_company from signup metadata (only honored for creators).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
  resolved_is_company BOOLEAN;
BEGIN
  resolved_role := CASE
    WHEN new.raw_user_meta_data->>'role' IN ('creator', 'experience', 'customer')
      THEN new.raw_user_meta_data->>'role'
    ELSE 'customer'
  END;

  resolved_subcategory := CASE
    WHEN resolved_role = 'creator'
      AND new.raw_user_meta_data->>'creator_subcategory' IN ('general', 'taxi_dancer')
      THEN new.raw_user_meta_data->>'creator_subcategory'
    ELSE 'general'
  END;

  resolved_is_company := (
    resolved_role = 'creator'
    AND new.raw_user_meta_data->>'is_company' = 'true'
  );

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, creator_subcategory, is_company)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    resolved_role,
    resolved_subcategory,
    resolved_is_company
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── ROLLBACK ──
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_company;
--   (and restore handle_new_user() from 20260430_creator_subcategories.sql)
