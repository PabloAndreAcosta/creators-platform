-- Lucka 2: självbetjänings-mejlutskick till ett events väntelista.
-- Logg över skickade utskick (audit + idempotens-överblick). Skrivning sker
-- ENBART via server-route med service-role. Host (listing-ägaren) läser sina egna.

CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  cta_label text,
  cta_url text,
  audience text NOT NULL DEFAULT 'waitlist',
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',   -- 'sent' (skarpt) | 'test'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_broadcasts_listing_idx
  ON public.email_broadcasts (listing_id, created_at DESC);

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts read own broadcasts" ON public.email_broadcasts;
CREATE POLICY "Hosts read own broadcasts" ON public.email_broadcasts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = email_broadcasts.listing_id AND l.user_id = auth.uid()
    )
  );
