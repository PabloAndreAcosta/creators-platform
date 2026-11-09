# Säker utveckling

## Vägen till produktion
1. Varje ändring på egen gren, en pull request per uppgift.
2. Automatiska tester (vitest, ~1 400 st), typkontroll och lint måste vara gröna.
3. Nya rutter: `next build` lokalt före merge (en ruttkrock tog ner hela sajten 2026-11-06).
4. Huvudgrenen `main` är skyddad: PR krävs, gäller även admins, ingen force-push.
5. Squash-merge → Vercel bygger och deployar. En merge i taget; verifiera på usha.se innan nästa.
6. Rollback: `vercel promote` till föregående deploy (rollback når bara ett steg bakåt på vår plan).

## Kodregler som skyddar data
- Server-side-kontroll av behörighet i varje API-rutt; klienten litar vi aldrig på.
- Service-rollen bara i API-rutter och webhooks, aldrig i klientkod. Preview har den inte.
- Indata valideras (UUID-mönster, längder, tillåtna värden) innan databasen.
- Ingen hemlighet, personnummer eller kortnummer i loggar.
- Beroenden: Dependabot bevakar. Kritiska/höga larm i runtime-beroenden åtgärdas inom 14 dagar; byggkedjan vid nästa tillfälle.
- Säkerhetsheaders (HSTS, CSP, nosniff, frame-options) sätts centralt och kontrolleras månadsvis.

## Granskning
En utvecklare i dag. Kompenserande kontroller: tester, typer, bygge, automatisk säkerhetskontroll, och att AI-assistenten alltid arbetar via PR som människan godkänner med "merga".
