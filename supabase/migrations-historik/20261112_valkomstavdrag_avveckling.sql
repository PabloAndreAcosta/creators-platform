-- Välkomstavdraget avvecklas (Pablo 2026-11-12: "Låt de som fått avdraget
-- behålla det. Du kan bygga bort det från nu.")
--
-- Utdelningen var redan av via app_config.signup_credit_enabled (20261029f).
-- Nu tas grenen bort ur triggern helt, och flaggan med den, så att avdraget
-- inte kan slås på av misstag. Redan utdelade avdrag i account_credits rörs
-- INTE: de 42 kvarvarande gäller tills de används eller går ut (sept–okt
-- 2027), och kassan drar dem som förut.
--
-- Funktionen är kopierad från produktionens pg_get_functiondef 2026-11-12;
-- enda ändringen är att IF-satsen kring avdraget är borttagen.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  resolved_role TEXT;
  resolved_subcategory TEXT;
  resolved_is_company BOOLEAN;
  resolved_locale TEXT;
  resolved_marketing BOOLEAN;
BEGIN
  resolved_role := CASE new.raw_user_meta_data->>'role'
    WHEN 'creator'    THEN 'creator'
    WHEN 'venue'      THEN 'venue'
    WHEN 'experience' THEN 'venue'   -- gammalt namn, se migrationsfilen
    WHEN 'customer'   THEN 'customer'
    ELSE 'customer'
  END;

  resolved_subcategory := CASE
    WHEN resolved_role = 'creator'
      AND new.raw_user_meta_data->>'creator_subcategory' IN ('general', 'taxi_dancer')
      THEN new.raw_user_meta_data->>'creator_subcategory'
    ELSE 'general'
  END;

  -- COALESCE:n är inte kosmetisk: TRUE AND NULL är NULL i SQL, och kolumnen är
  -- NOT NULL. Utan den föll varje registrering av en kreatör utan bolag.
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

  -- Bara den exakta strängen 'true' räknas. Allt annat — saknad nyckel, tom
  -- sträng, ett OAuth-flöde som aldrig visade rutan — blir nej.
  resolved_marketing := COALESCE(
    new.raw_user_meta_data->>'marketing_consent' = 'true',
    false
  );

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

  -- Samtyckesraden. Övriga kolumner tar sina defaults.
  INSERT INTO public.user_settings (user_id, notif_marketing)
  VALUES (new.id, resolved_marketing)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;

-- Flaggan har inget kvar att styra.
delete from public.app_config where key = 'signup_credit_enabled';
