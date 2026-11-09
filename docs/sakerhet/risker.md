# Riskregister

Det som kan gå fel, hur troligt det är, hur illa det blir och vad vi gör åt
det. Skalan är 1–3 (låg–hög). Gås igenom varje kvartal; en ny risk läggs
till när den upptäcks, inte när den inträffat.

| # | Risk | Sannolikhet | Konsekvens | Åtgärd i dag | Kvar att göra |
| --- | --- | --- | --- | --- | --- |
| 1 | Personuppgiftsläcka via felkonfigurerad RLS | 2 | 3 | RLS på alla tabeller, månadskontroll av täckning, audit maj + juni 2026, profiles-läckan stängd | Staging-databas för preview så prod-DB inte delas |
| 2 | Produktion går ner av en kodändring | 2 | 2 | PR per ändring, tester, `next build` före merge, Vercel-rollback/promote | Branch protection på main påslagen 2026-11-09; CI-kontroll (tsc + tester) krävd före merge | `next build` som krävd check (behöver miljövariabler i CI) |
| 3 | Sårbarhet i beroende når besökare | 2 | 2 | Dependabot, månadskontroll skiljer runtime från byggkedja. 2026-11-09: next 15.5.29, @sentry/nextjs 10.78, sharp 0.35.5, 27 av 30 runtime-larm stängda | Accepterade tills vidare: `postcss` 8.4.31 pinnad av Next 15 (fix kräver Next 16), `joi` via passkit-generator (bara server-side Wallet-pass, ingen användarindata). Omprövas vid Next 16 |
| 4 | Konto kapat (GitHub, Vercel, Supabase, Google) | 1 | 3 | 2FA-tvång i GitHub-orgen, BankID-inloggning i appen, få konton | Verifiera 2FA i Vercel/Supabase/Google kvartalsvis, hårdvarunyckel för ägaren |
| 5 | Nyckel läcker (service role, Stripe, BankID-secret) | 1 | 3 | Hemligheter bara i Vercel/GitHub Secrets, inte i preview, fail-closed-fallbacks | Rotationsplan per nyckel (se policyer/atkomst.md) |
| 6 | Förlust av uppladdade filer | 1 | 2 | Daglig storage-backup till R2 med 30 dagars arkiv, larm vid fel | Återställningstest en gång per halvår |
| 7 | Förlust av databasen | 1 | 3 | Supabase dagliga backuper (Pro-plan), PITR ej aktivt | Pröva återställning till ny instans en gång per år |
| 8 | Fel i betalflöde (dubbelt drag, fel mottagare) | 1 | 3 | Stripe-webhook idempotent, två betalflöden dokumenterade, manuella avräkningar | Automatiska avstämningsrapporter |
| 9 | Utskick utan samtycke (GDPR/marknadsföringslagen) | 1 | 2 | Incident 2026-09-06 analyserad, dubbel opt-in för e-postföljare, samtyckesregel | – |
| 10 | Personnummer hanteras fel | 1 | 3 | Lagras hashat med BANKID_COOKIE_SECRET, skyddade kolumner via trigger, bara service-roll läser | Dual-key-rotation om hemligheten läcker |
| 11 | Enda utvecklaren faller bort | 2 | 2 | Kod i två GitHub-repon, minnen och docs, Ludvig som VD med åtkomst till bolagets konton | Skriftlig överlämningsplan med var nycklarna finns |
| 12 | Leverantör upphör eller ändrar villkor | 1 | 2 | Standardtjänster (Postgres, Next.js), export möjlig | Exportrutin för databasen testad |
