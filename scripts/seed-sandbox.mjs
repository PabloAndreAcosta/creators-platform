// Seeds the LOCAL sandbox database with the minimum needed to walk a payment
// end to end: an organizer who is allowed to receive money, a customer, an
// event, and a ticket type to buy.
//
// Why a script rather than supabase/seed.sql: users must be created through the
// Auth admin API so that GoTrue's own tables and the handle_new_user trigger
// stay consistent. Hand-written INSERTs into auth.users drift from whatever
// GoTrue expects and break in confusing ways on upgrade.
//
// SAFETY: refuses to run against anything but a local Supabase URL. Seeding is
// destructive-ish (it upserts profiles and creates listings) and must never be
// pointed at production by accident — so the guard is a hard exit.
//
// Usage (after `supabase start` and applying supabase/sandbox-baseline.sql):
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local secret key> \
//   SANDBOX_STRIPE_ACCOUNT=acct_… \
//   node scripts/seed-sandbox.mjs
//
// SANDBOX_STRIPE_ACCOUNT is optional; pass the connected account printed by
// scripts/seed-stripe-test.mjs to make the organizer payable.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeAccount = process.env.SANDBOX_STRIPE_ACCOUNT || null;

if (!url || !serviceKey) {
  console.error("Saknar NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?/i.test(url);
if (!isLocal) {
  console.error(`VÄGRAR KÖRA: ${url} är inte en lokal Supabase.`);
  console.error("Seed-skriptet får bara röra sandlådan, aldrig ett skarpt projekt.");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    key: "organizer",
    email: "arrangor@sandbox.test",
    password: "sandbox-arrangor",
    full_name: "Sandbox Arrangör AB",
    role: "creator",
  },
  {
    key: "customer",
    email: "kund@sandbox.test",
    password: "sandbox-kund",
    full_name: "Sandbox Kund",
    role: "customer",
  },
];

/** Create the user if missing; return its id either way. */
async function ensureUser({ email, password, full_name }) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const hit = list?.users?.find((u) => u.email === email);
  if (hit) return { id: hit.id, reused: true };

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error) throw new Error(`Kunde inte skapa ${email}: ${error.message}`);
  return { id: data.user.id, reused: false };
}

console.log(`Seedar sandlådan på ${url}\n`);

const ids = {};

for (const u of USERS) {
  const { id, reused } = await ensureUser(u);
  ids[u.key] = id;
  console.log(`  ${reused ? "återanvänd" : "skapad   "}  ${u.email}  (${u.role})`);

  // handle_new_user creates the profile row; we set the fields the payment
  // gate and checkout routes read. company_verified_at is what lets the
  // organizer receive money — the same door a real verified company uses.
  const patch = {
    full_name: u.full_name,
    role: u.role,
    email: u.email,
  };
  if (u.key === "organizer") {
    patch.company_verified_at = new Date().toISOString();
    patch.company_name = u.full_name;
    patch.org_number = "5594018326";
    patch.is_company = true;
    if (stripeAccount) {
      patch.stripe_account_id = stripeAccount;
      patch.stripe_charges_enabled = true;
      patch.stripe_details_submitted = true;
      patch.stripe_card_payments_enabled = true;
    }
  }

  // Upsert rather than update: the on_auth_user_created trigger normally makes
  // the row, but a sandbox rebuilt from a schema dump may be missing it, and a
  // silent 0-row update would only surface later as a foreign-key error.
  const { error } = await db
    .from("profiles")
    .upsert({ id, ...patch }, { onConflict: "id" });
  if (error) throw new Error(`Kunde inte skriva profil ${u.email}: ${error.message}`);
}

if (!stripeAccount) {
  console.log(
    "\n  OBS: SANDBOX_STRIPE_ACCOUNT ej satt — arrangören saknar Connect-konto\n" +
      "  och kan inte ta emot betalning. Kör scripts/seed-stripe-test.mjs först."
  );
}

// ---- Event + biljettyp ----------------------------------------------------

const SLUG = "sandbox-event";

const { data: existing } = await db
  .from("listings")
  .select("id")
  .eq("slug", SLUG)
  .maybeSingle();

let listingId = existing?.id;

if (listingId) {
  console.log(`\n  återanvänt  event "${SLUG}"`);
} else {
  const start = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const { data, error } = await db
    .from("listings")
    .insert({
      user_id: ids.organizer,
      title: "Sandbox-event",
      slug: SLUG,
      category: "dance",
      description: "Testevent för sandlådan. Inga riktiga pengar rör sig här.",
      is_public: true,
      event_date: start.toISOString(),
      event_city: "Stockholm",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Kunde inte skapa event: ${error.message}`);
  listingId = data.id;
  console.log(`\n  skapat      event "${SLUG}"`);
}

const { data: tt } = await db
  .from("ticket_types")
  .select("id")
  .eq("listing_id", listingId)
  .maybeSingle();

if (tt) {
  console.log(`  återanvänd  biljettyp`);
} else {
  const { error } = await db.from("ticket_types").insert({
    listing_id: listingId,
    name: "Standard",
    price: 100,
    capacity: 50,
  });
  if (error) throw new Error(`Kunde inte skapa biljettyp: ${error.message}`);
  console.log(`  skapad      biljettyp "Standard" 100 kr`);
}

console.log("\nKlart.\n");
console.log(`  Arrangör:  arrangor@sandbox.test / sandbox-arrangor`);
console.log(`  Kund:      kund@sandbox.test / sandbox-kund`);
console.log(`  Event:     /event/${SLUG}\n`);
