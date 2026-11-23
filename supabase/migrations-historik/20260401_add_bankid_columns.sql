-- Add BankID verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bankid_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bankid_personal_number TEXT,
  ADD COLUMN IF NOT EXISTS bankid_name TEXT;

-- Unique index on hashed personnummer (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_bankid_personal_number
  ON public.profiles (bankid_personal_number)
  WHERE bankid_personal_number IS NOT NULL;

-- Update the handle_new_user trigger to include BankID metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role,
    bankid_verified_at, bankid_personal_number, bankid_name
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'customer'),
    CASE WHEN new.raw_user_meta_data->>'bankid_verified_at' IS NOT NULL
         THEN (new.raw_user_meta_data->>'bankid_verified_at')::timestamptz
         ELSE NULL END,
    new.raw_user_meta_data->>'bankid_personal_number',
    new.raw_user_meta_data->>'bankid_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
