-- Ticketing service fee ("Tickster"-style): per-event choice of who pays Usha's
-- per-ticket service fee. 'buyer' = added on top at checkout; 'absorb' = deducted
-- from the organizer's payout. In both cases the fee stays with Usha via the
-- Stripe application_fee. The fee itself is gated OFF until
-- NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED=true (VAT/legal to confirm first).
alter table public.listings
  add column if not exists service_fee_mode text not null default 'buyer'
  check (service_fee_mode in ('buyer','absorb'));
