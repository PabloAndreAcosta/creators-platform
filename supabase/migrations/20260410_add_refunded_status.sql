-- Add 'refunded' to payments status check constraint
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded'));
