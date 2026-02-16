# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- `npm run db:generate` — Regenerate Supabase TypeScript types into `src/lib/database.types.ts`
- `npm run stripe:listen` — Forward Stripe webhooks to `localhost:3000/api/stripe/webhook`

No test framework is configured.

## Architecture

Next.js 14 App Router with TypeScript, Supabase (auth + PostgreSQL), Stripe (subscriptions), Tailwind CSS. Swedish-language UI throughout ("Logga in", "Skapa konto", etc.).

### Supabase Client Pattern

Three Supabase client variants for different contexts — always use the correct one:

- **Browser** (`@/lib/supabase/client`): `createBrowserClient` from `@supabase/ssr`, used in `"use client"` components
- **Server** (`@/lib/supabase/server`): `createServerClient` with cookie access via `next/headers`, used in Server Components and Route Handlers
- **Middleware** (`@/lib/supabase/middleware`): `updateSession()` refreshes auth session on every request, called from `src/middleware.ts`

The Stripe webhook handler (`src/app/api/stripe/webhook/route.ts`) is an exception — it creates a Supabase admin client directly with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS since webhooks have no user context.

### Route Structure

- Route groups `(auth)` and `(dashboard)` organize without affecting URLs — `/login`, `/signup`, `/dashboard`
- Auth callback at `/callback` handles OAuth code exchange (Google login)
- API routes: `POST /api/stripe/checkout` (create Stripe session), `POST /api/stripe/webhook` (handle Stripe events)
- Dashboard page is a Server Component that fetches profile + subscription data, redirects to `/login` if unauthenticated

### Stripe Integration

Pricing plans (Basic 99 SEK, Premium 199 SEK, Enterprise 499 SEK) are defined in `src/lib/stripe/config.ts`. Price IDs come from environment variables (`STRIPE_BASIC_PRICE_ID`, etc.). The webhook handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` events, upserting/updating the `subscriptions` table.

### Database

Schema in `supabase/migration.sql`. Tables: `profiles`, `subscriptions`, `payments`, `listings`, `bookings`. All tables have RLS enabled. A database trigger auto-creates a profile row on user signup. The `payments`, `listings`, and `bookings` tables exist in the schema but are not yet used in the application code.

### Styling

Two styling systems coexist:
- **Landing page** uses CSS custom properties directly (`var(--usha-gold)`, `var(--usha-black)`, etc.) defined in `globals.css`
- **Dashboard/UI components** uses shadcn/ui pattern with HSL CSS variables (`hsl(var(--primary))`, etc.) via Tailwind config

Utility classes `text-gradient`, `glow-gold`, `glow-accent`, `grain` are defined in `globals.css`. The `cn()` helper in `src/lib/utils.ts` merges Tailwind classes (clsx + tailwind-merge).

### Path Alias

`@/*` maps to `./src/*`

### Environment Variables

See `.env.local.example`. Requires: Supabase URL/keys, Stripe secret/publishable/webhook keys, Stripe price IDs, and `NEXT_PUBLIC_APP_URL`.
