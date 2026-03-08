import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

function tierFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "free";
}

/**
 * Extract period dates from a subscription by expanding its latest invoice.
 */
async function getPeriodDates(subscriptionId: string) {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  const invoice = sub.latest_invoice as Stripe.Invoice | null;
  return {
    subscription: sub,
    periodStart: invoice?.period_start
      ? new Date(invoice.period_start * 1000).toISOString()
      : null,
    periodEnd: invoice?.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null,
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("Stripe webhook received:", event.type);

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session:", {
          mode: session.mode,
          subscription: session.subscription,
          customer: session.customer,
        });
        if (session.mode !== "subscription" || !session.subscription) break;

        const { subscription, periodStart, periodEnd } =
          await getPeriodDates(session.subscription as string);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = tierFromPriceId(priceId);

        console.log("Updating profile:", {
          customer: session.customer,
          priceId,
          tier,
          envBasic: process.env.STRIPE_BASIC_PRICE_ID,
          envPro: process.env.STRIPE_PRO_PRICE_ID,
        });

        const { error: updateError, count } = await admin
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", session.customer as string);

        console.log("Profile update result:", { error: updateError, count });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const { subscription, periodStart, periodEnd } =
          await getPeriodDates(sub.id);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = tierFromPriceId(priceId);

        await admin
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_status: subscription.status,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await admin
          .from("profiles")
          .update({
            subscription_tier: "free",
            subscription_status: "canceled",
            stripe_subscription_id: null,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer as string);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        await admin
          .from("profiles")
          .update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", invoice.customer as string);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
