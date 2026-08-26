// Seeds Stripe TEST MODE with the objects the app expects to exist: the six
// subscription prices and one connected account that can take card payments.
//
// Why this is needed: the production database stores live Stripe identifiers —
// connected accounts (acct_…) and price IDs. Those objects exist only in live
// mode, so a test-mode key cannot reference them. Without test-mode twins, a
// local sandbox can create a checkout session and then fail on the first API
// call that touches an account or a price. This script creates the twins and
// prints the env lines that point the sandbox at them.
//
// SAFETY: refuses to run against a live key. The whole point is that no real
// money can move here, so the guard is a hard exit rather than a warning.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_test_… node scripts/seed-stripe-test.mjs
//
// Idempotent: objects are looked up by a metadata marker before being created,
// so re-running does not pile up duplicates.

import Stripe from "stripe";

const MARKER = "usha_sandbox_seed";

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  console.error("STRIPE_SECRET_KEY saknas. Kör med din TESTNYCKEL:");
  console.error("  STRIPE_SECRET_KEY=sk_test_… node scripts/seed-stripe-test.mjs");
  process.exit(1);
}

if (!key.startsWith("sk_test_")) {
  console.error("VÄGRAR KÖRA: nyckeln är inte en testnyckel (sk_test_…).");
  console.error("Det här skriptet skapar testdata och får aldrig röra live-läget.");
  process.exit(1);
}

const stripe = new Stripe(key);

/** Subscription plans, mirroring src/lib/stripe/config.ts. */
const PLANS = [
  { env: "STRIPE_PUBLIK_GULD_PRICE_ID", product: "Publik Guld", sek: 199 },
  { env: "STRIPE_PUBLIK_PREMIUM_PRICE_ID", product: "Publik Premium", sek: 499 },
  { env: "STRIPE_KREATOR_GULD_PRICE_ID", product: "Kreatör Guld", sek: 299 },
  { env: "STRIPE_KREATOR_PREMIUM_PRICE_ID", product: "Kreatör Premium", sek: 599 },
  { env: "STRIPE_UPPLEVELSE_GULD_PRICE_ID", product: "Upplevelse Guld", sek: 299 },
  { env: "STRIPE_UPPLEVELSE_PREMIUM_PRICE_ID", product: "Upplevelse Premium", sek: 599 },
];

/** Find a previously seeded price for this plan, or create product + price. */
async function ensurePrice({ env, product, sek }) {
  const found = await stripe.prices.search({
    query: `metadata['${MARKER}']:'${env}' AND active:'true'`,
    limit: 1,
  });
  if (found.data[0]) return { id: found.data[0].id, reused: true };

  const p = await stripe.products.create({
    name: `${product} (sandbox)`,
    metadata: { [MARKER]: env },
  });

  const price = await stripe.prices.create({
    product: p.id,
    currency: "sek",
    unit_amount: sek * 100,
    recurring: { interval: "month" },
    metadata: { [MARKER]: env },
  });

  return { id: price.id, reused: false };
}

/**
 * A connected account that mirrors a real organizer: Swedish company, card
 * payments and transfers requested. In test mode Stripe grants the capabilities
 * without real verification, which is exactly what the sandbox needs — the live
 * accounts are stuck on transfers-only precisely because card_payments was
 * never requested there.
 */
async function ensureConnectedAccount() {
  const existing = await stripe.accounts.list({ limit: 100 });
  const hit = existing.data.find((a) => a.metadata?.[MARKER] === "organizer");
  if (hit) return { id: hit.id, reused: true };

  const account = await stripe.accounts.create({
    type: "express",
    country: "SE",
    email: "sandbox-organizer@example.com",
    business_type: "company",
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    metadata: { [MARKER]: "organizer" },
  });

  return { id: account.id, reused: false };
}

const lines = [];

console.log("Seedar Stripe test-läge…\n");

for (const plan of PLANS) {
  const { id, reused } = await ensurePrice(plan);
  console.log(`  ${reused ? "återanvänd" : "skapad   "}  ${plan.product} → ${id}`);
  lines.push(`${plan.env}=${id}`);
}

const account = await ensureConnectedAccount();
console.log(
  `  ${account.reused ? "återanvänt" : "skapat    "}  Connect-konto → ${account.id}`
);

console.log("\nKlart. Klistra in i .env.local för sandlådan:\n");
console.log(lines.join("\n"));
console.log(`\nConnect-konto att lägga på testprofilen i databasen:\n  ${account.id}\n`);
