--
-- Kortkassan räknar med vilande Swish-köp (Pablo 2026-11-25).
--
-- Ett Swish-köp från eventsidan ligger som en vilande bokning (status pending,
-- payment_method swish) tills entrén bekräftar kvittot; först då räknas det i
-- tickets_sold. reserve_ticket såg bara tickets_sold, så ett kortköp kunde ta
-- en plats som en Swish-gäst redan räknade med. Nu dras de vilande Swish-
-- platserna av på alla tre nivåerna: kvällen, biljettpoolen och biljettypen.
-- Samma räkning som src/lib/swish/seats.ts gör åt Swish-vägen.
--
-- Bakåtkompatibel: samma signatur och returtyp, ingen kod behöver ändras.
--

CREATE OR REPLACE FUNCTION public.pending_swish_seats(p_listing uuid, p_ticket_types uuid[] DEFAULT NULL::uuid[]) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(sum(greatest(coalesce(b.guest_count, 1), 1)), 0)::integer
    FROM public.bookings b
   WHERE b.listing_id = p_listing
     AND b.payment_method = 'swish'
     AND b.status = 'pending'
     AND (p_ticket_types IS NULL OR b.ticket_type_id = ANY (p_ticket_types));
$$;

ALTER FUNCTION public.pending_swish_seats(uuid, uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.pending_swish_seats(uuid, uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pending_swish_seats(uuid, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid DEFAULT NULL::uuid, p_n integer DEFAULT 1) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  pool record; psold integer; ptypes uuid[];
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + public.pending_swish_seats(p_listing) + n > cap THEN RETURN false; END IF;

  IF p_ticket_type IS NOT NULL THEN
    FOR pool IN
      SELECT p.id, p.capacity
        FROM public.ticket_type_pools tp
        JOIN public.ticket_pools p ON p.id = tp.pool_id
       WHERE tp.ticket_type_id = p_ticket_type
       ORDER BY p.id
       FOR UPDATE OF p
    LOOP
      IF pool.capacity IS NOT NULL THEN
        SELECT coalesce(sum(coalesce(t.tickets_sold, 0)), 0), array_agg(t.id) INTO psold, ptypes
          FROM public.ticket_types t
          JOIN public.ticket_type_pools tp2 ON tp2.ticket_type_id = t.id
         WHERE tp2.pool_id = pool.id;
        IF psold + public.pending_swish_seats(p_listing, ptypes) + n > pool.capacity THEN RETURN false; END IF;
      END IF;
    END LOOP;

    SELECT capacity, coalesce(tickets_sold, 0) INTO tcap, tsold
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tcap IS NOT NULL AND tsold + public.pending_swish_seats(p_listing, ARRAY[p_ticket_type]) + n > tcap THEN RETURN false; END IF;

    UPDATE public.ticket_types
      SET tickets_sold = coalesce(tickets_sold, 0) + n
      WHERE id = p_ticket_type;
  END IF;

  UPDATE public.listings
    SET tickets_sold = coalesce(tickets_sold, 0) + n
    WHERE id = p_listing;
  RETURN true;
END;
$$;

ALTER FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_ticket(p_listing uuid, p_ticket_type uuid, p_n integer) TO service_role;
