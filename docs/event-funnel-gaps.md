# Kravspec: kampanjtratt för events — tre luckor

**Bakgrund:** Testpartnern Anna Jois (event på engelska, sommar 2026) skickade ett
4-fas-flödesschema som validerar en komplett kampanjtratt. Tre delar saknas i
Usha idag. Detta dokument specar dem som byggbara enheter. Annas flöde används
som acceptans-scenario.

Annas faser: **(1)** gratis väntelista samlar namn+e-post → **(2)** hemlig
early-bird-länk (222 kr) mailas till listan, aktiv exakt 72h → **(3)** medan hon
är offline: early-bird → SLUTSÅLT automatiskt, augusti-väntelista öppnar →
**(4)** publikt biljettsläpp 10 aug.

Nuläge i koden (referens):
- `listings`: har `is_active`, `is_public`, `slug`, `event_date`, `price`, `release_to_gold_at`. **Ingen kapacitets-/sold-out-kolumn** hittad.
- E-post: Resend-infra finns (`src/lib/email/*`), men endast **transaktionellt + automatiska cron** (följar-notis i `cron/creator-event-notify`, early-bird till Guld i `lib/listings/early-bird.ts`). Ingen självbetjänings-kampanj.
- `follows`-tabell finns (publik som mailas vid nytt event) — närmaste sak till en lista, men inte en per-event väntelista.
- Cron körs hourly via GitHub Actions (Vercel Hobby = cron max 1/dag).

---

## Lucka 1 — Lead-capture väntelista per event

**Vad:** En 0-kr anmälan till en namngiven väntelista kopplad till ett specifikt
event, som samlar **namn + e-post** (även från icke-inloggade gäster), med en
enkel publik landningssida.

**Varför:** Annas fas 1 (bygg lista + FOMO) och fas 3 (augusti-väntelista). Idag
finns bara "följ kreatör", inte en per-event lista man kan mejla riktat.

**Acceptanskriterier:**
- [ ] Ny tabell `event_waitlist` (event_id, name, email, created_at, source) med RLS (host/admin läser; insert öppen via server-route, inte anon direkt).
- [ ] Publik anmälningssida per event (namn + e-post), fungerar utan inloggning.
- [ ] Dubblettskydd (samma e-post per event).
- [ ] Host ser listan + antal i dashboard; exporterbar (CSV).
- [ ] GDPR: samtyckestext + möjlighet att avregistrera.

**Beror på:** inget. Kan byggas fristående.

---

## Lucka 2 — Självbetjänings-mailutskick till egen lista

**Vad:** Host kan **skriva och skicka ett kampanjmail** (ämne + brödtext + en
länk) till en vald mottagargrupp: en event-väntelista (Lucka 1) och/eller sina
följare.

**Varför:** Annas fas 2 (skicka hemlig early-bird-länk *bara* till fas 1-listan).
Resend finns redan, men det saknas ett UI för att komponera och skicka.

**Acceptanskriterier:**
- [ ] Compose-vy: ämne, brödtext (enkel formattering), en CTA-länk.
- [ ] Mottagarval: event-väntelista, följare, eller bådadera (deduplicerat).
- [ ] Skickas via befintlig Resend-infra; respekterar `check-preferences`/avregistrering.
- [ ] Throttling/batchning (undvik Resend rate-limit) + leverans-logg per utskick.
- [ ] Förhandsvisning + testutskick till host själv innan skarpt.
- [ ] (Senare) schemalägg utskick till en framtida tidpunkt.

**Beror på:** Lucka 1 för väntelista-segmentet (följar-segment kan byggas utan).

---

## Lucka 3 — Tidsstyrd automatisering (early-bird-fönster, auto-soldout, schemalagt släpp)

**Vad:** Tidsbaserade tillståndsövergångar på ett event utan manuell handpåläggning.

**Varför:** Annas fas 2–4 medan hon är **helt offline**: early-bird aktiv exakt
72h, sedan auto-"SLUTSÅLT", och publikt släpp på utsatt datum.

**Delar:**
1. **Early-bird-prisfönster:** pris A aktivt mellan `early_bird_start` och `early_bird_end`, därefter pris B (eller stängt).
2. **Auto-status:** vid en tidpunkt (eller vid kapacitetstak) → `SLUTSÅLT`; eventet ligger kvar publikt men ej köpbart.
3. **Schemalagt publikt släpp:** `public_sale_at` öppnar ordinarie biljetter för alla (spegelvänt mot dagens `release_to_gold_at`).
4. **Kapacitet/sold-out-räknare:** saknas idag — krävs för kapacitetsbaserad utförsäljning.

**Acceptanskriterier:**
- [ ] Nya `listings`-kolumner: `early_bird_start`, `early_bird_end`, `early_bird_price`, `public_sale_at`, `capacity`, `tickets_sold` (additiv migration).
- [ ] Cron (hourly, GitHub Actions + `CRON_SECRET`) som utvärderar övergångarna idempotent.
- [ ] Checkout respekterar aktivt prisfönster + blockerar köp när SLUTSÅLT/kapacitet nådd.
- [ ] Status syns korrekt på event-sidan ("Early bird", "SLUTSÅLT", "Släpps 10 aug").
- [ ] Tidszon: allt i Europe/Stockholm; testa 72h-fönstret exakt.

**Beror på:** inget tekniskt, men levererar mest värde ihop med Lucka 1–2.

---

## Inte en lucka (noteras för Anna)
- **Engelskt event:** innehåll (titel/beskrivning/copy) är fritext → engelska OK. Men plattforms-UI (knappar, kassa, mejlmallar) är svenskt. Acceptabelt för test, men kommunicera det.
- **Hemlig länk:** ett event med `is_public=false` nås via `slug` och döljs från sök/marknadsplats — räcker troligen som "hemlig länk" i fas 2. **Verifiera** att slug-sidan inte kräver `is_public=true` innan testet.

## Förslag på ordning
Lucka 1 → Lucka 2 → Lucka 3. Under Annas test körs faserna halv-manuellt (host
opererar spakarna) och testet validerar specen ovan.
