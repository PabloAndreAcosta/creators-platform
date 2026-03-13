import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { MemberTier } from "@/types/database";

// Use service role for webhook (no user context) — lazy init to avoid build errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Safely convert a Stripe timestamp (number | string | object) to ISO string */
function toISO(value: unknown): string {
  if (typeof value === "number") {
    // Unix timestamp (seconds) — only multiply if it looks like seconds (< year 2100 in seconds)
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") return new Date(value).toISOString();
  return new Date().toISOString();
}

/**
 * Extracts the unified tier from any plan key (new or legacy).
 * 'kreator_guld' → 'guld', 'creator_gold' → 'guld', 'premium' → 'premium', etc.
 */
function extractTierFromPlan(plan: string): MemberTier {
  // New format: role_tier (e.g. kreator_guld, publik_premium)
  if (plan.endsWith('_guld')) return 'guld';
  if (plan.endsWith('_premium')) return 'premium';

  // Legacy formats
  switch (plan) {
    case 'creator_gold':
    case 'gold':
      return 'guld';
    case 'creator_platinum':
    case 'platinum':
    case 'enterprise':
      return 'premium';
    case 'basic':
    case 'silver':
    default:
      return 'gratis';
  }
}

/**
 * Extracts role from plan metadata or plan key.
 */
function extractRoleFromPlan(plan: string, metadataRole?: string): string {
  if (metadataRole) return metadataRole;

  // Try to extract from new format plan key
  const parts = plan.split('_');
  if (parts.length === 2 && ['publik', 'kreator', 'upplevelse'].includes(parts[0])) {
    return parts[0];
  }

  // Legacy plans were creator-focused
  if (plan.startsWith('creator_')) return 'kreator';

  return 'publik';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        // Handle ticket purchases (one-time payments via Connect)
        if (session.metadata?.type === "ticket" && userId) {
          const listingId = session.metadata.listingId;
          const creatorId = session.metadata.creatorId;
          const amountPaid = session.amount_total; // already in öre

          // Create confirmed booking
          await getSupabaseAdmin().from("bookings").insert({
            listing_id: listingId,
            creator_id: creatorId,
            customer_id: userId,
            status: "confirmed",
            scheduled_at: new Date().toISOString(),
            booking_type: "ticket",
            stripe_payment_id: session.payment_intent as string,
            amount_paid: amountPaid,
          });

          // Record payment
          if (amountPaid) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              stripe_payment_id: session.payment_intent as string,
              amount: amountPaid,
              currency: session.currency || "sek",
              status: "succeeded",
              description: `Biljett: ${session.metadata.listingId}`,
            });
          }

          break;
        }

        // Handle subscription checkouts
        if (!userId || !session.subscription) break;

        const planKey = session.metadata?.plan || "basic";
        const tier = extractTierFromPlan(planKey);
        const role = extractRoleFromPlan(planKey, session.metadata?.role);

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        // Update profile tier and role
        await getSupabaseAdmin()
          .from("profiles")
          .update({ tier, role })
          .eq("id", userId);

        // Upsert subscription record
        await getSupabaseAdmin().from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: planKey,
          status: "active",
          current_period_start: toISO(subscription.current_period_start),
          current_period_end: toISO(subscription.current_period_end),
        });

        // Record payment
        if (session.amount_total) {
          await getSupabaseAdmin().from("payments").insert({
            user_id: userId,
            stripe_payment_id: session.payment_intent as string,
            amount: session.amount_total,
            currency: session.currency || "sek",
            status: "succeeded",
            description: `Prenumeration: ${planKey}`,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // Update subscription status
        await getSupabaseAdmin()
          .from("subscriptions")
          .update({
            status: subscription.status === "active" ? "active" : "past_due",
            current_period_start: toISO(subscription.current_period_start),
            current_period_end: toISO(subscription.current_period_end),
          })
          .eq("stripe_subscription_id", subscription.id);

        // Sync tier on profile
        const { data: sub } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          const tier = extractTierFromPlan(sub.plan);
          if (subscription.status === "active") {
            await getSupabaseAdmin()
              .from("profiles")
              .update({ tier })
              .eq("id", sub.user_id);
          } else if (
            subscription.status === "canceled" ||
            subscription.status === "unpaid"
          ) {
            await getSupabaseAdmin()
              .from("profiles")
              .update({ tier: "gratis" })
              .eq("id", sub.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Revert tier to gratis
        const { data: deletedSub } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (deletedSub) {
          await getSupabaseAdmin()
            .from("profiles")
            .update({ tier: "gratis" })
            .eq("id", deletedSub.user_id);
        }

        await getSupabaseAdmin()
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
