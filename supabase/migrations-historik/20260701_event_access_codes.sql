-- Anna-feedback: åtkomstkoder per event för team på plats + gratis VIP-biljetter.
-- En kod ger en gratis biljett. Host skapar/hanterar koder; inlösen sker via
-- server-route med service-role (atomisk för att inte överskrida max_uses).

CREATE TABLE IF NOT EXISTS public.event_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  code text NOT NULL,                 -- lagras versaler/trimmat
  label text,                          -- t.ex. "Team" | "VIP"
  max_uses integer,                    -- null = obegränsat
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_access_codes_listing_code_key UNIQUE (listing_id, code)
);

CREATE INDEX IF NOT EXISTS event_access_codes_listing_idx
  ON public.event_access_codes (listing_id);

ALTER TABLE public.event_access_codes ENABLE ROW LEVEL SECURITY;

-- Host (listing-ägaren) hanterar sina egna koder. Inlösen går via service-role.
DROP POLICY IF EXISTS "Hosts manage own access codes" ON public.event_access_codes;
CREATE POLICY "Hosts manage own access codes" ON public.event_access_codes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.listings l
                 WHERE l.id = event_access_codes.listing_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l
                 WHERE l.id = event_access_codes.listing_id AND l.user_id = auth.uid()));

-- Atomisk inlösen: konsumerar en användning om koden är giltig + har kvar.
-- Returnerar kodens id om den konsumerades, annars ingen rad (null).
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_listing uuid, p_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.event_access_codes
  SET used_count = used_count + 1
  WHERE listing_id = p_listing
    AND code = upper(btrim(p_code))
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING id;
$$;
