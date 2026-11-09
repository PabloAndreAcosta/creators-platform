# Loggning och övervakning

## Vad vi loggar
- **Fel:** Sentry (EU-region), gated på miljövariabel. Inga personnummer eller hemligheter i felrapporter.
- **Betalningar:** Stripe-händelser och webhook-körningar; bokningar bär Stripe-id för spårbarhet.
- **Inloggning och BankID:** Supabase auth-loggar; BankID-sessioner i egna tabeller med tidsstämpel.
- **Avtal:** `agreement_events` – vem gjorde vad, när, varifrån.
- **Drift:** Vercel request-loggar (kort retention), GitHub Actions-körningar.

## Hur länge
Leverantörernas standardretention (Vercel dagar, Sentry 90 dagar, Supabase enligt plan). Egna loggtabeller gallras enligt personuppgifter.md.

## Larm
- Backup misslyckas → mejl till teknikansvarig (GitHub Action).
- Säkerhetskontrollen varje månad → ärende + mejl, alltid, även när allt är grönt. Ett tyst larm döljer fel.
- Sentry-fel med hög frekvens → granskas samma dag.
- Larmkanaler testas skarpt när de byggs (fel-vägen körs på riktigt).

## Vem tittar
Teknikansvarig läser månadsrapporten och Sentry; VD får sammanfattning vid kvartalsgenomgången.
