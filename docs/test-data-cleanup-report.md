# Testdata-rapport — usha.se (2026-06-14)

> **Borttagning (2026-06-14):** Test­kontot **"Test Kreatör"** (`testgrupp@usha.se`) och den trasiga **Kiz Lab-dubbletten** (`8d1e2773`) är nu **hård-raderade** (migration `20260614c`), men reversibelt: alla 14 rader (profil + 5 listings + 7 bokningar + dubblett) backades upp till `public.archived_deleted_rows` (jsonb, RLS-låst) före DELETE. Footprint var ren (0 reviews/posts/follows/payments/prenumerationer; bokningarna var självbokningar + ditt "Pablo Test"-altkonto). Efter: **19 konton** (alla riktiga behållna), **3 aktiva listings — alla "The Kiz Lab"**. Auth-login för testkontot borttaget.
>
> **Uppdaterad policy (2026-06-14):** Behåll ALLA konton (radera/rör ingen profil). Ta bort allt event-innehåll utom **The Kiz Lab** — endast det är aktuellt. Genomfört via en andra reversibel migration (`20260614b_only_kizlab_listings`) som arkiverade de återstående icke-Kiz-Lab-listsen (Kroppskontroll, Practica, Privat danslektion, Värdskap). Efter detta: **20 konton kvar**, **4 aktiva listings — alla "The Kiz Lab"**, 0 övriga. OSÄKER-frågan nedan är därmed besvarad: inga konton rörs; allt övrigt event-innehåll arkiverat.


Mål: ingen test-/seed-/placeholderdata synlig publikt (/marketplace, /upplevelser, /creators) eller i sökmotorer.

Metod: hela `profiles` (20) och `listings` (16) genomgångna manuellt (litet dataset). Inga committade seeds/fixtures i repot (raden `INSERT INTO public.profiles` i `migration.sql` är signup-triggern `handle_new_user`, inte seed-data). Publika ytor + sitemap filtrerar `listings.is_active=true` och `profiles.is_public=true` → reversibel soft-delete via flaggor + arkiv-markör räcker för att dölja allt.

---

## 🔴 TYDLIGT TEST — soft-arkiverat i denna PR (reversibelt, inga hårda DELETE)

### Profil
| id | namn | e-post | publik | bankid | created | listings | klassning |
|---|---|---|---|---|---|---|---|
| `968dedcb…2727` | **Test Kreatör** | testgrupp@usha.se | **ja (publik!)** | nej | 2026-02-23 | 5 | TYDLIGT TEST |

Den enda *publika* test-profilen. Namnet är bokstavligen "Test Kreatör", e-post `testgrupp@usha.se`, ingen BankID. Dess 5 listings är polerad demo/seed-data (se nedan). → `is_public=false` + `archived_at`.

### Listings (8 st)
| id | titel | ägare | bokningar | varför test |
|---|---|---|---|---|
| `88eb2f19…` | Vinyasa Yoga - Morgonklass | Test Kreatör | 3 | seed-demo under testkonto |
| `b2e116aa…` | Yin Yoga & Sound Healing | Test Kreatör | 1 | seed-demo |
| `aa1e3ece…` | Salsa Night - Social Dance Event | Test Kreatör | 1 | seed-demo |
| `9cfc4af7…` | Meditation & Breathwork | Test Kreatör | 1 | seed-demo |
| `adf1a5c8…` | Contemporary Dance Workshop | Test Kreatör | 1 | seed-demo |
| `0922490e…` | **Test** (musik, 400 kr) | pablo.andre.acosta@gmail.com | 0 | titel = "Test" (din "Test 400 kr Musik") |
| `43d036c8…` | **Test** (dans) | pablo.andre.acosta@gmail.com | 3 | titel = "Test" |
| `418a2329…` | **Test** (dans) | pablo.andre.acosta@gmail.com | 3 | titel = "Test" |

De 3 "Test"-listsen ägs av ditt riktiga grundarkonto (pablo.andre) — **profilen rörs inte**, bara dessa test-*listings* arkiveras. Kopplade bokningar lämnas intakta (inga föräldralösa poster); kan hård-raderas i ett senare steg efter ditt OK.

---

## 🟡 OSÄKER — RÖRS EJ, väntar på ditt godkännande

| id | namn/titel | e-post | publik | varför osäker |
|---|---|---|---|---|
| `096f951e…` | **Pablo Test** (profil) | pablo.aztk@gmail.com | nej | Namnet har "Test" men det är ditt premium-altkonto; ej publikt |
| `a5a1811b…` | Kroppskontroll (listing) | pablo.aztk@gmail.com | — | Ägs av "Pablo Test"; generisk tjänst utan datum/venue, 0 bokningar |
| `391b1db6…` | **Pablo Acosta** (profil) | demoskap@gmail.com | nej | Demo-/altkonto (grundare), ej publikt, 6 kundbokningar |
| `950a2e9c…` | Privat danslektion (listing) | pablo.andre.acosta@gmail.com | — | Kan vara ett riktigt tjänsteutbud; ingen "test"-markör |
| `abc3ee4c…` | Practica (listing) | pablo.andre.acosta@gmail.com | — | Riktigt event-namn, FB-importerat — troligen riktigt |
| `8d1e2773…` | The Kiz Lab (listing) | pablo.acosta@usha.se | — | Riktigt event men tomt (pris/plats saknas, gårdagens FB-import) → noindex, ej radering |

**Fråga till dig:** ska något av OSÄKER också arkiveras? "Pablo Test"-profilen + "Kroppskontroll" är de starkaste kandidaterna (test-namn), men de är inte publika.

---

## 🟢 TROLIGEN RIKTIG — behålls

- **Pablo Acosta** (pablo.acosta@usha.se) — grundare, publik, BankID, + "The Kiz Lab"-event. Behålls.
- **LOVE BOSDOTTER ACOSTA** (acostalove40@gmail.com) — medgrundare, + "Värdskap"-listing. Behålls (enligt instruktion).
- **pablo.andre.acosta@gmail.com** — ditt grundarkonto; profilen behålls (endast dess 3 "Test"-listings arkiveras).
- 14 riktiga kundprofiler (alla `is_public=false`, riktiga namn/e-post, ingen test-markör): Mariana, Johanna, Ludvig, Fabriken Faciliterar, Nelly, Jesper, Linus, Maria Katarina, Paulina, Helene, Leif, Maria Ljung, Bereket, Agneta. Behålls.

---

## Åtgärd i denna PR
1. Migration `20260614_archive_test_data.sql` — reversibel soft-arkivering (1 profil + 8 listings). Rollback-SQL inkluderad i filen.
2. `noindex` på inaktiva/arkiverade listing-sidor och icke-publika/tomma profilsidor.
3. Sitemap exkluderar redan `is_active=false`/`is_public=false` → arkiverade poster försvinner automatiskt.

Bokningar/media/följare lämnas intakta i detta steg (soft-delete). Hård radering kan följa efter sign-off.
