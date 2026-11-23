-- Delad kapacitet mellan biljettyper.
--
-- En kväll kan innehålla ett moment som rymmer färre än lokalen. Bacchi:
-- workshoppen tar 20, rummet 100. Biljettypen "Workshop" och "Workshop +
-- social" ska båda ta från samma 20 platser — annars kan 20 + 20 sälja in 40
-- personer i ett rum för 20.
--
-- Rummets tak fanns redan: listings.capacity räknas upp av VARJE biljett
-- oavsett typ. Det som saknades var en mindre pott inuti, som bara vissa typer
-- drar från.
--
-- Potten har ingen egen såldräknare. Antalet sålda summeras ur medlemstyperna
-- vid varje reservation, under lås. En denormaliserad räknare till hade kunnat
-- glida isär från typernas egna, och två motstridiga svar på "hur många platser
-- finns kvar" är värre än en summering.

create table if not exists public.ticket_pools (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  unique (listing_id, name)
);

comment on table public.ticket_pools is
  'Kapacitet som flera biljettyper delar på, t.ex. en workshop med färre platser än lokalen. Sålda summeras ur ticket_types, potten har ingen egen räknare.';

alter table public.ticket_types
  add column if not exists pool_id uuid references public.ticket_pools(id) on delete set null;

create index if not exists ticket_types_pool_idx on public.ticket_types(pool_id) where pool_id is not null;

alter table public.ticket_pools enable row level security;
revoke all on public.ticket_pools from anon;

-- Potterna är en del av evenemanget och ska kunna läsas av den som ser
-- evenemanget — annars går det inte att visa "3 platser kvar" för en besökare.
drop policy if exists "Potter är läsbara" on public.ticket_pools;
create policy "Potter är läsbara"
  on public.ticket_pools for select using (true);

drop policy if exists "Arrangören hanterar sina potter" on public.ticket_pools;
create policy "Arrangören hanterar sina potter"
  on public.ticket_pools for all
  using (exists (select 1 from public.listings l where l.id = ticket_pools.listing_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = ticket_pools.listing_id and l.user_id = auth.uid()));

-- Reservationen får ett tredje steg. Låsordningen är listing → pott → typ och
-- är densamma överallt, så två samtidiga köp inte kan låsa varandra.
create or replace function public.reserve_ticket(p_listing uuid, p_ticket_type uuid default null::uuid, p_n integer default 1)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  cap integer; sold integer;
  tcap integer; tsold integer;
  v_pool uuid; pcap integer; psold integer;
  n integer := greatest(coalesce(p_n, 1), 1);
BEGIN
  -- Lås och kontrollera event-nivån först (stabil låsordning: listing → pott → typ).
  SELECT capacity, coalesce(tickets_sold, 0) INTO cap, sold
    FROM public.listings WHERE id = p_listing FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cap IS NOT NULL AND sold + n > cap THEN RETURN false; END IF;

  IF p_ticket_type IS NOT NULL THEN
    SELECT capacity, coalesce(tickets_sold, 0), pool_id INTO tcap, tsold, v_pool
      FROM public.ticket_types
      WHERE id = p_ticket_type AND listing_id = p_listing FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    -- Delad pott: summera vad ALLA typer i potten sålt, inte bara den här.
    -- Låset på pottraden gör att två samtidiga köp av olika typer i samma pott
    -- inte kan räkna på samma gamla summa och tillsammans spränga taket.
    IF v_pool IS NOT NULL THEN
      SELECT capacity INTO pcap FROM public.ticket_pools WHERE id = v_pool FOR UPDATE;
      IF FOUND AND pcap IS NOT NULL THEN
        SELECT coalesce(sum(coalesce(tickets_sold, 0)), 0) INTO psold
          FROM public.ticket_types WHERE pool_id = v_pool;
        IF psold + n > pcap THEN RETURN false; END IF;
      END IF;
    END IF;

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
