# Säkerhetsprogrammet för Usha Platform

Det här är vårt svar på frågan "hur vet ni att ni har ordning?" – samma fråga
som ett SOC 2- eller ISO 27001-arbete besvarar, men i vår storlek och utan
licens. Principen är densamma som i verktyg som Vanta: **kontrollerna är
nedskrivna, de mäts automatiskt, och bevisen får tidsstämpel.**

Vi är ett litet svenskt bolag på Vercel, Supabase och Stripe. Det som gäller
oss på riktigt är GDPR och att en lokal, ett företag eller en partner ska kunna
lita på oss. Den dagen någon kräver ett SOC 2-intyg finns bevisen redan här;
då köper vi revisionen, inte förarbetet.

## Vad som kontrolleras automatiskt

`.github/workflows/sakerhetskontroll.yml` kör `scripts/sakerhetskontroll.mjs`
den 1:a varje månad (och för hand via *Run workflow*). Resultatet blir ett
GitHub-ärende med etiketten **säkerhetskontroll** – det är bevisarkivet – och
ett mejl till pablo.acosta@usha.se.

| Område | Kontroll | Grönt när |
| --- | --- | --- |
| GitHub | Skydd på main | PR krävs, gäller admins, force-push och radering blockerade |
| GitHub | Sårbarheter | Inga öppna kritiska/höga i runtime-beroenden (byggkedjan blir gult) |
| GitHub | Skrivrätt i repot | Högst tre konton – listan är underlaget för åtkomstgenomgången |
| GitHub | 2FA-tvång i organisationen | På |
| GitHub | Storage-backup | En grön körning de senaste åtta dagarna |
| GitHub | Gamla PR | Inga öppna äldre än 30 dagar |
| Databas | RLS | Alla tabeller i `public` har RLS |
| Databas | Policies | Ingen tabell har RLS utan policy (eller så är det avsiktligt) |
| Databas | Security definer | Antalet listas; varje ny granskas i PR |
| Vercel | Teammedlemmar | Högst tre |
| Vercel | Hemligheter i preview | Inga produktionshemligheter delas med preview |
| Sajten | Säkerhetsheaders | HSTS ≥ 1 år, nosniff, frame-options, referrer-policy, CSP |
| Sajten | Juridiska sidor | /privacy, /terms, /cookies svarar 200 |
| E-post | SPF, DKIM, DMARC | SPF med -all/~all, DKIM för Resend, DMARC p=reject (quarantine = gult) |

"Ej kontrollerat" betyder att nyckeln saknas – det räknas aldrig som grönt.

## Vad som görs för hand

Varje kvartal (molnrutinen påminner):

1. **Åtkomstgenomgång.** Gå igenom konton med åtkomst till GitHub, Vercel,
   Supabase, Stripe, Resend, Cloudflare, Google Workspace och Signicat. Ta
   bort det som inte behövs. Skriv datum och resultat i kvartalets ärende.
2. **Google Workspace.** 2FA-tvång på, inga delade inloggningar, vidarebefordringsregler kända.
3. **Leverantörer.** `leverantorer.md` stämmer: vilka behandlar personuppgifter,
   var finns deras intyg (SOC 2 / ISO 27001) och personuppgiftsbiträdesavtal.
4. **Risker.** `risker.md` genomgånget: nya risker, ändrade bedömningar.

Vid incident: `incidenter/` får en fil per händelse enligt mallen i
`incidenter/README.md`. Personuppgiftsincident som kan medföra risk anmäls till
IMY inom 72 timmar.

## Var saker finns

- Policyer: `docs/sakerhet/policyer/` – korta, på svenska, det vi faktiskt gör.
- Leverantörer och underbiträden: `docs/sakerhet/leverantorer.md`.
- Riskregister: `docs/sakerhet/risker.md`.
- Incidenter: `docs/sakerhet/incidenter/` (första: marknadsförings-samtycket 2026-09-06, se `docs/marketing-consent-incident-2026-09-06.md`).
- Offentlig sida: usha.se/sakerhet (Trust Center) – det en kund ska behöva läsa.

## Så lägger man till en kontroll

Skriv den i tabellen ovan först, sedan i `scripts/sakerhetskontroll.mjs`
(`add(område, namn, läge, detalj)`). En kontroll som inte står här är ingen
kontroll – den går inte att visa upp.
