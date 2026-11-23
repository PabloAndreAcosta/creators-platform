-- Transactional mail is composed long after the request that triggered it — a
-- cron reminder, a Stripe webhook — so there is no browser around to ask what
-- language the reader wants. Remember the choice on the profile instead.
--
-- Null means "never told us": the sender falls back to English rather than
-- assuming Swedish, matching how the app treats a visitor with no cookie.
alter table public.profiles
  add column if not exists locale text;

comment on column public.profiles.locale is
  'UI language this person reads the app in (sv|en|es); null = fall back to English.';

-- Seed the language at signup, so someone who never touches the switcher still
-- gets mail in the language they signed up in rather than the English fallback.
-- Anything other than a supported code is ignored: the metadata is client-sent.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
  resolved_is_company BOOLEAN;
  resolved_locale TEXT;
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

  resolved_locale := CASE
    WHEN new.raw_user_meta_data->>'locale' IN ('sv', 'en', 'es')
      THEN new.raw_user_meta_data->>'locale'
    ELSE NULL
  END;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, creator_subcategory, is_company, locale)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    resolved_role,
    resolved_subcategory,
    resolved_is_company,
    resolved_locale
  );
  RETURN new;
END;
$function$;

-- One-time backfill: every account that existed before this column got Swedish
-- mail, because that was hardcoded. Writing 'sv' onto them preserves exactly
-- what they receive today rather than flipping the whole base to the English
-- fallback overnight. It is a record of what we've been sending, not a claim
-- about who they are — the language switcher overwrites it the moment they
-- choose, and accounts created from here on seed their real language at signup.
UPDATE public.profiles SET locale = 'sv' WHERE locale IS NULL;
