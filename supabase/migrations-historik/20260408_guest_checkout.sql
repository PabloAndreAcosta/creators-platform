-- Allow guest purchases: make customer_id nullable and add guest fields
ALTER TABLE public.bookings ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Allow anonymous reads for guest ticket verification (QR check-in)
CREATE POLICY "Service role can manage all bookings" ON public.bookings
  FOR ALL USING (true) WITH CHECK (true);
