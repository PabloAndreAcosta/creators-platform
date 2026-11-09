# Personuppgifter (GDPR)

## Roller
- **Usha AB är personuppgiftsansvarig** för konton, bokningar, betalningshistorik, avtal och kommunikation på plattformen.
- Kreatörer och lokaler ser bara det de behöver för sina egna evenemang; deltagarlistor lämnas inte ut – lokalkoppling kräver lokalens godkännande.
- Leverantörerna i `leverantorer.md` är personuppgiftsbiträden.

## Rättslig grund
- Avtal: konto, köp, biljett, avtal mellan parter.
- Rättslig förpliktelse: bokföring (7 år), skatterapportering.
- Berättigat intresse: säkerhet, felsökning, statistik (GA4 bara efter samtycke).
- Samtycke: marknadsföring (dubbel opt-in för e-postföljare), cookies utöver nödvändiga.

## Registerförteckning (art. 30)
| Behandling | Uppgifter | Grund | Lagring | Var |
| --- | --- | --- | --- | --- |
| Konto och profil | Namn, e-post, roll, bild, språk | Avtal | Tills kontot raderas | Supabase (EU) |
| BankID-verifiering | Namn, födelsedatum, personnummer (hashat) | Avtal/berättigat intresse (identitet) | Tills kontot raderas | Supabase (EU), Signicat |
| Bokningar och biljetter | Namn, e-post, belopp, incheckning | Avtal, bokföring | 7 år (ekonomi), anonymiseras vid radering | Supabase, Stripe |
| Betalningar | Stripe-id, belopp | Avtal, bokföring | 7 år | Stripe |
| Avtal | Parter, text, signaturer med IP | Avtal | Så länge avtalet gäller + 10 år | Supabase |
| Meddelanden och notiser | Innehåll, mottagare | Avtal | Tills kontot raderas | Supabase, Resend |
| E-postföljare | E-post, bekräftelse | Samtycke | Tills avregistrering | Supabase, Resend |
| Volontärer/taxipass | Namn, pass, varningar | Avtal | 6 månader efter sista pass | Supabase |
| Felrapporter | Tekniska data, ev. användar-id | Berättigat intresse | 90 dagar | Sentry (EU) |
| Analys | Pseudonyma händelser | Samtycke | 14 månader | Google Analytics |

## Rättigheter
Registerutdrag, rättelse, export och radering via appen (Mitt konto) eller privacy@usha.se. Radering = mjuk radering + anonymisering; bokföringsunderlag behålls lagstadgad tid utan koppling till person.

## Gallring
Konton utan aktivitet i 3 år får påminnelse och raderas efter 3 månader utan svar (rutin att bygga – risk att lägga till). Loggtabeller enligt retention ovan.

## Konsekvensbedömning
Behandling av personnummer bedöms som känslig i omfattning men inte i art (identifiering, ingen profilering). Åtgärder: hashning, skyddade kolumner, bara service-roll läser, BankID via kvalificerad leverantör. Omprövas om ny behandling tillkommer.
