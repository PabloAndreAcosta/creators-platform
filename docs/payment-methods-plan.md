# Betalningsmetoder — plan & status

Mål: erbjuda fler betalsätt än kort i Usha Platform. Metoderna delar sig i två
spår: **wallets/metoder som rider på Stripe** (ingen eller minimal kod) och
**separata integrationer** (eget avtal + egen teknik).

## Fas 1 — Stripe-inbyggda metoder ✅ (PR #43, branch `feat/swish-klarna-payment-methods`)

Nyckelinsikt: checkout-flödena låser inte längre `payment_method_types`, så
Stripe visar automatiskt de metoder som aktiveras i Dashboard.

| Metod | Väg | Status |
|-------|-----|--------|
| Swish | Inbyggd i Stripe (engång, SEK) | ✅ Implementerad |
| Klarna | Inbyggd i Stripe (engång + prenumeration) | ✅ Implementerad |
| Apple Pay | Wallet på `card`, renderas automatiskt (Safari/iOS) | ✅ Live |
| Google Pay | Wallet på `card`, renderas automatiskt (Chrome/Android) | ✅ Inget extra kodarbete — kräver bara Dashboard-toggle |

Kodändringar (Fas 1):
- `product-checkout`: tog bort den enda hårdkodade `["card"]`-låsningen.
- `webhook`: ny `resolvePaymentMethod()` stämplar faktiskt använd metod på `payments`-raden.
- Migration `20260624_add_payment_method.sql`: additiv `payments.payment_method` (applicerad på live-DB).

### Manuella förkrav (görs i Stripe Dashboard — inget i repo)

1. **Aktivera Swish** i Dashboard → Settings → Payment methods (inkl. på Connect destination charges).
2. **Aktivera Klarna** i Dashboard → Settings → Payment methods (inkl. på Connect destination charges).
3. **Aktivera Google Pay** i Dashboard → Settings → Payment methods (oftast på som standard). Ingen domänverifiering krävs (till skillnad från Apple Pay). Rider på `card`, funkar på Connect destination charges. Visas automatiskt för användare på Chrome/Android med sparat kort — inget kodarbete kvar tack vare Fas 1.
4. **Testa i Stripe test mode** att metoderna dyker upp i varje flöde och att `payment_method` skrivs rätt, innan skarp drift. Verifiera Google Pay i Chrome (Apple Pay syns bara i Safari/iOS — samma wallet-mekanism, enhetsstyrt).

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
