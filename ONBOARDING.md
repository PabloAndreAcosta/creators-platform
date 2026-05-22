# Usha – Onboarding

Usha (usha.se) är en svensk kreatör-marketplace som kopplar **BankID-verifierade** kreatörer och upplevelse-arrangörer med kunder som bokar tjänster och event. BankID-verifiering är plattformens huvuddifferentiator ("trygghet säljer").

Stack: **Next.js 14 (App Router, TS)** · **Supabase** (auth + Postgres) · **Stripe** (Connect + subscriptions) · **Resend** (e-post) · **Tailwind** · Vercel (hosting) · tvåspråkigt UI via next-intl (**engelska default**, svenska valbart).

---

## Kom igång

```bash
npm install
npm run dev        # localhost:3000
npm run build      # prod-build + typecheck (kör innan commit)
npm run lint
npm test           # Vitest
```

`.env.local` krävs (se `.env.local.example`): Supabase URL/nycklar, Stripe-nycklar (lokalt = `pk_test_`/`sk_test_`), `CRON_SECRET`, `RESEND_API_KEY`, Signicat (BankID), m.m.

> **Obs om env:** Supabase använder nya nyckelformatet `sb_publishable_` / `sb_secret_` (legacy JWT-nycklar är avstängda). Hämta korrekta värden med `vercel env pull`. Sätt env via `printf "%s"` (inte `echo`) — `echo` lägger trailing newline som tyst bryter URL/auth.

---

## Arkitektur i korthet

### Supabase-klienter (välj rätt)
- **Browser** `@/lib/supabase/client` — i `"use client"`-komponenter.
- **Server** `@/lib/supabase/server` — Server Components & Route Handlers (cookie-baserad session).
- **Middleware** `@/lib/supabase/middleware` — `updateSession()` per request.
- **Admin** `@/lib/supabase/admin` (service role) — webhooks, cron, skript. Bypassar RLS **och** triggers (t.ex. `protect_profile_privileged_columns`).

### Roller
`profiles.role` ∈ `publik` (kund) · `kreator` · `upplevelse`. (Äldre rader kan ha `creator`/`customer`.) UI:t grenar på `role === "kreator"` etc. **Viktigt glapp:** `creator_subcategory='taxi_dancer'` kräver `role='creator'` (engelska) i en CHECK-constraint, medan appen läser `'kreator'` — undvik taxi_dancer om du inte hanterar båda.

### Två app-ytor
- `/app/*` — mobil-appskal (AppShell + bottom-nav), kund- och kreatörsvyer.
- `/dashboard/*` — kreatörens hanteringsverktyg (bokningar, listings, payouts, analytics, billing, gigs, promo).

### RLS-grunder
- `profiles`: läsbar om `is_public=true` ELLER ägare. (En publik profilsida kräver alltså `is_public` — eller att man är inloggad som ägaren.)
- `listings`: publika när `is_active=true`. `/upplevelser` & `/listing/[id]` gateas bara på `is_active` (ej på kreatörens `is_public`).
- BankID krävs för `is_public=true` på kreatör/upplevelse (trigger, service role bypassar).

### Deploy & git
- Vercel auto-deployar från **usha-ab/creators-platform** (prod → usha.se).
- **Dual push:** `git push origin main` går till BÅDE `usha-ab/creators-platform` (prod) och `PabloAndreAcosta/creators-platform` (privat backup). Radera aldrig den privata.
- Migrationer i `supabase/migrations/` appliceras mot prod manuellt (t.ex. via Supabase-MCP `apply_migration` eller CLI) — de körs **inte** automatiskt vid deploy.

### Cron & schemaläggning ⚠️
Vercel-planen är **Hobby** → cron-jobb får köra **högst en gång per dygn**. En tätare `vercel.json`-cron (t.ex. timme) gör att hela deployen tyst avvisas.
- **Dagliga jobb:** `vercel.json` (`/api/cron/*`, auth via `Bearer ${CRON_SECRET}`).
- **Sub-dagliga jobb:** GitHub Actions istället — se `.github/workflows/booking-soon-reminder.yml` (timvis, curlar endpoints med `secrets.CRON_SECRET`, guard `if: github.repository == 'usha-ab/creators-platform'`). Gör endpoints idempotenta (`*_sent_at`-kolumner) så dubbeltriggning är ofarlig.

### E-post (Resend)
`@/lib/email/*` — `getResend()`/`getFromEmail()`, `renderEmailToHtml()`, komponenter i `src/components/emails/`. Opt-out via `shouldSendEmail(userId, notifKey)` (`check-preferences.ts`, opt-out-modell). `.ics`-bilagor byggs med `@/lib/email/ics.ts`.

### Språk / i18n (next-intl)
- **Locales:** `en` (default) + `sv`. All konfig i `src/i18n/config.ts` — `defaultLocale = 'en'`, `LOCALE_COOKIE_NAME = 'usha-locale'`.
- **Val av locale:** cookien `usha-locale`. `src/i18n/request.ts` läser den; `src/middleware.ts` sätter den när den saknas/är ogiltig (faller tillbaka till `defaultLocale`). Ny besökare utan cookie → **engelska**. `<html lang>` sätts i `src/app/layout.tsx` via `getLocale()`.
- **Språkväljare:** `src/components/language-switcher.tsx` — togglar en↔sv, skriver `usha-locale` (1 års giltighet) och kör `router.refresh()`. Etiketter ligger i `messages/{en,sv}.json` under `language` (`switchTo`/`current`).
- **Meddelanden:** `src/i18n/messages/en.json` + `sv.json` (samma namespaces, t.ex. `home`, `landing`, `nav`). Lägg alltid nycklar i **båda** filerna.
- **Cookie-namnbyte (2026-05-22):** bumpades från `NEXT_LOCALE` → `usha-locale` för att tvinga alla *befintliga* besökare till engelska en gång — gamla `NEXT_LOCALE`-cookies ignoreras, och nästa språkval sparas under det nya namnet. Vill man göra om en sådan global återställning i framtiden: bumpa cookie-namnet igen (alla consumers går via `LOCALE_COOKIE_NAME`, så det räcker att ändra på ett ställe).

