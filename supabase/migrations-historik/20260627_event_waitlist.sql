-- Lucka 1: lead-capture väntelista per event.
-- Gäster (även icke-inloggade) anmäler namn + e-post till ett events väntelista.
-- Skrivning sker ENBART via server-route med service-role (ingen anon-insert).
-- Host (listing-ägaren) kan läsa sin egen väntelista via RLS.

CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,               -- lagras normaliserat (trim + lowercase)
  source text,                       -- t.ex. "event_page", "landing"
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Dedup: en anmälan per e-post per event.
  CONSTRAINT event_waitlist_listing_email_key UNIQUE (listing_id, email)
);

CREATE INDEX IF NOT EXISTS event_waitlist_listing_idx
  ON public.event_waitlist (listing_id);

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

-- Host (listing-ägaren) läser sin egen väntelista. Ingen anon/övrig läsning.
DROP POLICY IF EXISTS "Hosts read own event waitlist" ON public.event_waitlist;
CREATE POLICY "Hosts read own event waitlist" ON public.event_waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = event_waitlist.listing_id AND l.user_id = auth.uid()
    )
  );

-- Inga INSERT/UPDATE/DELETE-policys → endast service-role (server-routes) skriver.
