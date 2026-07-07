import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { MemberTier } from "@/types/database";
import { PLANS, type PlanKey } from "@/lib/stripe/config";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { sendGoldWelcomeEmail } from "@/lib/email/send-welcome";
import { sendTrialEndingEmail as sendTrialEndingEmailService } from "@/lib/email/send-trial-ending";
import { createNotification } from "@/lib/notifications/create";

/** Reverse lookup: Stripe price ID → plan key */
function planKeyFromPriceId(priceId: string): string | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === priceId) return key;
  }
  return null;
}

// Use service role for webhook (no user context) — lazy init to avoid build errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Resolves which payment method the customer actually used (e.g. "card", "swish",
 * "klarna") for a completed Checkout Session. Reads it from the PaymentIntent's
 * latest charge. Returns null when there is no charge (e.g. free / trial subscriptions)
 * or if the lookup fails — callers should treat null as "unknown" and not block on it.
 */
async function resolvePaymentMethod(
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (!paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    return charge?.payment_method_details?.type ?? null;
  } catch (err) {
    console.error("resolvePaymentMethod failed:", err);
    return null;
  }
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
  if (parts.length === 2 && ['customer', 'creator', 'venue'].includes(parts[0])) {
    return parts[0];
  }

  // Legacy plans were creator-focused
  if (plan.startsWith('creator_')) return 'creator';

  return 'customer';
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

        // Which method the customer actually paid with (card / swish / klarna / …).
        // Resolved once here and stamped onto every payments row below. null = unknown
        // (e.g. free trial subscriptions with no charge).
        const paymentMethod = await resolvePaymentMethod(session);

        // Handle guest ticket purchases (no user account needed)
        if (session.metadata?.type === "guest_ticket") {
          const listingId = session.metadata.listingId;
          const creatorId = session.metadata.creatorId;
          const guestEmail = session.metadata.guestEmail;
          const guestName = session.metadata.guestName || null;
          const amountPaid = session.amount_total;
          const paymentIntentId = (session.payment_intent as string) || null;

          if (!listingId || !creatorId || !guestEmail) {
            console.error("Webhook: missing guest_ticket metadata");
            break;
          }

          // Idempotency check
          if (paymentIntentId) {
            const { count } = await getSupabaseAdmin()
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("stripe_payment_id", paymentIntentId);
            if (count && count > 0) break;
          }

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

          const { data: guestBooking } = await getSupabaseAdmin().from("bookings").insert({
            listing_id: listingId,
            creator_id: creatorId,
            customer_id: null,
            guest_email: guestEmail,
            guest_name: guestName,
            status: "confirmed",
            scheduled_at: scheduledAt,
            booking_type: "ticket",
            stripe_payment_id: paymentIntentId,
            amount_paid: amountPaid,
          }).select("id").single();

          // Timed automation: count the sold ticket (atomic) for capacity.
          await getSupabaseAdmin().rpc("increment_tickets_sold", { p_listing: listingId, p_n: 1 });

          // Discount access code: consume one use now that payment succeeded.
          if (session.metadata?.accessCodeId) {
            await getSupabaseAdmin()
              .rpc("consume_access_code", { p_id: session.metadata.accessCodeId })
              .then(({ error }) => error && console.error("consume_access_code failed:", error));
          }

          // Send confirmation to guest email
          const listingRes = await getSupabaseAdmin()
            .from("listings")
            .select("title, event_location")
            .eq("id", listingId)
            .single();
          const creatorRes = await getSupabaseAdmin()
            .from("profiles")
            .select("full_name")
            .eq("id", creatorId)
            .single();

          if (guestEmail) {
            sendBookingConfirmationEmail({
              to: guestEmail,
              customerName: guestName || "Gäst",
              serviceName: listingRes.data?.title || "Event",
              scheduledAt: new Date(scheduledAt),
              creatorName: creatorRes.data?.full_name || "Kreatör",
              location: listingRes.data?.event_location || undefined,
              bookingId: guestBooking?.id,
            }).catch(err => console.error("Guest confirmation email failed:", err));
          }

          break;
        }

        const userId = session.metadata?.userId;

        if (!userId) break;

        // "Nycklar" purchase — credit the token ledger (platform revenue, no Connect).
        if (session.metadata?.type === "token_purchase") {
          const tokens = parseInt(session.metadata.tokens ?? "0", 10);
          const ref = (session.payment_intent as string) || session.id;
          if (!tokens) break;
          const { count } = await getSupabaseAdmin()
            .from("token_ledger")
            .select("id", { count: "exact", head: true })
            .eq("ref", ref);
          if (count && count > 0) break; // idempotent
          await getSupabaseAdmin().from("token_ledger").insert({
            profile_id: userId,
            delta: tokens,
            reason: "purchase",
            ref,
          });
          break;
        }

        // Idempotency: skip if this session has already been processed
        if (session.payment_intent) {
          const { count } = await getSupabaseAdmin()
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("stripe_payment_id", session.payment_intent as string);
          if (count && count > 0) break;
        }

        // Record promo code usage if applicable (ignore duplicate key errors on retry)
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
        }

        // Handle crew gage payments (host → crew member via Connect)
        if (session.metadata?.type === "crew_gage") {
          const gageId = session.metadata.gageId;
          const paymentIntentId = (session.payment_intent as string) || null;
          if (!gageId) {
            console.error("Webhook: missing gageId metadata for crew_gage");
            break;
          }

          const { data: gage } = await getSupabaseAdmin()
            .from("gage_agreements")
            .select("id, host_id, collaborator_user_id, amount_ore, status, listing_id")
            .eq("id", gageId)
            .maybeSingle();
          if (!gage || gage.status === "paid") break; // idempotent

          await getSupabaseAdmin()
            .from("gage_agreements")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntentId,
            })
            .eq("id", gageId)
            .neq("status", "paid");

          const { data: listing } = await getSupabaseAdmin()
            .from("listings")
            .select("title")
            .eq("id", gage.listing_id)
            .maybeSingle();
          const amountKr = Math.round((gage.amount_ore as number) / 100).toLocaleString("sv-SE");

          await getSupabaseAdmin().from("notifications").insert([
            {
              user_id: gage.collaborator_user_id,
              type: "gage_paid",
              title: "Gage betald",
              message: `Du har fått ${amountKr} kr för "${listing?.title ?? "eventet"}".`,
              link: "/app/my-collaborations",
              is_read: false,
            },
            {
              user_id: gage.host_id,
              type: "gage_paid",
              title: "Gage betald",
              message: `Betalningen på ${amountKr} kr för "${listing?.title ?? "eventet"}" är klar.`,
              link: `/app/events/${gage.listing_id}/crew`,
              is_read: false,
            },
          ]);

          break;
        }

        // Handle ticket purchases (one-time payments via Connect)
        if (session.metadata?.type === "ticket") {
          const listingId = session.metadata.listingId;
          const creatorId = session.metadata.creatorId;
          const amountPaid = session.amount_total; // already in öre
          const paymentIntentId = (session.payment_intent as string) || null;

          if (!listingId || !creatorId) {
            console.error("Webhook: missing listingId or creatorId metadata");
            break;
          }

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
            stripe_payment_id: paymentIntentId,
            amount_paid: amountPaid,
          });

          // Timed automation: count the sold ticket (atomic) for capacity.
          await getSupabaseAdmin().rpc("increment_tickets_sold", { p_listing: listingId, p_n: 1 });

          // Discount access code: consume one use now that payment succeeded.
          if (session.metadata?.accessCodeId) {
            await getSupabaseAdmin()
              .rpc("consume_access_code", { p_id: session.metadata.accessCodeId })
              .then(({ error }) => error && console.error("consume_access_code failed:", error));
          }

          // Record payment
          if (amountPaid) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              stripe_payment_id: paymentIntentId,
              amount: amountPaid,
              currency: session.currency || "sek",
              status: "succeeded",
              description: `Biljett: ${session.metadata.listingId}`,
              payment_method: paymentMethod,
            });
          }

          // Send ticket confirmation email (non-blocking)
          sendTicketConfirmationEmail(getSupabaseAdmin(), userId, creatorId!, listingId!, new Date(scheduledAt))
            .catch(err => console.error("Ticket confirmation email failed:", err));

          break;
        }

        // Handle instructor minute purchases (transferred to the instructor's
        // Connect account; creator_id = instructor, listing_id = host event).
        if (session.metadata?.type === "instructor_minutes") {
          const listingId = session.metadata.listingId;
          const instructorId = session.metadata.instructorId;
          const minutes = parseInt(session.metadata.minutes ?? "0", 10);
          const amountPaid = session.amount_total; // öre
          const paymentIntentId = (session.payment_intent as string) || null;

          if (!listingId || !instructorId || !minutes) {
            console.error("Webhook: missing instructor_minutes metadata");
            break;
          }

          await getSupabaseAdmin().from("bookings").insert({
            listing_id: listingId,
            creator_id: instructorId, // instructor is paid + sees the redeem UI
            customer_id: userId,
            status: "confirmed",
            scheduled_at: new Date().toISOString(),
            booking_type: "instructor_minutes",
            stripe_payment_id: paymentIntentId,
            amount_paid: amountPaid,
            minutes_total: minutes,
            minutes_redeemed: 0,
          });

          if (amountPaid) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              stripe_payment_id: paymentIntentId,
              amount: amountPaid,
              currency: session.currency || "sek",
              status: "succeeded",
              description: `Instruktörsminuter: ${minutes} min`,
              payment_method: paymentMethod,
            });
          }

          sendTicketConfirmationEmail(getSupabaseAdmin(), userId, instructorId, listingId, new Date())
            .catch(err => console.error("Instructor minutes confirmation email failed:", err));

          break;
        }

        // Handle paid manual bookings (payment upfront, creator still confirms)
        if (session.metadata?.type === "b2b_payment") {
          const bookingId = session.metadata.bookingId;
          const amountPaid = session.amount_total;
          const paymentIntentId = (session.payment_intent as string) || null;

          if (!bookingId) {
            console.error("Webhook: missing bookingId metadata for b2b_payment");
            break;
          }

          // Update existing confirmed booking with payment info
          await getSupabaseAdmin()
            .from("bookings")
            .update({
              stripe_payment_id: paymentIntentId,
              amount_paid: amountPaid,
            })
            .eq("id", bookingId);

          // Record payment
          if (amountPaid && userId) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              stripe_payment_id: paymentIntentId,
              amount: amountPaid,
              currency: session.currency || "sek",
              status: "succeeded",
              description: `B2B-bokning: ${bookingId}`,
              payment_method: paymentMethod,
            });
          }

          break;
        }

        if (session.metadata?.type === "paid_booking") {
          const listingId = session.metadata.listingId;
          const creatorId = session.metadata.creatorId;
          const amountPaid = session.amount_total;
          const scheduledAt = session.metadata.scheduledAt || new Date().toISOString();
          const guestCount = session.metadata.guestCount ? parseInt(session.metadata.guestCount, 10) : 1;
          const specialRequests = session.metadata.specialRequests || null;
          const notes = session.metadata.notes || null;
          const danceCount = session.metadata.danceCount ? parseInt(session.metadata.danceCount, 10) : null;
          let attendees: unknown[] = [];
          try {
            attendees = JSON.parse(session.metadata.attendees || "[]");
          } catch { /* ignore */ }

          // Payment already succeeded → auto-confirm the booking (no manual
          // creator confirmation step). The creator is notified below and can
          // still cancel (→ refund) if the proposed time doesn't work.
          await getSupabaseAdmin().from("bookings").insert({
            listing_id: listingId,
            creator_id: creatorId,
            customer_id: userId,
            status: "confirmed",
            scheduled_at: scheduledAt,
            booking_type: "manual",
            stripe_payment_id: (session.payment_intent as string) || null,
            amount_paid: amountPaid,
            guest_count: guestCount,
            special_requests: specialRequests,
            attendees,
            notes,
            ...(danceCount && danceCount > 0 ? { dances_total: danceCount, dances_redeemed: 0 } : {}),
          });

          // Notify the creator of the new paid, confirmed booking.
          if (creatorId) {
            const { data: paidListing } = await getSupabaseAdmin()
              .from("listings")
              .select("title")
              .eq("id", listingId)
              .single();
            await getSupabaseAdmin().from("notifications").insert({
              user_id: creatorId,
              type: "booking_confirmed",
              title: "Ny betald bokning",
              message: `En betald bokning för «${paidListing?.title ?? "din tjänst"}» är bekräftad.`,
              link: "/dashboard/bookings",
            });
          }

          // Record payment
          if (amountPaid) {
            await getSupabaseAdmin().from("payments").insert({
              user_id: userId,
              stripe_payment_id: (session.payment_intent as string) || null,
              amount: amountPaid,
              currency: session.currency || "sek",
              status: "succeeded",
              description: `Bokning: ${listingId}`,
              payment_method: paymentMethod,
            });
          }

          // Send confirmation email (non-blocking)
          sendTicketConfirmationEmail(getSupabaseAdmin(), userId, creatorId!, listingId!, new Date(scheduledAt))
            .catch(err => console.error("Paid booking confirmation email failed:", err));

          break;
        }

        // Handle digital product purchases
        if (session.metadata?.type === "digital_product") {
          const productId = session.metadata.product_id;
          const buyerId = session.metadata.buyer_id;
          const creatorId = session.metadata.creator_id;
          const paymentIntentId = (session.payment_intent as string) || null;

          if (productId && buyerId) {
            // Record payment
            if (session.amount_total) {
              await getSupabaseAdmin().from("payments").insert({
                user_id: buyerId,
                stripe_payment_id: paymentIntentId,
                amount: session.amount_total,
                currency: session.currency || "sek",
                status: "succeeded",
                description: `Digital product: ${productId}`,
                payment_method: paymentMethod,
              });
            }

            // Record digital purchase
            try {
              await getSupabaseAdmin().from("digital_purchases").insert({
                user_id: buyerId,
                product_id: productId,
                stripe_payment_id: paymentIntentId,
              });
            } catch {
              // table may not exist yet
            }
          }

          break;
        }

        // Handle subscription checkouts
        if (!session.subscription) break;

        const planKey = session.metadata?.plan;
        if (!planKey) {
          console.error("Webhook: No plan in session metadata, skipping subscription upsert");
          break;
        }
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
        const subStatus = subscription.status === "trialing" ? "trialing" : "active";
        const { error: upsertError } = await getSupabaseAdmin().from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: planKey,
          status: subStatus,
          current_period_start: toISO(subscription.current_period_start),
          current_period_end: toISO(subscription.current_period_end),
        });
        if (upsertError) {
          console.error("Subscription upsert failed:", upsertError);
        }

        // Record payment
        if (session.amount_total) {
          await getSupabaseAdmin().from("payments").insert({
            user_id: userId,
            stripe_payment_id: (session.payment_intent as string) || null,
            amount: session.amount_total,
            currency: session.currency || "sek",
            status: "succeeded",
            description: `Prenumeration: ${planKey}`,
            payment_method: paymentMethod,
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

        // Detect plan change from Stripe subscription items
        const currentPriceId = subscription.items?.data?.[0]?.price?.id;
        const newPlanKey = currentPriceId ? planKeyFromPriceId(currentPriceId) : null;

        // Map Stripe status to our DB status
        const statusMap: Record<string, string> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "canceled",
        };
        const dbStatus = statusMap[subscription.status] || "past_due";

        // Update subscription status (and plan if changed)
        const subscriptionUpdate: Record<string, unknown> = {
          status: dbStatus,
          current_period_start: toISO(subscription.current_period_start),
          current_period_end: toISO(subscription.current_period_end),
        };
        if (newPlanKey) {
          subscriptionUpdate.plan = newPlanKey;
        }
        await getSupabaseAdmin()
          .from("subscriptions")
          .update(subscriptionUpdate)
          .eq("stripe_subscription_id", subscription.id);

        // Sync tier on profile
        const { data: sub } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          const tier = extractTierFromPlan(sub.plan);
          if (subscription.status === "active" || subscription.status === "trialing") {
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

      case "customer.subscription.trial_will_end": {
        // Stripe sends this 3 days before trial ends
        const trialSub = event.data.object as Stripe.Subscription;

        const { data: trialSubRecord } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_subscription_id", trialSub.id)
          .single();

        if (trialSubRecord) {
          sendTrialEndingEmail(
            getSupabaseAdmin(),
            trialSubRecord.user_id,
            trialSub.trial_end ? new Date(trialSub.trial_end * 1000) : new Date(),
            3
          ).catch(err => console.error("Trial ending email failed:", err));
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

      // ── Payout status updates ──
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await getSupabaseAdmin()
          .from("payouts")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("stripe_payout_id", payout.id);
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        await getSupabaseAdmin()
          .from("payouts")
          .update({ status: "failed" })
          .eq("stripe_payout_id", payout.id);

        // Notify creator about failed payout
        const { data: failedPayout } = await getSupabaseAdmin()
          .from("payouts")
          .select("creator_id, amount_net")
          .eq("stripe_payout_id", payout.id)
          .single();

        if (failedPayout) {
          createNotification({
            userId: failedPayout.creator_id,
            type: "payout",
            title: "Payout failed",
            message: `Your payout of ${failedPayout.amount_net} SEK failed. Please check your Stripe account settings.`,
            link: "/dashboard/payouts",
          }).catch(() => {});
        }
        break;
      }

      // ── Refund handling ──
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string | null;

        if (paymentIntentId) {
          // Update payment status
          await getSupabaseAdmin()
            .from("payments")
            .update({ status: "refunded" })
            .eq("stripe_payment_id", paymentIntentId);

          // Cancel associated booking
          const { data: refundedBooking } = await getSupabaseAdmin()
            .from("bookings")
            .select("id, customer_id, creator_id, listing_id")
            .eq("stripe_payment_id", paymentIntentId)
            .single();

          if (refundedBooking) {
            await getSupabaseAdmin()
              .from("bookings")
              .update({ status: "canceled" })
              .eq("id", refundedBooking.id);

            // Notify both parties
            const { data: listing } = await getSupabaseAdmin()
              .from("listings")
              .select("title")
              .eq("id", refundedBooking.listing_id)
              .single();

            const serviceName = listing?.title || "Booking";

            if (refundedBooking.customer_id) {
              createNotification({
                userId: refundedBooking.customer_id,
                type: "booking_canceled",
                title: "Refund processed",
                message: `Your booking for "${serviceName}" has been refunded.`,
                link: "/app/tickets",
              }).catch(() => {});
            }

            createNotification({
              userId: refundedBooking.creator_id,
              type: "booking_canceled",
              title: "Booking refunded",
              message: `A booking for "${serviceName}" has been refunded.`,
              link: "/dashboard/bookings",
            }).catch(() => {});
          }
        }
        break;
      }

      // ── Dispute/Chargeback handling ──
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const disputeCharge = await stripe.charges.retrieve(dispute.charge as string);
        const disputePaymentIntent = disputeCharge.payment_intent as string | null;

        if (disputePaymentIntent) {
          const { data: disputedBooking } = await getSupabaseAdmin()
            .from("bookings")
            .select("id, creator_id, listing_id")
            .eq("stripe_payment_id", disputePaymentIntent)
            .single();

          if (disputedBooking) {
            const { data: listing } = await getSupabaseAdmin()
              .from("listings")
              .select("title")
              .eq("id", disputedBooking.listing_id)
              .single();

            createNotification({
              userId: disputedBooking.creator_id,
              type: "payout",
              title: "Payment dispute opened",
              message: `A customer has disputed a payment for "${listing?.title || "a booking"}". Amount: ${(dispute.amount / 100).toLocaleString("sv-SE")} SEK.`,
              link: "/dashboard/payouts",
            }).catch(() => {});
          }
        }

        console.warn("Dispute created:", dispute.id, "Amount:", dispute.amount, "Reason:", dispute.reason);
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log("Dispute closed:", dispute.id, "Status:", dispute.status);
        // dispute.status: 'won' | 'lost' | 'charge_refunded' | 'warning_closed'
        break;
      }

      // ── Connect account updates ──
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        if (account.id) {
          console.log("Connect account updated:", account.id, "Charges enabled:", account.charges_enabled, "Payouts enabled:", account.payouts_enabled);
        }
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

async function sendTrialEndingEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  trialEndDate: Date,
  daysLeft: number,
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!profile?.email) return;

  await sendTrialEndingEmailService({
    to: profile.email,
    memberName: profile.full_name || "Medlem",
    trialEndDate,
    daysLeft,
  });
}
