-- ============================================================
-- Creator subcategories: introduce 'taxi_dancer' as a sub-type
-- under the existing 'creator' role. Adds optional dance and
-- coaching profile fields, extends listing_type for dance
-- packages and coaching sessions, and updates the secure
-- handle_new_user trigger to read creator_subcategory from
-- signup metadata using an allow-list (same security pattern
-- as 20260421_secure_bankid_signup.sql).
-- ============================================================

-- ── Profiles: subcategory + dance/coaching attributes ───────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creator_subcategory TEXT DEFAULT 'general'
    CHECK (creator_subcategory IN ('general', 'taxi_dancer')),
  ADD COLUMN IF NOT EXISTS dance_styles TEXT[],
  ADD COLUMN IF NOT EXISTS dance_languages TEXT[],
  ADD COLUMN IF NOT EXISTS dance_experience_years INTEGER
    CHECK (dance_experience_years IS NULL OR dance_experience_years >= 0),
  ADD COLUMN IF NOT EXISTS offers_coaching BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS coaching_hourly_rate_sek INTEGER
    CHECK (coaching_hourly_rate_sek IS NULL OR coaching_hourly_rate_sek >= 0),
  ADD COLUMN IF NOT EXISTS coaching_specialties TEXT[],
  ADD COLUMN IF NOT EXISTS coaching_bio TEXT;

-- Row-level constraint: a non-creator cannot be a taxi_dancer.
-- Prevents bypass via direct profile update with a forged subcategory.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subcategory_requires_creator;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subcategory_requires_creator
    CHECK (
      creator_subcategory = 'general'
      OR (creator_subcategory = 'taxi_dancer' AND role = 'creator')
    );

CREATE INDEX IF NOT EXISTS idx_profiles_creator_subcategory
  ON public.profiles (creator_subcategory)
  WHERE creator_subcategory <> 'general';

CREATE INDEX IF NOT EXISTS idx_profiles_offers_coaching
  ON public.profiles (offers_coaching)
  WHERE offers_coaching = true;

-- ── Listings: extend listing_type with dance_package + coaching_session ──
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_listing_type_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_listing_type_check
    CHECK (listing_type IN (
      'service',
      'event',
      'table_reservation',
      'spa_treatment',
      'group_activity',
      'dance_package',
      'coaching_session'
    ));

-- ── handle_new_user trigger: also pick up creator_subcategory ──
-- Same secure pattern: only allow-listed values from raw_user_meta_data
-- are written. Subcategory is only honored when role is creator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
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

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, creator_subcategory)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    resolved_role,
    resolved_subcategory
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