---

## Vad som byggts senast

### 1. Auth-cookie-fix (kritisk) — `middleware.ts` + `server.ts`
Cookie-valideringen körde `atob()` på hela cookie-värdet inkl. `base64-`-prefixet. Det kastade för ~25 % av cookie-längder (single-cookie) och dessutom för **chunkade** sessioner (stora sessioner delas i 3180-teckens bitar `.0`/`.1`; `.0` är ett base64-*fragment*) → giltiga sessioner tappades → slumpvis utloggning, särskilt Google-OAuth/rika profiler. Fix: validera **bara den ochunkade `base64-`-prefixade session-cookien** (hoppa `.N`-chunks och icke-base64-cookies). **Lärdom: testa både single- och chunked-cookies vid ändringar här.**

### 2. Bokningspåminnelser + kalenderinvite
- **Dagen-före:** `/api/cron/booking-reminders` (Vercel daglig 07:00 UTC) — `confirmed`-bokningar imorgon → mejl till kund (respekterar `notif_booking_confirmed`) eller gäst. Dedup: `bookings.reminder_sent_at`.
- **T-2h ("börjar snart"):** `/api/cron/booking-reminders-soon` (GitHub Actions, timvis) — bokningar inom 2h. Dedup: `bookings.reminder_soon_sent_at`.
- E-post: `BookingReminder.tsx` (variant `day`/`soon`) + `send-booking-reminder.ts`. Bekräftelse- och påminnelsemejl bär en **`.ics`-kalenderinvite**.

### 3. Creator-calendar (Luma-inspirerat)
- **Följar-notiser:** `/api/cron/creator-event-notify` (GitHub Actions, timvis) — när en kreatör lägger upp ett nytt aktivt event (skapat <3 dygn) mejlas följarna. Dedup: `listings.followers_notified_at`. Opt-out: `user_settings.notif_creator_events`. E-post: `CreatorEventAnnouncement.tsx` + `send-creator-event.ts`.
- **Kreatörskalender:** `/creators/[id]/kalender` — kommande event + följ-CTA + "prenumerera i din kalender".
- **iCal-feed:** `/api/creators/[id]/calendar` — publik `text/calendar`-feed (floating lokal tid) av kommande aktiva event.
- **Samlad vy:** `/app/calendar` har en sektion "Från kreatörer du följer" (kommande event från alla man följer), utöver egna bokningar + den befintliga `calendar_sync_token`-feeden.

### 4. UX-lyft (mobil upptäckbarhet + rikare dashboard)
- **Verktygs-hub:** `/app/tools` (`src/app/app/tools/page.tsx`) — rollanpassat rutnät över ALLA verktyg i kategorier (Skapa & sälj, Ekonomi för skapare; Utforska, Mitt konto för alla). Löser att dashboard-verktyg var svåra att hitta på mobil.
- **Slimmad bottom-nav** (`bottom-nav.tsx`) — ren 5-flikars nav per roll med en **"Mer"**-flik → hubben.
- **Onboarding-checklista:** `creator-onboarding.tsx` — "Kom igång" (profil, BankID, första tjänst/event, Stripe, publik). Döljs när allt är klart. Finns i både Kreatör- och Upplevelse-dashboarden (`home-content.tsx`), med rätt formulering per roll.
- **Rätt egna data + tomma-states:** "Dina tjänster"/event använder nu kreatörens **egna** listings (dedikerad query i `src/app/app/page.tsx` → `ownServices`), inte det globala flödet. Tomma states är handlingsbara CTA:er ("Skapa din första tjänst/event").

### 5. Marknadsföring (utanför repot)
`~/marketing/` — 42 skärmdumpar (`screenshots/`), 9 branded Canva-IG-posts (`canva-stars/` + `canva-library/`), och promptar för att generera fler. Backat till privata repot `PabloAndreAcosta/usha-marketing`. Canva Brand Kit "USHA" (gold `#C8A445`, Outfit-font, tagline "För mänskligt uttryck").

---

## Viktiga fallgropar
- **Vercel Hobby:** crons max 1/dag → sub-dagligt via GitHub Actions (se ovan).
- **Auth-cookie-validering:** rör inte `atob`/base64-checken utan att testa både single- och chunkade sessioner.
- **`is_public` vs RLS:** en `is_public=false`-profil är osynlig publikt men läsbar av ägaren — bra för test-seed utan att läcka till marketplace.
- **Service role bypassar triggers** (inte bara RLS) — använd admin-klienten för privilegierade kolumner (role/tier/bankid/stripe).
- **BETA_MODE** (`NEXT_PUBLIC_BETA_MODE`) låser upp features för alla under beta; stäng av efter beta och verifiera att betalande behåller access.
- **`vercel env pull`** för korrekta prod-nycklar; `.env.local` kan släpa efter (URL-typo / döda legacy-nycklar har förekommit).
