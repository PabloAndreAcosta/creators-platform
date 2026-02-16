# Usha Platform

Marketplace for creative professionals and experience venues in Sweden. Creators (dancers, musicians, photographers) and businesses (restaurants, concert halls, spas) build their presence, get discovered, and receive bookings — all in one place.

**Swedish-language UI** | **Beta v0.1**

## Tech Stack

- **Framework:** Next.js 14 (App Router), TypeScript
- **Database & Auth:** Supabase (PostgreSQL + Row-Level Security + Auth)
- **Payments:** Stripe (checkout, webhooks, subscriptions, customer portal)
- **Styling:** Tailwind CSS, Radix UI, Framer Motion
- **Fonts:** Outfit (sans), JetBrains Mono (mono)

## Features

### Landing Page
- Three-pillar ecosystem story (Creators, Experiences, Customers)
- Category showcase, testimonials, pricing, FAQ
- Mobile-responsive with hamburger menu

### Marketplace
- Public search with category and text filters
- Creator profile pages with listings, bio, and booking

### Dashboard (Authenticated)
- **Profile** — Edit bio, avatar upload (Supabase Storage), category, location, hourly rate, public toggle
- **Listings** — Full CRUD, toggle active/inactive, category and pricing
- **Bookings** — Incoming (as creator: confirm, complete, cancel) and outgoing (as customer: cancel)
- **Billing** — Stripe subscription management, plan cards, customer portal

### Auth
- Email/password signup and login
- Google OAuth via Supabase
- Cookie-based sessions with middleware refresh

### Payments
- Stripe Checkout for subscriptions (Basic 99 SEK, Premium 199 SEK, Enterprise 499 SEK)
- Webhook handling for subscription lifecycle
- Customer portal for self-service billing

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project ([supabase.com](https://supabase.com))
- Stripe account ([stripe.com](https://stripe.com))

### Setup

```bash
# Clone
git clone https://github.com/PabloAndreAcosta/creators-platform.git
cd creators-platform

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase and Stripe keys

# Run database migration
# Copy contents of supabase/migration.sql into Supabase SQL Editor and execute

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.local.example` for all required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_BASIC_PRICE_ID` | Stripe price ID for Basic plan |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe price ID for Premium plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe price ID for Enterprise plan |
| `NEXT_PUBLIC_APP_URL` | App base URL |

## Commands

```bash
npm run dev            # Start dev server (port 3000)
npm run build          # Production build
npm run start          # Start production server
npm run lint           # Run ESLint
npm run db:generate    # Regenerate Supabase TypeScript types
npm run stripe:listen  # Forward Stripe webhooks locally
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Design tokens & global styles
│   ├── (auth)/                           # Login, signup, OAuth callback
│   ├── (dashboard)/                      # Protected dashboard routes
│   │   ├── layout.tsx                    # Dashboard shell (auth check, nav)
│   │   └── dashboard/
│   │       ├── page.tsx                  # Overview with stats
│   │       ├── profile/                  # Profile editing + avatar upload
│   │       ├── listings/                 # Listings CRUD
│   │       ├── bookings/                 # Booking management
│   │       └── billing/                  # Stripe subscription management
│   ├── marketplace/                      # Public marketplace with search
│   ├── creators/[id]/                    # Public creator profiles + booking
│   └── api/
│       ├── auth/signout/                 # Sign out endpoint
│       └── stripe/                       # Checkout, webhook, portal
├── components/ui/                        # Reusable UI (button, input, toast)
├── lib/
│   ├── supabase/                         # Browser, server, middleware clients
│   ├── stripe/                           # Stripe client & pricing config
│   ├── categories.ts                     # Shared category constants
│   └── utils.ts                          # cn() helper
├── types/database.ts                     # Supabase TypeScript types
└── middleware.ts                          # Auth session refresh
```

## Database

Schema defined in `supabase/migration.sql`. Tables:

- **profiles** — User profiles (name, bio, avatar, category, location, hourly rate)
- **listings** — Services offered by creators (title, description, price, duration)
- **bookings** — Booking records with status flow (pending → confirmed → completed)
- **subscriptions** — Stripe subscription state
- **payments** — Payment records

All tables have Row-Level Security (RLS) enabled. A database trigger auto-creates a profile on user signup.

## Deployment

```bash
# Vercel (recommended)
npm i -g vercel
vercel

# Add all environment variables in Vercel dashboard
```

For Stripe webhooks in production, add endpoint in Stripe Dashboard:
- URL: `https://your-domain.vercel.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## License

Private project.
