-- En biljettyp kan tillhöra FLERA potter.
--
-- Första versionen lät en typ peka på en pott, vilket räckte för
-- "workshop + social". Men en kväll med tre pass — practica, workshop, social —
-- har en kombinationsbiljett som ska dra från alla tre. Med en enda koppling
-- går det inte att uttrycka, och biljetten skulle bara räknas mot ett av passen.
--
-- Potterna är dessutom rätt ställe för taket när passen ligger vid olika tider.
-- Ett gemensamt tak på evenemanget skulle blanda ihop 80 på practican med 100 på
-- socialen till en enda siffra som inte betyder något.

create table if not exists public.ticket_type_pools (
  ticket_type_id uuid not null references public.ticket_types(id) on delete cascade,
  pool_id uuid not null references public.ticket_pools(id) on delete cascade,
  primary key (ticket_type_id, pool_id)
);

comment on table public.ticket_type_pools is
  'Vilka potter en biljettyp drar från. En kombinationsbiljett tillhör flera.';

create index if not exists ticket_type_pools_pool_idx on public.ticket_type_pools(pool_id);

-- Flytta över befintliga kopplingar innan den gamla kolumnen tas ur bruk.
insert into public.ticket_type_pools (ticket_type_id, pool_id)
select id, pool_id from public.ticket_types where pool_id is not null
on conflict do nothing;

alter table public.ticket_type_pools enable row level security;
revoke all on public.ticket_type_pools from anon;

drop policy if exists "Kopplingar är läsbara" on public.ticket_type_pools;
create policy "Kopplingar är läsbara" on public.ticket_type_pools for select using (true);

drop policy if exists "Arrangören hanterar kopplingarna" on public.ticket_type_pools;
create policy "Arrangören hanterar kopplingarna"
  on public.ticket_type_pools for all
  using (exists (
    select 1 from public.ticket_types t join public.listings l on l.id = t.listing_id
     where t.id = ticket_type_pools.ticket_type_id and l.user_id = auth.uid()))
  with check (exists (
    select 1 from public.ticket_types t join public.listings l on l.id = t.listing_id
     where t.id = ticket_type_pools.ticket_type_id and l.user_id = auth.uid()));

-- Reservationen kontrollerar nu ALLA potter typen tillhör.
--
-- Potterna låses i id-ordning. Utan en bestämd ordning kan två samtidiga köp av
-- olika biljettyper låsa varsin pott och sedan vänta på varandras — en klassisk
-- dödläge, och den sortens fel dyker upp först när försäljningen tar fart.
create or replace function public.reserve_ticket(p_listing uuid, p_ticket_type uuid default null::uuid, p_n integer default 1)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  pool record; pcap integer; psold integer;
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + n > cap THEN RETURN false; END IF;

  IF p_ticket_type IS NOT NULL THEN
    -- Kontrollera potterna FÖRE typen, i id-ordning (stabil låsordning).
    FOR pool IN
      SELECT p.id, p.capacity
        FROM public.ticket_type_pools tp
        JOIN public.ticket_pools p ON p.id = tp.pool_id
       WHERE tp.ticket_type_id = p_ticket_type
       ORDER BY p.id
       FOR UPDATE OF p
    LOOP
      IF pool.capacity IS NOT NULL THEN
        SELECT coalesce(sum(coalesce(t.tickets_sold, 0)), 0) INTO psold
          FROM public.ticket_types t
          JOIN public.ticket_type_pools tp2 ON tp2.ticket_type_id = t.id
         WHERE tp2.pool_id = pool.id;
        IF psold + n > pool.capacity THEN RETURN false; END IF;
      END IF;
    END LOOP;

    SELECT capacity, coalesce(tickets_sold, 0) INTO tcap, tsold
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF tcap IS NOT NULL AND tsold + n > tcap THEN RETURN false; END IF;

    UPDATE public.ticket_types
      SET tickets_sold = coalesce(tickets_sold, 0) + n
      WHERE id = p_ticket_type;
  END IF;

  UPDATE public.listings
    SET tickets_sold = coalesce(tickets_sold, 0) + n
    WHERE id = p_listing;
  RETURN true;
END;
$function$;
