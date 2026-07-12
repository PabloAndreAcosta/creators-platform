-- Persist Usha's application_fee (commission + service fee) per paid ticket order
-- in öre, so the organizer settlement report reconciles accurately — including
-- once the service fee is enabled. Null/0 for free tickets.
alter table public.bookings
  add column if not exists platform_fee_amount integer;
comment on column public.bookings.platform_fee_amount is
  'Usha application_fee for this order in öre (commission + service fee). Null/0 for free tickets. Used by the organizer settlement report.';
