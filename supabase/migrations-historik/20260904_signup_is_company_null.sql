-- Kontoskapande kraschade för kreatörer som inte är företag.
--
-- handle_new_user räknade fram is_company så här:
--
--   resolved_is_company := (
--     resolved_role = 'creator'
--     AND new.raw_user_meta_data->>'is_company' = 'true'
--   );
--
-- Registreringsformuläret skickar bara med nyckeln `is_company` när kreatören
-- kryssat i att hen har bolag. Utan nyckeln blir `->>'is_company'` NULL, och
-- i SQL är TRUE AND NULL = NULL — inte FALSE. Kolumnen är NOT NULL, så
-- insättningen föll, och GoTrue svarade användaren "Database error saving
-- new user". Kolumnens DEFAULT false hjälpte inte: ett uttryckligt NULL
-- åsidosätter en default.
--
-- Träffade alla kreatörer som registrerade sig med e-post och lösenord utan
-- att vara företag. Google-vägen slank förbi för att rollen sätts efter
-- kontot skapats — då är resolved_role 'customer', och FALSE AND NULL är
-- FALSE, inte NULL.
--
-- Fixen är COALESCE runt hela uttrycket. Samma skydd läggs på locale och
-- subkategori-jämförelsen så att en saknad nyckel aldrig kan fälla en
-- registrering igen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
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

  -- COALESCE:n är hela poängen med migrationen. Utan den blir värdet NULL så
  -- fort nyckeln saknas, och NOT NULL-kolumnen fäller kontoskapandet.
  resolved_is_company := COALESCE(
    resolved_role = 'creator'
    AND new.raw_user_meta_data->>'is_company' = 'true',
    false
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
