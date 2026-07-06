-- Per-booking "free/comped" flag. When true, no payment is due (the creator
-- waived it — e.g. a free intro). A free booking shows no "Betala" button to the
-- customer and cannot be paid. Additive; existing bookings default to not-free.
alter table public.bookings
  add column if not exists is_free boolean not null default false;
