-- Vilken kanal ett nytt konto kom från (utm från cookien usha_utm).
-- Skrivs en gång, av servern (service-role), strax efter att kontot skapats.
-- Inga grants till authenticated/anon: det är intern statistik.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_utm_source text,
  ADD COLUMN IF NOT EXISTS signup_utm_medium text,
  ADD COLUMN IF NOT EXISTS signup_utm_campaign text,
  ADD COLUMN IF NOT EXISTS signup_utm_content text;
REVOKE SELECT (signup_utm_source, signup_utm_medium, signup_utm_campaign, signup_utm_content) ON public.profiles FROM anon, authenticated;
