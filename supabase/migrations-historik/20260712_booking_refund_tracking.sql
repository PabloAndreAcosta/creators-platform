-- Refund tracking on bookings. Refunds keep the existing status='canceled'
-- convention (verify/checkin/ticket page already handle it); these columns add
-- an audit trail: when, how much (öre), and the Stripe refund id. Populated by
-- the organizer/customer refund action and reconciled by the charge.refunded
-- webhook.
alter table public.bookings
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount integer,
  add column if not exists stripe_refund_id text;
