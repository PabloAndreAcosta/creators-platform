import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Use service role for webhook (no user context) — lazy init to avoid build errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

        // Creator tier subscription
        if (session.metadata?.type === "creator_tier" && session.metadata?.userId) {
          const tier = session.metadata.tier as "gold" | "platinum";
          const userId = session.metadata.userId;

          const { error: tierError } = await getSupabaseAdmin()
            .from("profiles")
            .update({ tier })
            .eq("id", userId);

          if (tierError) {
            console.error("Failed to update creator tier:", tierError);
          }

          // Store subscription record if present
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            await getSupabaseAdmin().from("subscriptions").upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              plan: `creator_${tier}`,
              status: "active",
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            });
          }
          break;
        }

        // Regular plan subscription
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        await getSupabaseAdmin().from("subscriptions").upsert({
          user_id: session.metadata?.userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: session.metadata?.plan || "basic",
          status: "active",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // Update subscription record
        await getSupabaseAdmin()
          .from("subscriptions")
          .update({
            status: subscription.status === "active" ? "active" : "past_due",
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        // Check if this is a creator tier subscription
        const { data: sub } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub?.plan?.startsWith("creator_")) {
          const tier = sub.plan.replace("creator_", "") as "gold" | "platinum";
          if (subscription.status === "active") {
            await getSupabaseAdmin().from("profiles").update({ tier }).eq("id", sub.user_id);
          } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
            await getSupabaseAdmin().from("profiles").update({ tier: "silver" }).eq("id", sub.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Check if this is a creator tier subscription — revert to silver
        const { data: deletedSub } = await getSupabaseAdmin()
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (deletedSub?.plan?.startsWith("creator_")) {
          await getSupabaseAdmin()
            .from("profiles")
            .update({ tier: "silver" })
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
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
