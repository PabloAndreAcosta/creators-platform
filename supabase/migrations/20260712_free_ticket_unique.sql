-- Atomic dedup for FREE tickets: one active free ticket per account per event.
-- Backs the free-ticket existence check so a concurrent double-request can't
-- create two. Scoped to amount_paid=0 so it never blocks a PAID booking created
-- after payment (which would strand the charge). Applied to prod.
create unique index if not exists bookings_free_ticket_customer_key
  on public.bookings (listing_id, customer_id)
  where booking_type = 'ticket' and amount_paid = 0 and customer_id is not null and status <> 'canceled';
