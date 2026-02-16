# Creators Platform – Setup Guide

## 1. Skapa projektet

```bash
cd ~/Desktop
npx create-next-app@14 creators-platform \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

cd creators-platform
```

## 2. Installera dependencies

```bash
# Supabase
npm install @supabase/supabase-js @supabase/ssr @supabase/auth-helpers-nextjs

# Stripe
npm install stripe @stripe/stripe-js

# UI
npx shadcn-ui@latest init
# Välj: Default style, Slate base color, CSS variables: Yes

npx shadcn-ui@latest add button card badge separator accordion dialog input label toast

# Ikoner & utils
npm install lucide-react clsx tailwind-merge
```

## 3. Miljövariabler

Skapa `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hiurrvorwqfihtdfhbhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdXJydm9yd3FmaWh0ZGZoYmh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjcwNzcsImV4cCI6MjA4NjQwMzA3N30.s8aH3ob9HcADnrq4MAOHX_9JiYexlMSoDYJfBXVlczY
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_or_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Projektstruktur

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing page
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts       # Supabase auth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx
│   └── api/
│       ├── stripe/
│       │   ├── checkout/route.ts
│       │   └── webhook/route.ts
│       └── auth/
│           └── callback/route.ts
├── components/
│   ├── ui/                          # shadcn components
│   ├── landing/
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   ├── faq.tsx
│   │   └── footer.tsx
│   └── auth/
│       └── auth-form.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser client
│   │   ├── server.ts                # Server client
│   │   └── middleware.ts
│   ├── stripe/
│   │   ├── client.ts
│   │   └── config.ts
│   └── utils.ts
├── types/
│   └── database.ts
└── middleware.ts
```

## 5. Git & Push

```bash
git init
git add .
git commit -m "Initial setup: Next.js 14 + Supabase + Stripe"
git branch -M main
git remote add origin https://github.com/PabloAndreAcosta/creators-platform.git
git push -u origin main
```

## 6. Vercel Deployment

```bash
npm i -g vercel
vercel
# Följ promptsen, lägg till env vars i Vercel dashboard
```

## 7. Stripe Webhook (produktion)

I Stripe Dashboard → Developers → Webhooks:
- Endpoint: `https://din-domain.vercel.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
