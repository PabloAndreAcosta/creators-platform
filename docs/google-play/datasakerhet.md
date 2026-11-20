# Google Play – Datasäkerhet (Data safety)

Svar till formuläret Appinnehåll → Datasäkerhet. Kontrollerat mot databasen och koden 2026-11-20. Ändras det vi samlar in måste formuläret uppdateras.

## Allmänna frågor

| Fråga | Svar |
|---|---|
| Samlar appen in eller delar några av de obligatoriska användardatatyperna? | Ja |
| Krypteras all data under överföring? | Ja (endast HTTPS) |
| Kan användare begära att deras data raderas? | Ja – i appen under Inställningar → Konto, och via pablo.acosta@usha.se |
| Webbadress för radering av konto | https://usha.se/app/settings/account |

## Datatyper

"Delas" = överförs till tredje part för deras egna syften. Tjänsteleverantörer som behandlar data åt oss (Supabase, Vercel, Stripe som betalförmedlare, Resend för mejl, Sentry, Google Analytics) räknas enligt Googles definition inte som delning, med undantag som anges nedan.

| Datatyp (Googles kategori) | Samlas in | Delas | Valfritt | Syfte | Källa i systemet |
|---|---|---|---|---|---|
| Namn | Ja | Ja – med arrangören du köper biljett av | Nej | Appfunktioner, Kontohantering | profiles, bookings.guest_name |
| E-postadress | Ja | Ja – med arrangören du köper biljett av | Nej | Appfunktioner, Kontohantering, Kommunikation från utvecklaren | auth.users, bookings.guest_email |
| Telefonnummer | Ja | Nej | Ja | Appfunktioner | profiles.contact_phone |
| Andra ID-nummer (personnummer via BankID) | Ja | Nej | Ja (bara vid BankID) | Kontohantering, Bedrägeribekämpning/säkerhet | profiles.bankid_personal_number |
| Ungefärlig plats | Ja | Nej | Ja (bara Träningsvänner) | Appfunktioner | training_buddy_profiles |
| Foton | Ja | Nej | Ja | Appfunktioner (profilbild, evenemangsbild) | Supabase Storage |
| Meddelanden i appen | Ja | Nej | Ja | Appfunktioner | messages |
| Annat användargenererat innehåll (inlägg, recensioner) | Ja | Nej | Ja | Appfunktioner | posts, reviews |
| Köphistorik | Ja | Nej | Nej | Appfunktioner, Kontohantering | bookings |
| Betalinformation (kortnummer) | **Nej** – hanteras helt av Stripe, når aldrig Usha | – | – | – | – |
| Appinteraktioner | Ja | Nej | Ja (samtycke i cookie-rutan) | Analys | Google Analytics 4 |
| Kraschloggar / diagnostik | Ja | Nej | Nej | Appfunktioner (felsökning) | Sentry (EU) |
| Enhets-ID / andra ID | Ja (push-prenumeration) | Nej | Ja | Appfunktioner (notiser) | push_subscriptions |

## Säkerhetspraxis att kryssa i

- Data krypteras under överföring: **Ja**
- Användare kan begära radering: **Ja**
- Följer Families-policyn: **Ej tillämpligt** (appen riktar sig till 18+)
- Oberoende säkerhetsgranskning: **Nej**

## Att stämma av före inlämning

- Google Analytics: kontrollera att GA bara laddas efter samtycke även i appen (samma cookie-ruta som webben).
- Om Web Push ersätts av FCM i appen tillkommer Firebase som tjänsteleverantör.
