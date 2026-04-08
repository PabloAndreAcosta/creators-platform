-- Referral program
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

-- Generate referral codes for existing profiles (6 char uppercase alphanumeric)
UPDATE public.profiles
SET referral_code = upper(substr(md5(id::text || now()::text), 1, 6))
WHERE referral_code IS NULL;
