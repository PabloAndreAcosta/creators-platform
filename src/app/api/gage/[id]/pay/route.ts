import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReceivePayments, PAYMENTS_BETA_BLOCKED_MESSAGE } from "@/lib/payments/beta-gate";

// Host pays an agreed gage: a destination charge transferring the full amount
// to the crew member's Stripe Connect account. The webhook marks it paid.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gage_agreements")
    .select("id, listing_id, host_id, collaborator_user_id, amount_ore, status")
    .eq("id", id)
    .maybeSingle();

  if (!g) {
    return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  }
  if (user.id !== g.host_id) {
    return NextResponse.json({ error: "Bara värden kan betala" }, { status: 403 });
  }
  if (g.status !== "agreed") {
    return NextResponse.json({ error: "Gaget måste vara överenskommet först" }, { status: 409 });
  }

  const [{ data: host }, { data: payee }, { data: listing }] = await Promise.all([
    admin.from("profiles").select("email, stripe_account_id, full_name").eq("id", g.host_id).maybeSingle(),
    admin.from("profiles").select("email, stripe_account_id, full_name, company_verified_at").eq("id", g.collaborator_user_id).maybeSingle(),
    admin.from("listings").select("title, slug").eq("id", g.listing_id).maybeSingle(),
  ]);

  if (!host?.stripe_account_id) {
    return NextResponse.json(
      { error: "Du måste koppla Stripe innan du kan betala.", code: "host_not_connected" },
      { status: 400 }
    );
  }
  if (!payee?.stripe_account_id) {
    return NextResponse.json(
      { error: `${payee?.full_name ?? "Mottagaren"} måste koppla Stripe innan du kan betala.`, code: "payee_not_connected" },
      { status: 400 }
    );
  }

  // Beta gate: the recipient (crew member) may only receive real payments if
  // they are the owner or a verified company.
  if (!canReceivePayments({ id: g.collaborator_user_id, company_verified_at: payee.company_verified_at })) {
    return NextResponse.json({ error: PAYMENTS_BETA_BLOCKED_MESSAGE, code: "payee_beta_blocked" }, { status: 403 });
  }

  // Confirm the payee can actually receive transfers (completed onboarding).
  try {
    const account = await stripe.accounts.retrieve(payee.stripe_account_id);
    if (account.capabilities?.transfers !== "active") {
      return NextResponse.json(
        { error: `${payee.full_name ?? "Mottagaren"} har inte slutfört sin Stripe-koppling.`, code: "payee_not_ready" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Kunde inte verifiera mottagarens Stripe-konto." }, { status: 502 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://usha.se";
  const session = await stripe.checkout.sessions.create({
    customer_email: host.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "sek",
          product_data: {
            name: `Gage till ${payee.full_name ?? "crew"} – ${listing?.title ?? "event"}`,
          },
          unit_amount: g.amount_ore,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      // Full amount goes to the crew member; no platform fee on crew gage.
      transfer_data: { destination: payee.stripe_account_id },
    },
    success_url: `${appUrl}/app/events/${g.listing_id}/crew?gage=paid`,
    cancel_url: `${appUrl}/app/events/${g.listing_id}/crew?gage=canceled`,
    metadata: {
      type: "crew_gage",
      userId: g.host_id,
      gageId: g.id,
    },
  });

  await admin
    .from("gage_agreements")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", g.id);

  return NextResponse.json({ sessionId: session.id, url: session.url });
}
