# Ändringshantering

Gäller allt som inte är kod via PR: databasen, leverantörsinställningar,
DNS, miljövariabler, behörigheter.

- **Databas:** varje schemaändring är en migration i `supabase/migrations/` som också körs mot produktion. Destruktiva ändringar (radera, uppdatera många rader) föregås av en lista på vad som berörs och en torrkörning.
- **Miljövariabler:** sätts i Vercel per miljö. Värdet skrivs aldrig i chatt eller dokument. Efter ändring: verifiera i målsystemet.
- **DNS och e-post:** ändringar i Vercel DNS dokumenteras i commit eller minne; SPF/DKIM/DMARC kontrolleras automatiskt varje månad.
- **Leverantörer:** ny leverantör som rör personuppgifter → rad i `leverantorer.md` och i integritetspolicyn innan den går live.
- **Behörigheter:** ändras bara av VD eller teknikansvarig; loggas i kvartalets säkerhetskontroll-ärende.

Alla ändringar ska gå att svara på: vad, när, vem, varför – ur git, Supabase migrationshistorik eller ärenden.
