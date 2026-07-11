-- Ticket capacity & idempotency hardening (from the swarm audit).

-- 1) Clamp tickets_sold at 0 so decrementing on cancellation/refund can never
--    drive the counter negative.
create or replace function public.increment_tickets_sold(p_listing uuid, p_n integer default 1)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.listings
  set tickets_sold = greatest(coalesce(tickets_sold, 0) + p_n, 0)
  where id = p_listing;
$function$;

-- 2) Make paid-booking webhook idempotency atomic: a duplicate Stripe delivery
--    that races past the SELECT-count guard now fails the INSERT instead of
--    creating a second booking. Partial (only where a payment id exists).
create unique index if not exists bookings_stripe_payment_id_key
  on public.bookings (stripe_payment_id)
  where stripe_payment_id is not null;
