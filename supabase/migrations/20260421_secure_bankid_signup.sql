-- SECURITY: stop the handle_new_user trigger from trusting client-supplied
-- BankID metadata in raw_user_meta_data. BankID fields are now applied
-- post-signup by server routes that read the HMAC-signed bankid_verified
-- cookie issued by /api/auth/bankid/callback.
--
-- Also constrain role to a fixed allow-list to prevent privilege drift via
-- forged signup metadata.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('creator', 'experience', 'customer')
        THEN new.raw_user_meta_data->>'role'
      ELSE 'customer'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REMEDIATION: any bankid_* rows in profiles before this migration may have
-- been written via the now-closed bypass. Run the statement below manually
-- after confirming whether existing values are legitimate. Left commented to
-- avoid destroying real data on apply.
--
-- UPDATE public.profiles
--   SET bankid_verified_at = NULL,
--       bankid_personal_number = NULL,
--       bankid_name = NULL;
