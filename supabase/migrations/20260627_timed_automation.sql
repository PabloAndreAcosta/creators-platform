-- Lucka 3: tidsstyrd automatisering för biljettförsäljning.
-- Försäljningsläget HÄRLEDS on-read (se src/lib/listings/sale-state.ts) utifrån
-- dessa additiva fält — ingen cron flippar status, vilket ger exakt timing.
--
--  early_bird_start/end + early_bird_price : förköpsfönster med eget pris
--  public_sale_at                          : schemalagt publikt släpp (ord. pris)
--  capacity + tickets_sold                 : kapacitetsbaserad utförsäljning

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS early_bird_start timestamptz,
  ADD COLUMN IF NOT EXISTS early_bird_end   timestamptz,
  ADD COLUMN IF NOT EXISTS early_bird_price numeric,
  ADD COLUMN IF NOT EXISTS public_sale_at   timestamptz,
  ADD COLUMN IF NOT EXISTS capacity         integer,
  ADD COLUMN IF NOT EXISTS tickets_sold     integer NOT NULL DEFAULT 0;

-- Atomisk räknare som webhooken anropar vid varje såld biljett (undviker race).
CREATE OR REPLACE FUNCTION public.increment_tickets_sold(p_listing uuid, p_n integer DEFAULT 1)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.listings
  SET tickets_sold = COALESCE(tickets_sold, 0) + p_n
  WHERE id = p_listing;
$$;
