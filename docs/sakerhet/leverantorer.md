# Leverantörer och underbiträden

Vilka som behandlar personuppgifter åt Usha AB, var, och vad de kan visa upp.
Gås igenom varje kvartal (se kontrollprogram.md). Intygen hämtas från
leverantörens trust-sida; vi lagrar inte kopior.

| Leverantör | Vad de gör för oss | Personuppgifter | Region | Intyg | Avtal |
| --- | --- | --- | --- | --- | --- |
| Vercel | Hosting, edge-cache, DNS för usha.se | Alla som passerar sajten (loggar, IP) | EU-funktioner (fra1), globalt CDN | SOC 2 Type II, ISO 27001 | DPA i villkoren |
| Supabase | Databas, inloggning, fillagring | Konton, profiler, bokningar, BankID-uppgifter (hashade personnummer) | eu-central-1 (Frankfurt) | SOC 2 Type II, HIPAA | DPA i villkoren |
| Stripe | Betalningar, utbetalningar, KYC för säljare | Köpare, säljare (Connect), kortuppgifter (bara hos Stripe) | EU/USA | PCI DSS nivå 1, SOC 2 | DPA i villkoren |
| Resend | Transaktionsmejl | E-postadresser, namn, innehåll i mejl | USA/EU | SOC 2 Type II | DPA i villkoren |
| Signicat | BankID-inloggning och -verifiering | Namn, personnummer vid verifiering | Norge/EU | ISO 27001, eIDAS-kvalificerad | Avtal (se minne project_signicat_contract) |
| Google Workspace | E-post, dokument, kalender för bolaget | Kundkorrespondens | EU-datalagring valbar | ISO 27001, SOC 2 | DPA i villkoren |
| Cloudflare | Workers (cron, CRM, körjournal), R2 (storage-backup) | Backup-kopior av uppladdade filer | EU | SOC 2 Type II, ISO 27001 | DPA i villkoren |
| Sentry | Felrapporter | Tekniska fel, ev. användar-id | EU-region | SOC 2 Type II | DPA i villkoren |
| GitHub | Källkod, CI, säkerhetskontroll | Inga kunduppgifter (bara kod) | USA | SOC 2 Type II | Villkor |
| Meta / TikTok | Publicering av evenemang | Inga kunduppgifter skickas; bara våra egna inlägg | USA | – | Plattformsvillkor |
| Epassi | Friskvårdsbetalning (manuell bekräftelse) | Köparens namn syns i Epassis portal | Finland/EU | – | Leverantörsavtal |

## Regler

- En ny leverantör som ska röra personuppgifter läggs in här **innan** kopplingen går live, och får en rad i integritetspolicyn (usha.se/privacy) om den är ett underbiträde.
- Nycklar till leverantörer ligger i Vercels miljövariabler (produktion) eller GitHub Secrets, aldrig i kod eller chattar. Rotation: se policyer/atkomst.md.
- Leverantörer utanför EU: stöd i standardavtalsklausuler i deras DPA. Vid tvekan: fråga innan.
