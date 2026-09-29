# Två modeller för en lokal — och varför de aldrig får blandas

En lokal är en **avtalspart, inte en abonnent**. Därför finns ingen prisnivå för
venue längre (avvecklad 2026-09-29): villkoren för en lokal bor i
`event_revenue_shares`, inte i en prisstege.

Men det finns två helt olika sätt en kväll kan tjäna pengar på, och de ser
likadana ut utifrån. Blandas de på samma kväll blir avräkningen fel, och felet
upptäcks först när pengarna redan gått.

## Modell A — intäktsdelning

Lokalen är part i kvällens ekonomi. Usha är säljare mot deltagaren.

| | |
|---|---|
| Säljare mot slutkund | **Usha** |
| Vem betalar lokalen | Usha, ur delningen |
| Vad Usha får | sin andel av kvällen efter moms |
| Provision från kreatören | **ingen** |
| Var det bor | `event_revenue_shares` (partner_percent, vat_rate, payout_delay_days) |

Så ser Bacchi Syre ut: 50 % efter 25 % moms, utbetalning dagen efter kvällen.
Det här är Ushas faktiska affärsmodell idag — 31 av plattformens kvällar går
den här vägen.

**Viktigt:** partnerns andel räknas på **ordinarie pris**, inte på vad köparen
betalade. Ett välkomstavdrag eller en rabattkod är Ushas kostnad, inte lokalens.
Därför lagras `bookings.credit_applied_ore` separat och läggs tillbaka i
underlaget innan delningen. Glöms det bort finansierar lokalen tyst halva Ushas
marknadsföring.

## Modell B — provision

Kreatören säljer sin egen kväll. Lokalen är hyresvärd och syns inte i
plattformens pengaflöde alls.

| | |
|---|---|
| Säljare mot slutkund | **kreatören** |
| Vem betalar lokalen | kreatören, utanför plattformen |
| Vad Usha får | provision av kreatören (8/5/3 %) |
| Intäktsdelning | **ingen** |
| Var det bor | `COMMISSION_RATES` i `lib/stripe/commission.ts` |

## Regeln

**En kväll kör antingen A eller B. Aldrig båda.**

Har en kväll en rad i `event_revenue_shares` *och* en kreatör som inte är Usha,
gäller två modeller samtidigt: lokalen får sin andel av kvällen, och kreatören
får provision avdragen. Någon blir betald två gånger eller ingen gång.

Veckokontrollen (`lib/health/weekly-check.ts`) larmar på just det. Regeln heter
`blandade-modeller` och är röd.

## Att lägga upp en ny lokal

1. Fråga vilken modell som gäller. Det är en affärsfråga, inte en teknisk.
2. Modell A → lägg in `venue_revenue_share_defaults` för lokalen. Nya kvällar
   ärver den vid skapandet (trigger på `listings`).
3. Modell B → gör ingenting. Provisionen följer kreatörens nivå.
4. Kontrollera att kvällen inte fick båda. `settlement-gaps` fångar kvällar som
   saknar en regel de borde ha; `weekly-check` fångar kvällar som har för många.

## Varför ingen prisnivå

Den enda riktiga lokalen på plattformen låg på gratisnivån hela tiden och tog
50 % av kvällen. Venue-prenumerationen drog aldrig in en krona. Att ta 299 kr i
månaden av en lokal för att den ska få lägga in sina kvällar är att ta betalt
för leverans — och utbud är plattformens flaskhals, inte dess intäkt.

Plan-nycklarna `upplevelse_guld` och `upplevelse_premium` ligger kvar med
`retired: true` och pris 0. De filtreras bort ur varje prislista men går att
läsa, så att en befintlig prenumeration och webhookens plan-uppslag fortfarande
känner igen sitt id.
