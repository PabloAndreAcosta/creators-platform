# En Supabase-gren per PR

Varje PR mot `main` får en egen tillfällig databas (en Supabase-gren). Grenen
byggs från noll med repots migrationer och `supabase/seed.sql`, och Vercels
förhandsversion av PR:en pratar med den i stället för produktionsdatabasen.
Grenen raderas när PR:en stängs eller mergas. Pris: 0,01344 USD per timme och
gren, bara medan PR:en är öppen (godkänt av Pablo 2026-11-23).

## Hur det hänger ihop

| Del | Var | Vad |
|---|---|---|
| Baslinjen | `migrations/20261123120000_baslinje.sql` | Hela schemat `public` + triggern på `auth.users`, lagringsbuckets och policyerna på `storage.objects`. |
| Nya migrationer | `migrations/ÅÅÅÅMMDDttmmss_namn.sql` | Allt efter 2026-11-23. Testerna (`scripts/db/db.test.ts`) underkänner andra namn och dubbla versioner. |
| Gamla migrationer | `migrations-historik/` | Historik. Körs inte. |
| Testdata | `seed.sql` | Två påhittade konton, ett event, en biljettyp. Inga personuppgifter. |
| Spärren | `scripts/db/preview-vakt.cjs` (anropas från `next.config.js`) | Med `SUPABASE_PREVIEW_KRAV_GREN=1` i Vercels Preview misslyckas ett förhandsbygge som pekar på produktionen. |
| Auth | `config.toml` | Vercels förhandsadresser får ta emot inloggningen. Ingen `[remotes]` för produktionen, så en merge ändrar aldrig produktionens inställningar. |

Supabase skriver grenens `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
och `SUPABASE_SERVICE_ROLE_KEY` i Vercel, för PR:ens git-gren. Hinner Vercel
börja bygga innan dess stoppar spärren bygget, och Supabase bygger om den senaste
deployen av PR:en när grenen är klar.

## Varför en baslinje

De gamla migrationerna kunde inte bygga databasen. Ett fyrtiotal filer hade namn
som Supabase tyst hoppar över (`20260722b_…`) eller delade version med en annan
fil (`20261029_…` flera gånger), kedjan saknade början, och sex ändringar fanns
bara i produktionen. Baslinjen är därför byggd så här (2026-11-23):

1. `sandbox-baseline.sql` (schemat från 2026-08-26) + produktionens 95 migrationer
   efter den, i produktionens ordning, i en isolerad Postgres 17.6 på Hjärnan.
   De sex som saknades i repot hämtades ur `supabase_migrations.schema_migrations`.
2. Katalogen jämfördes med produktionens (läsfrågor via Supabase-MCP): kolumner,
   villkor, index, policyer, funktioner och deras rättigheter, tabell- och
   kolumnrättigheter, triggrar, buckets. Skillnaderna rättades.
3. `pg_dump --schema-only --schema=public` → `node scripts/db/bygg-baslinje.mjs`.
4. Kontroll från noll: baslinje + seed i en ny databas, katalogen jämförd igen.

Resultat: 1114 kolumner, 311 index, 178 policyer, 37 funktioner med rättigheter,
108 tabeller och 53 kolumnrättigheter, 16 triggrar och 5 buckets är identiska med
produktionen. Fyra CHECK-villkor (`profiles_tier_check`, `listings_event_tier_check`,
`payouts_payout_type_check`, `payouts_status_check`) skiljer sig bara i hur
Postgres skriver ut typomvandlingen i `ANY (ARRAY[…])`; innebörden är densamma.

**Bygga om baslinjen** (t.ex. från Hjärnans nattliga schemadump):

```bash
node scripts/db/bygg-baslinje.mjs <pg_dump --schema-only --schema=public>.sql --kalla "<varifrån>"
```

## Klicklista för Pablo (en gång) – gjord 2026-11-23

Ordningen spelar roll: Vercel-kopplingen före GitHub-kopplingen, så att den första
grenen genast får sina värden i Vercel.

**A. Vercel-integrationen (inga produktionsnycklar)**
1. Börja i Supabase, inte på Vercels marknadsplats (där kan *Install* skapa ett nytt
   projekt): *Organization → Integrations → Vercel → Install Vercel integration* →
   välj teamet (`team_ssuhhfNoi9tKLMbWX3PmjnaI`) och bara projektet `creators-platform`.
2. Kopplingen Supabase-projektet `hiurrvorwqfihtdfhbhv` ↔ Vercel-projektet
   `creators-platform` (*Add project connection*).
3. *Project Settings → Integrations → Vercel → Edit* vid kopplingen: **alla tre
   (Production, Preview, Development) AV**, spara. Knapparna styr var *produktionens*
   nycklar skrivs; grenarnas nycklar skickas till Preview oberoende av dem. Med
   Production på skriver integrationen tolv extra variabler (bl.a. `POSTGRES_PASSWORD`,
   `SUPABASE_SECRET_KEY`) i Vercels Production och kan skriva över den egna
   auth-domänen i `NEXT_PUBLIC_SUPABASE_URL`. Det hände vid installationen 2026-11-23;
   variablerna togs bort direkt.

**B. GitHub-integrationen och grenarna**
4. Supabase → projektet → *Project Settings → Integrations → GitHub → Connect GitHub*;
   ge åtkomst bara till repot `usha-ab/creators-platform`.
5. Inställningar i kopplingen:
   - *Working directory*: `.` (mappen som innehåller `supabase/`)
   - *Deploy to production*: **AV** (produktionen migreras som förut, för hand)
   - *Automatic branching*: **PÅ**
   - *Branch limit*: 3
   - *Supabase changes only*: **AV** (varje PR får en gren)
6. *Enable integration*. Ingen gren skapas förrän en PR öppnas eller uppdateras.
   Grenarnas beräkningskostnad omfattas inte av organisationens Spend Cap.

**C. Spärren i Vercel**
7. Vercel → creators-platform → *Settings → Environment Variables → Add*:
   namn `SUPABASE_PREVIEW_KRAV_GREN`, värde `1`, miljö **Preview** (alla grenar).
   Inte hemlig. Gör det först när verifieringen nedan visat att grenarna får sina värden.

**D. Säg till**, så verifierar utvecklaren (se nedan).

## Verifiering efter klicken

1. Öppna eller uppdatera en PR. Kontrollen *Supabase Preview* ska bli grön på PR:en.
2. `list_branches` (Supabase-MCP) visar en gren med PR:ens git-gren.
3. Vercel → PR:ens git-gren har egna Preview-värden för `NEXT_PUBLIC_SUPABASE_URL`
   (adressen innehåller grenens ref, inte `hiurrvorwqfihtdfhbhv`).
4. Förhandsversionen: logga in som `kund@sandbox.test` / `sandbox-kund` och öppna
   `/event/sandbox-event`. Det kontot finns bara i grenen.
5. Produktionens miljövariabler i Vercel är oförändrade (tidsstämplarna).
6. Stäng PR:en → grenen försvinner ur `list_branches`.

## Kvar att bestämma efteråt

- Ta bort produktionens `SUPABASE_SERVICE_ROLE_KEY` och övriga skarpa nycklar ur
  Preview när grenarna fungerar (preview har dem sedan 2026-06-16).
- `supabase migration repair --status applied 20261123120000` mot produktionen
  behövs bara om någon börjar köra `supabase db push`. Det skriver i produktionens
  migrationstabell och kräver Pablos ja.
