import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { MemberTier } from "@/types/database";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { sendGoldWelcomeEmail } from "@/lib/email/send-welcome";

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

        if (!userId) break;

        // Record promo code usage if applicable
        const promoCodeId = session.metadata?.promoCodeId;
        if (promoCodeId) {
          const usedFor = session.mode === "subscription" ? "subscription" : "ticket";
          const discountAmount = session.metadata?.promoDiscountAmount
            ? parseFloat(session.metadata.promoDiscountAmount)
            : 0;

          await getSupabaseAdmin().from("promo_code_uses").insert({
            promo_code_id: promoCodeId,
            user_id: userId,
            used_for: usedFor,
            reference_id: session.id,
            discount_amount: discountAmount,
          });

          // Increment usage counter
          await getSupabaseAdmin().rpc("increment_promo_uses", {
            promo_id: promoCodeId,
          });
        }

        // Handle ticket purchases (one-time payments via Connect)
        if (session.metadata?.type === "ticket") {
          const listingId = session.metadata.listingId;
          const creatorId = session.metadata.creatorId;
          const amountPaid = session.amount_total; // already in öre

          // Build scheduled_at from event date/time if available
          const eventDate = session.metadata.eventDate;
          const eventTime = session.metadata.eventTime;
          let scheduledAt: string;
          if (eventDate) {
            scheduledAt = eventTime
              ? new Date(`${eventDate}T${eventTime}`).toISOString()
              : new Date(`${eventDate}T00:00:00`).toISOString();
          } else {
            scheduledAt = new Date().toISOString();
          }

          // Create confirmed booking
          await getSupabaseAdmin().from("bookings").insert({
            listing_id: listingId,
            creator_id: creatorId,
            customer_id: userId,
            status: "confirmed",
            scheduled_at: scheduledAt,
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

          // Send ticket confirmation email (non-blocking)
          sendTicketConfirmationEmail(getSupabaseAdmin(), userId, creatorId!, listingId!, new Date(scheduledAt))
            .catch(err => console.error("Ticket confirmation email failed:", err));

          break;
        }

        // Handle subscription checkouts
        if (!session.subscription) break;

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

        // Send welcome email for new paid members (non-blocking)
        if (tier === 'guld' || tier === 'premium') {
          sendSubscriptionWelcomeEmail(getSupabaseAdmin(), userId, subscription)
            .catch(err => console.error("Welcome email failed:", err));
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

// ── Email helpers (webhook context — use admin client) ──────────

async function sendTicketConfirmationEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  customerId: string,
  creatorId: string,
  listingId: string,
  scheduledAt: Date,
) {
  const [customerRes, creatorRes, listingRes] = await Promise.all([
    admin.from("profiles").select("email, full_name").eq("id", customerId).single(),
    admin.from("profiles").select("full_name").eq("id", creatorId).single(),
    admin.from("listings").select("title, event_location").eq("id", listingId).single(),
  ]);

  const email = customerRes.data?.email;
  if (!email) return;

  await sendBookingConfirmationEmail({
    to: email,
    customerName: customerRes.data?.full_name || "Kund",
    serviceName: listingRes.data?.title || "Event",
    scheduledAt,
    creatorName: creatorRes.data?.full_name || "Kreatör",
    location: listingRes.data?.event_location || undefined,
  });
}

async function sendSubscriptionWelcomeEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  subscription: Stripe.Subscription,
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!profile?.email) return;

  await sendGoldWelcomeEmail({
    to: profile.email,
    memberName: profile.full_name || "Medlem",
    expiryDate: new Date(
      typeof subscription.current_period_end === "number"
        ? subscription.current_period_end * 1000
        : subscription.current_period_end
    ),
  });
}
