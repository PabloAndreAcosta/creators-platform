-- Add is_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Set existing admins (update with actual admin user IDs)
UPDATE public.profiles SET is_admin = true
WHERE email IN ('pablo.andre.acosta@gmail.com');
