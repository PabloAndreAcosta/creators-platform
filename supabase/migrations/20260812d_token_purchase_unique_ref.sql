-- ─────────────────────────────────────────────────────────────────────────────
-- SÄKERHETSFIX: dubbel kreditering av "nycklar" vid dubbla Stripe-webhooks
--
-- token_purchase-grenen i Stripe-webhooken gjorde SELECT count → INSERT. Stripe
-- levererar minst-en-gång (retries), så två samtidiga leveranser av samma
-- checkout.session.completed kunde båda se count=0 och båda infoga delta=+N →
-- dubbla nycklar för ett engångsköp. token_ledger_ref_idx är icke-unikt och
-- det enda unika indexet gäller reason='allowance' (20260615e).
--
-- Fix: unikt partiellt index på (ref) för reason='purchase'. Webhooken sväljer
-- 23505 (unique_violation) som "redan hanterad".
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rensa ev. redan dubbelkrediterade purchase-rader (behåll tidigaste id).
--    Detta korrigerar saldon som fått dubbla krediteringar innan indexet fanns.
DELETE FROM public.token_ledger a
USING public.token_ledger b
WHERE a.reason = 'purchase'
  AND b.reason = 'purchase'
  AND a.ref IS NOT NULL
  AND a.ref = b.ref
  AND a.id > b.id;

-- 2. Framtvinga en purchase-kreditering per Stripe-ref.
CREATE UNIQUE INDEX IF NOT EXISTS token_ledger_purchase_uq
  ON public.token_ledger (ref) WHERE reason = 'purchase';
