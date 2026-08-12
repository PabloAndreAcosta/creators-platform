-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX: biljettyper kringgick eventets kapacitet → obegränsad överbokning
--
-- reserve_ticket/increment_tickets_sold uppdaterade BARA ticket_types.tickets_sold
-- när en biljettyp angavs — aldrig listings.tickets_sold. Men getSaleState
-- (src/lib/listings/sale-state.ts) härleder "slutsålt" enbart från
-- listings.tickets_sold vs listings.capacity. Följd: ett event med biljettyper
-- registrerades aldrig som slutsålt och kunde säljas långt förbi lokalens
-- kapacitet (och en typ utan egen capacity var helt obegränsad).
--
-- Fixen: event-nivåns räknare (listings) rullas ALLTID upp och kontrolleras,
-- oavsett biljettyp. När en typ anges kontrolleras/uppdateras även typraden.
-- Funktionerna hålls symmetriska (reserve +N / release −N / webhookens
-- icke-reserverade count-väg) så räkningen balanserar.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ta bort den döda 2-arg-överlagringen. Den lämnades kvar av
--    20260712_ticket_types.sql, gör redeem-codes {p_listing}-anrop tvetydigt, och
--    revoke-migrationen (20260728) missade den → fortfarande anrop­bar av anon
--    (försäljnings-DoS enligt granskningen). 3-arg-varianten täcker alla anrop.
DROP FUNCTION IF EXISTS public.reserve_ticket(uuid, uuid);

-- 2. reserve_ticket: alltid enforce + inkrementera event-kapaciteten.
CREATE OR REPLACE FUNCTION public.reserve_ticket(
  p_listing uuid,
  p_ticket_type uuid DEFAULT NULL,
  p_n integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  -- Lås och kontrollera event-nivån först (stabil låsordning: listing → typ).
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + n > cap THEN RETURN false; END IF;

  -- Om en biljettyp anges: kontrollera/uppdatera även dess egen kapacitet.
  IF p_ticket_type IS NOT NULL THEN
    SELECT capacity, coalesce(tickets_sold, 0) INTO tcap, tsold
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tcap IS NOT NULL AND tsold + n > tcap THEN RETURN false; END IF;
    UPDATE public.ticket_types
      SET tickets_sold = coalesce(tickets_sold, 0) + n
      WHERE id = p_ticket_type;
  END IF;

  -- Rulla alltid upp event-räknaren så sold_out/kapacitet blir korrekt.
  UPDATE public.listings
    SET tickets_sold = coalesce(tickets_sold, 0) + n
    WHERE id = p_listing;
  RETURN true;
END;
$$;

-- 3. increment_tickets_sold: spegla reserve_ticket (alltid event-nivå, + typ).
CREATE OR REPLACE FUNCTION public.increment_tickets_sold(
  p_listing uuid,
  p_n integer DEFAULT 1,
  p_ticket_type uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_ticket_type IS NOT NULL THEN
    UPDATE public.ticket_types
      SET tickets_sold = greatest(coalesce(tickets_sold, 0) + p_n, 0)
      WHERE id = p_ticket_type;
  END IF;
  UPDATE public.listings
    SET tickets_sold = greatest(coalesce(tickets_sold, 0) + p_n, 0)
    WHERE id = p_listing;
END;
$$;

-- 4. Behåll åtkomstlåsningen (endast service_role). CREATE OR REPLACE bevarar
--    ACL, men vi återupprepar för tydlighet (matchar 20260728_revoke_ticket_rpcs).
REVOKE EXECUTE ON FUNCTION public.reserve_ticket(uuid, uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_tickets_sold(uuid, integer, uuid) FROM public, anon, authenticated;

-- 5. Engångsavstämning: historiska typförsäljningar räknade bara upp
--    ticket_types.tickets_sold. Event-räknaren = typlösa sälj (redan i
--    listings.tickets_sold) + summan av typförsäljningarna. Idag är summan 0.
UPDATE public.listings l
SET tickets_sold = coalesce(l.tickets_sold, 0) + coalesce((
  SELECT sum(coalesce(tt.tickets_sold, 0))
  FROM public.ticket_types tt
  WHERE tt.listing_id = l.id
), 0)
WHERE EXISTS (SELECT 1 FROM public.ticket_types tt WHERE tt.listing_id = l.id);
