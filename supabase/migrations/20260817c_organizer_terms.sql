-- Per-organizer purchase terms (köpvillkor). Surfaced at checkout via custom_text
-- and recorded on every PaymentIntent's metadata (terms_url) as the consent record.
-- Editable by the organizer themselves (their own content) — NOT added to the
-- privileged-column protect trigger.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_url TEXT;

COMMENT ON COLUMN public.profiles.terms_url IS
  'Organizer purchase-terms URL, shown at checkout and stamped on the charge as the consent record.';

-- ── ROLLBACK ──
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS terms_url;
