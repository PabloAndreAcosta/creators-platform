-- Track which payment method the customer used (card / swish / klarna / …).
-- Additive + nullable: existing rows stay NULL ("unknown"), nothing is backfilled.
-- Populated by the Stripe webhook from the PaymentIntent's latest charge.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT;

COMMENT ON COLUMN public.payments.payment_method IS
  'Stripe payment_method_details.type used for this payment (e.g. card, swish, klarna). NULL = unknown/no charge.';
