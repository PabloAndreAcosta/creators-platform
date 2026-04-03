# Usha Platform — Total Summering

*Uppdaterad: 2026-04-04*

---

## Tidsöversikt

| Session | Datum | Faktisk tid | Utan AI (uppskattad) |
|---------|-------|-------------|---------------------|
| 1 | 2026-02-16 | 2h | 20h |
| 2 | 2026-02-19 | 4h | 40h |
| 3 | 2026-02-20 | 3h | 24h |
| 4 | 2026-02-21 | 3h | 16h |
| 5 | 2026-02-23 | 4h | 32h |
| 6 | 2026-03-04 | 3h | 24h |
| 7 | 2026-03-10–12 | 5h | 40h |
| 8 | 2026-03-31 | 5h | 40h |
| 9 | 2026-04-01 | 4h | 32h |
| 10 | 2026-04-02 | 3h | 20h |
| 11 | 2026-04-03 | 10h | 90h |
| **TOTALT** | | **46h** | **~378h** |

**Tidsbesparingsfaktor: ~8x**

---

## Alla byggda funktioner

### Plattformsgrund
- Next.js 14 App Router + TypeScript
- Supabase (auth + PostgreSQL + RLS + Storage)
- Stripe (prenumerationer + biljettförsäljning + Connect)
- Tailwind CSS med Usha designsystem
- PWA med service worker, manifest, installationsprompt

### Användarhantering
- Tre roller: Användare, Kreatör, Upplevelse
- Registrering med rollval
- Google OAuth + Facebook OAuth
- Mobile BankID-verifiering (Signicat)
- Rollbaserade vyer och navigering
- Profilinställningar med "Min plan & betalning"

### Prenumerationer & Betalning
- 6 planer: Publik/Kreatör/Upplevelse x Guld/Premium
- Stripe Checkout med beta-trial
- Stripe Connect för kreatörsutbetalningar
- Kommissionsnivåer: 15% gratis, 8% guld, 3% premium
- Biljettköp (med och utan Stripe)
- Promo-koder

### Tjänster & Events
- Skapa/redigera/radera tjänster och events
- Datum, starttid, sluttid, plats
- Google Places Autocomplete med koordinater
- Eventbild (uppladdning till Supabase Storage)
- Kategorier, pris, varaktighet
- Listing types: event, bordsbokning, SPA, gruppaktivitet
- Gästantal (min/max) och gästuppgifter
- Experience details (bekvämligheter, vad ingår)
- Early Bird / Gold-exklusiv tillgång
- Tier-baserade listing-gränser (3/15/unlimited)

### Publik eventsida (`/listing/[id]`)
- Full eventvy med bild, detaljer, karta
- Google Maps Embed med klickbar adress
- Boka/Köp biljett sidebar
- Kreatörskort med profilänk
- Förhandsvisning för ägare

### Bokning & Kalender
- Bokningsformulär med kalenderval
- Smart flöde: fasta event → direkt bokning, flexibla → kalenderval
- Tidsslots-hantering (heldag eller specifika tider)
- Tillgänglighetskalender för kreatörer
- Bokningsbekräftelse/avbokning
- Väntelista/kö-system
- Kalendersynk: Google Calendar, Apple (webcal), Outlook
- iCal-feed med unik token

### Socialt flöde
- Instagram-liknande posts med bilder
- Likes och engagemang
- Redigera/radera egna inlägg
- "Mina inlägg"-sida
- Auto-post vid skapande av event/tjänst
- Alla användare kan posta (inte bara kreatörer)

### SoMe-integration
- Facebook Page-anslutning (OAuth)
- Synka events till Facebook Page
- Importera events från Facebook
- Instagram-anslutning + mediaimpport
- TikTok-anslutning + mediaimport
- SocialShareButton: Facebook, X, WhatsApp, LinkedIn, kopiera länk

### Klickbar navigation
- Feed: bild + biljettbar → eventsida
- Kreatörsprofil: tjänstekort + eventtidslinje → eventsida
- "Mitt innehåll" och "Mina tjänster" → eventsida
- Usha-logga → /app (alla sidor, för inloggade)

### Marketplace
- Sök kreatörer (namn, plats, kategori)
- Filtrera: kategori, plats, pris, sortering
- Publika kreatörsprofiler med allt innehåll
- Vanity URLs (`/[slug]`)

### Portfolio & Media
- Creator Media Gallery (bilder, video, Instagram, YouTube, Vimeo)
- Hero-bild
- Sektionsindelning

### Digitalt innehåll
- "Mitt innehåll": onlinematerial + tjänster
- Digital products: kurser, videor, nedladdningar
- "Mitt bibliotek" för köpt innehåll

### Biljetter & Scanner
- Biljettvy för kunder
- QR-kod biljetter
- Scanner för kreatörer (check-in)
- Gratis biljetter utan Stripe

### Meddelanden
- Direktmeddelanden mellan användare och kreatörer
- In-app notifikationer
- E-postnotifikationer (Resend)

### Landningssida
- Hero med video
- Ekosystem-sektion
- Prissättning med beta-markering
- Trust/BankID-sektion
- PWA-installationsinstruktioner (desktop modal)
- Auto-redirect till /app om inloggad

### Mobil & Responsivitet
- Mobile-first design
- Responsive bilder, text, padding
- Bottom nav + sidebar (desktop)
- Safe area insets (notch/home indicator)
- Full-width content matchar bars
- Scrollbar-hiding på horisontella sektioner

### Admin & Säkerhet
- RLS på alla tabeller
- Webhook-hantering (Stripe)
- CSRF-skydd
- Rate limiting-konfig
- Attack Protection-konfig
- Juridiska sidor (villkor, integritet, cookies)

---

## Tech Stack

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Server Actions |
| Databas | Supabase (PostgreSQL) med RLS |
| Auth | Supabase Auth (email, Google, Facebook) |
| Betalning | Stripe (Checkout, Connect, Webhooks) |
| E-post | Resend |
| Kartor | Google Maps (Places, Embed, Static, JavaScript) |
| Verifiering | Signicat (Mobile BankID) |
| Social | Facebook Graph API, Instagram Basic Display, TikTok |
| Hosting | Vercel |
| PWA | Service Worker, Web App Manifest |
