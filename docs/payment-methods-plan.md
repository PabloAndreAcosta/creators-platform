# Betalningsmetoder — plan & status

Mål: erbjuda fler betalsätt än kort i Usha Platform. Metoderna delar sig i två
spår: **wallets/metoder som rider på Stripe** (ingen eller minimal kod) och
**separata integrationer** (eget avtal + egen teknik).

## Fas 1 — Stripe-inbyggda metoder ✅ (PR #43, branch `feat/swish-klarna-payment-methods`)

Nyckelinsikt: checkout-flödena låser inte längre `payment_method_types`, så
Stripe visar automatiskt de metoder som aktiveras i Dashboard.

| Metod | Väg | Status |
|-------|-----|--------|
| Klarna | Inbyggd i Stripe (engång + prenumeration), automatisk | ✅ Aktiverad & live |
| Google Pay | Wallet på `card`, renderas automatiskt (Chrome/Android) | ✅ Aktiverad & live |
| Apple Pay | Wallet på `card`, renderas automatiskt (Safari/iOS) | ✅ Live |
| Swish | Stripe-metod men kräver **manuell** integration (ej automatisk) | ⛔ **Blockerad av Stripe** — åtkomst pausad för nya företag (Private preview), kan ej aktiveras |

Kodändringar (Fas 1):
- `product-checkout`: tog bort den enda hårdkodade `["card"]`-låsningen.
- `webhook`: ny `resolvePaymentMethod()` stämplar faktiskt använd metod på `payments`-raden.
- Migration `20260624_add_payment_method.sql`: additiv `payments.payment_method` (applicerad på live-DB).

### Manuella förkrav (görs i Stripe Dashboard — inget i repo)

Konfiguration som gäller: plattformskontots **Default**-config (`pmc_1RTe1GFsO4M77KHOtf3yDsOR`),
eftersom alla flöden använder destination charges på plattformskontot.

1. ✅ **Klarna** — aktiverad (config `pmc_1RTe1…`).
2. ✅ **Google Pay** — aktiverad. Ingen domänverifiering krävs (till skillnad från Apple Pay). Rider på `card`, funkar på Connect destination charges. Visas automatiskt på Chrome/Android.
3. **Testa i Stripe test mode** att metoderna dyker upp i varje flöde och att `payment_method` skrivs rätt, innan skarp drift. Verifiera Google Pay i Chrome (Apple Pay syns bara i Safari/iOS — samma wallet-mekanism, enhetsstyrt).

### Swish — blockerad av Stripe ⛔

Stripe har **pausat åtkomst till Swish för nya företag** (Swish är "Private preview").
Usha kan därför **inte** aktivera Swish via Dashboard just nu — det är inte en kod- eller
toggle-fråga, utan en spärr hos Stripe. Källa: https://docs.stripe.com/payments/swish

Vad som gäller när/om åtkomst öppnar igen:
- Anmäl intresse för avisering: https://docs.stripe.com/payments/swish (formuläret "Interested in getting access to Swish?").
- Swish kräver **manuell** integration — explicit `payment_method_types: ['swish']` i SEK-engångsflöden (inte automatisk som Klarna/wallets).
- Engång endast (ingen prenumeration). Connect destination charges stöds. Stripe är merchant of record. Dans/rörelse är inte i någon förbjuden bransch.
- Kodändring som då krävs: villkorligt lägga till `swish` i `payment_method_types` för SEK + engångsläge i checkout-route(s). Webhookens `resolvePaymentMethod()` hanterar redan `swish`-strängen.

Alternativ väg (om Swish blir affärskritiskt innan Stripe öppnar): direktintegration mot
Getswish AB (Swish Handel) — separat bankavtal + certifikat + callbacks, helt utanför Stripe.
Stor lift, behandlas som eget spår (jfr Epassi).

## Fas 2 — Epassi (friskvård) 📋 (kräver partneravtal)

Epassi är **inte** en Stripe-metod — det är en separat friskvårdsintegration.
Kunden betalar med friskvårdsbidrag i Epassi, som settlar mot Usha via
faktura/utbetalning — inte via Stripe Connect.

Förkrav innan teknik kan byggas:
- Ansök som friskvårds-merchant via Epassis leverantörsformulär:
  `https://services.epassi.se/ui/merchant-onboarding/new-service-provider/select-service-type?l=sv_SE`
  (Onboardas **inte** via e-post. Utkast/underlag finns som Gmail-självnotis.)
- Klargör onboarding-modell: plattformsnivå (en relation) vs per-kreatör.
- Säkerställ att endast friskvårdsgodkända aktiviteter säljs via Epassi (SNI-koder, marknadsföringskrav).
- Få API-credentials / klargör om flödet är API eller webbportal/kvittohantering.
- Klargör settlement (hur/när Usha betalas, avgifter) och vidarefördelning till kreatörer.

Teknisk plan detaljeras när avtal + credentials finns.
