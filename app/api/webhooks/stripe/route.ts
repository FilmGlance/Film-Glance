// app/api/webhooks/stripe/route.ts
// Handles ALL Stripe webhook events for subscription lifecycle.
// This is the SINGLE SOURCE OF TRUTH for billing state.
//
// Events handled:
//   checkout.session.completed  → User finished checkout, activate subscription
//   invoice.payment_succeeded   → Recurring payment succeeded, keep active
//   invoice.payment_failed      → Payment failed, mark past_due
//   customer.subscription.updated → Plan change, cancellation scheduled
//   customer.subscription.deleted → Subscription fully canceled
//
// Setup:
//   1. In Stripe Dashboard → Webhooks → Add endpoint
//   2. URL: https://yourapp.com/api/webhooks/stripe
//   3. Events: checkout.session.completed, invoice.payment_succeeded,
//      invoice.payment_failed, customer.subscription.updated,
//      customer.subscription.deleted

import { NextRequest, NextResponse } from "next/server";
import { stripe, priceIdToPlan } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── User completes checkout ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.user_id;

        if (!userId || !subscriptionId) {
          console.error("Missing user_id or subscription in checkout session");
          break;
        }

        // Fetch the subscription to get plan details
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        const planId = priceIdToPlan(priceId);

        // Update profile with Stripe customer ID and plan
        await supabaseAdmin
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            plan_id: planId,
            searches_this_month: 0, // Reset on upgrade
          })
          .eq("id", userId);

        // Create subscription record
        await supabaseAdmin.from("subscriptions").upsert({
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });

        console.log(`✅ Checkout completed: user=${userId} plan=${planId}`);
        break;
      }

      // ── Recurring payment succeeded ──────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        const planId = priceIdToPlan(priceId);

        // Update subscription status
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            plan_id: planId,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        // Ensure profile plan is current
        const { data: subRecord } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (subRecord) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan_id: planId })
            .eq("id", subRecord.user_id);
        }

        console.log(`✅ Payment succeeded: sub=${subscriptionId} plan=${planId}`);
        break;
      }

      // ── Payment failed ───────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", subscriptionId);

        console.log(`⚠️ Payment failed: sub=${subscriptionId}`);
        break;
      }

      // ── Subscription updated (plan change, cancel scheduled) ─
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const planId = priceIdToPlan(priceId);

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: sub.status,
            plan_id: planId,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at: sub.cancel_at
              ? new Date(sub.cancel_at * 1000).toISOString()
              : null,
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", sub.id);

        // Update profile plan
        const { data: subRecord } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (subRecord) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan_id: planId })
            .eq("id", subRecord.user_id);
        }

        console.log(`🔄 Subscription updated: sub=${sub.id} status=${sub.status} plan=${planId}`);
        break;
      }

      // ── Subscription deleted (fully canceled) ────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        // Downgrade to free
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id);

        const { data: subRecord } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (subRecord) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan_id: "free" })
            .eq("id", subRecord.user_id);
        }

        console.log(`❌ Subscription deleted: sub=${sub.id} → downgraded to free`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
