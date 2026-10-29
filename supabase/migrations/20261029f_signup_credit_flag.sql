-- Välkomstavdraget (50 kr till nya konton) blir av/på via app_config.
--
-- Erbjudandet är avslutat "för nu" (Pablo 2026-10-29). I stället för att ta
-- bort utdelningen läser triggern signup_credit_enabled, så att den kan slås
-- på igen utan migration. Saknas raden delas inget ut. Texterna i appen läser
-- samma värde (src/lib/credits/flag.ts). Befintliga avdrag påverkas inte.
--
-- Funktionen är kopierad från produktionens pg_get_functiondef 2026-10-29;
-- enda ändringen är IF-satsen kring avdraget.

insert into public.app_config (key, value) values ('signup_credit_enabled', 'false'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

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

  -- Välkomstavdraget, bara när det är påslaget i app_config. ON CONFLICT DO
  -- NOTHING så att en omkörning av triggern aldrig kan ge två avdrag.
  IF COALESCE((SELECT value = 'true'::jsonb FROM public.app_config WHERE key = 'signup_credit_enabled'), false) THEN
    INSERT INTO public.account_credits (user_id, amount_ore, reason, expires_at)
    VALUES (new.id, 5000, 'signup', now() + interval '12 months')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Samtyckesraden. Övriga kolumner tar sina defaults.
  INSERT INTO public.user_settings (user_id, notif_marketing)
  VALUES (new.id, resolved_marketing)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;
