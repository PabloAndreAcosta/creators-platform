# Sandlådan

En komplett lokal kopia av plattformen där betalflöden går att köra hela vägen —
checkout, webhook, databasskrivning, mejl och QR — utan att en enda krona rör
sig och utan att skarp data berörs.

## Varför den finns

Två miljöer skrev tidigare till produktionsdatabasen:

- **Preview på Vercel** hade dessutom en `sk_live`-nyckel (bytt till `sk_test`
  2026-08-22).
- **Lokal utveckling** via `.env.local`, som pekar på produktionsprojektet.

Preview duger inte som sandlåda: deployerna ligger bakom Vercel-inloggning, och
Stripe kan inte autentisera sig genom den. Testwebhooks når alltså aldrig fram,
och ett betalflöde utan webhook är bara halva flödet — sessionen skapas, men
bokningen skrivs aldrig och biljetten utfärdas aldrig.

Lokalt löser det, eftersom Stripe CLI forwardar händelser till `localhost` utan
att något exponeras publikt.

## Starta

```bash
supabase start                 # Docker-stacken (första gången: ~2 GB images)
npm run dev                    # appen mot sandlådan
npm run stripe:listen          # webhooks från Stripe test → localhost
```

`next dev` läser `.env.development.local` **före** `.env.local`, så sandlådans
värden vinner automatiskt. Din `.env.local` ligger kvar orörd.

| | |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (all utgående post) | http://127.0.0.1:54324 |

Mailpit fångar varje mejl appen skickar. Biljettmejlet med QR-koden går att
inspektera på riktigt, utan att någon mottagare får det.

## Sätta upp från noll

**1. Schemat.** Migrationerna kan *inte* bygga databasen — se avsnittet nedan.
Använd baslinjen i stället:

```bash
supabase start
docker exec -i supabase_db_creators-platform \
  psql -U postgres -d postgres < supabase/sandbox-baseline.sql
```

**2. Stripe-testobjekt.** Produktionsdatabasen refererar live-ID:n som inte
existerar i testläget, så testmotsvarigheter måste skapas:

```bash
STRIPE_SECRET_KEY=sk_test_… node scripts/seed-stripe-test.mjs
```

Skriptet vägrar köra mot en livenyckel. Klistra in pris-ID:na det skriver ut i
`.env.development.local`.

**3. Testdata.** En arrangör som får ta emot betalning, en kund, ett event och
en biljettyp:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<secret från supabase status> \
SANDBOX_STRIPE_ACCOUNT=acct_… \
node scripts/seed-sandbox.mjs
```

Skriptet vägrar köra mot något annat än en lokal Supabase.

Inloggningar som skapas:

| Roll | E-post | Lösenord |
|---|---|---|
| Arrangör | `arrangor@sandbox.test` | `sandbox-arrangor` |
| Kund | `kund@sandbox.test` | `sandbox-kund` |

Eventet hamnar på `/event/sandbox-event` med en biljett på 100 kr.

**4. Webhook-hemligheten.** `npm run stripe:listen` skriver ut ett `whsec_…` när
den startar. Lägg det som `STRIPE_WEBHOOK_SECRET` i `.env.development.local`.

## Migrationerna bygger inte schemat

Detta är känt och avsiktligt inte lagat här — det förtjänar ett eget ingrepp.

Två separata fel:

**Filnamn som verktyget ignorerar.** Ett tjugotal migrationer heter saker som
`20260722b_buddy_adult_attestation.sql`. Supabase kräver mönstret
`<timestamp>_name.sql`, och bokstaven efter datumet bryter det. CLI:t skriver
`Skipping migration …` och går vidare. Det förklarar varför databasen har 95
registrerade migrationer medan repot har 115 filer — de överhoppade måste ha
applicerats för hand.

**Kedjan saknar sin början.** Första migrationen kör `ALTER TABLE public.profiles`
utan att något skapat tabellen. Grundschemat ligger i `supabase/migration.sql`
och `full-migration.sql` i rotkatalogen, utanför migrationsmappen.

Följden: schemat existerar bara i produktionsdatabasen, och `supabase db reset`
fungerar inte. Därför baslinjefilen.

**Baslinjen driver isär över tid.** Regenerera vid behov:

```bash
supabase link --project-ref hiurrvorwqfihtdfhbhv
supabase db dump -f supabase/sandbox-baseline.sql --schema public
```

Lägg tillbaka `on_auth_user_created`-triggern sist i filen efteråt — den hänger
på `auth.users` och följer därför inte med en dump av `public`. Utan den får en
nyskapad användare ingen profilrad, och varje främmande nyckel mot `profiles`
fallerar.

## Testkort

Stripes vanliga testkort fungerar: `4242 4242 4242 4242`, valfritt framtida
utgångsdatum, valfri CVC. Fler fall — 3D Secure, nekade kort — finns på
https://docs.stripe.com/testing
