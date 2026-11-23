-- Atomic seat reservation to prevent oversell under concurrency.
--
-- Previously capacity was checked from a stale getSaleState() read and the seat
-- counted only later, so N concurrent buyers could all pass the check for the
-- last seat. reserve_ticket() locks the listing row (FOR UPDATE), re-checks
-- capacity, and increments in the same transaction — returns false when full.
-- Used by the free ticket paths; the paid Stripe paths still reserve at webhook
-- time (a full paid-path reservation needs release-on-expiry — follow-up).
create or replace function public.reserve_ticket(p_listing uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cap  integer;
  sold integer;
begin
  select capacity, coalesce(tickets_sold, 0)
    into cap, sold
    from public.listings
   where id = p_listing
   for update;

  if cap is not null and sold >= cap then
    return false;
  end if;

  update public.listings
     set tickets_sold = coalesce(tickets_sold, 0) + 1
   where id = p_listing;

  return true;
end;
$function$;
