import { Request, Response } from "express";
import Stripe from "stripe";
import { stripeClient, STRIPE_WEBHOOK_SECRET } from "./stripe.service";
import paymentRepository from "./payment.repository";
import { markPaymentFailed, markPaymentPaid } from "./payment.service";


type StripeWebhookRequest = Request & {
  rawBody?: Buffer;
};
/**
 * Small, non-sensitive subset of event.data.object kept for audit/debugging.
 * Deliberately NOT storing the full Stripe object — Checkout Session and
 * PaymentIntent objects can carry customer PII (email, billing address)
 * that this audit log has no reason to duplicate.
 */
function snapshotOf(event: Stripe.Event): Record<string, unknown> {
  const obj = event.data.object as unknown as Record<string, unknown>;
  return {
    id: obj.id,
    object: obj.object,
    status: (obj as { status?: unknown }).status ?? null,
    payment_status: (obj as { payment_status?: unknown }).payment_status ?? null,
  };
}

async function dispatchEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // "paid" = confirmed immediately (cards, most methods).
      // "unpaid" here means an async payment method (e.g. certain bank
      // debits) is still settling — wait for async_payment_succeeded/failed
      // below rather than confirming now.
      if (session.payment_status === "paid") {
        await markPaymentPaid(
          session.id,
          session.payment_intent as string,
          (session.customer as string) ?? null
        );
      }
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentPaid(
        session.id,
        session.payment_intent as string,
        (session.customer as string) ?? null
      );
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentFailed(session.id, "Asynchronous payment method failed");
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentFailed(session.id, "Checkout session expired");
      break;
    }

    default:
      // Unhandled event type — acknowledged but no-op. Stripe sends many
      // event types we don't act on; explicitly listing "known, ignored"
      // vs silently 200-ing everything makes it clear this was a
      // deliberate choice, not an oversight, if you're reading logs later.
      console.log(`[webhook] Unhandled event type: ${event.type}`);
  }
}

export const handleStripeWebhook = async (req: StripeWebhookRequest, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "Missing Stripe-Signature header" });
  }
  if (!req.rawBody) {
    // Indicates app.ts's express.json({ verify }) isn't wired correctly —
    // fail loudly rather than attempting signature verification against
    // the parsed (and therefore non-byte-identical) req.body.
    console.error(
      "[webhook] req.rawBody is missing — check app.ts's express.json() verify callback"
    );
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(
      req.rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    // Signature mismatch, expired timestamp, malformed payload — always a
    // 400, never processed. This is the line that makes the whole endpoint
    // trustworthy: nothing below this point runs for a request that isn't
    // provably from Stripe.
    console.error("[webhook] signature verification failed:", err?.message);
    return res
      .status(400)
      .json({ error: "Webhook signature verification failed" });
  }

  let shouldProcess = true;
  try {
    await paymentRepository.recordWebhookEvent(
      event.id,
      event.type,
      event.livemode,
      snapshotOf(event)
    );
  } catch (err: any) {
    if (err?.code === 11000) {
      const existing = await paymentRepository.findWebhookEventByStripeId(
        event.id
      );
      if (existing?.status === "processed") {
        // Genuine replay of an event we already fully handled — Stripe's
        // at-least-once delivery. Ack and stop, do NOT reprocess.
        return res.status(200).json({ received: true, deduped: true });
      }
      // status is "received" (crashed mid-processing) or "failed"
      // (threw last time) — fall through and retry.
      shouldProcess = true;
    } else {
      throw err;
    }
  }

  if (shouldProcess) {
    try {
      await dispatchEvent(event);
      await paymentRepository.markWebhookEventProcessed(event.id);
    } catch (err: any) {
      await paymentRepository.markWebhookEventFailed(
        event.id,
        err?.message ?? "Unknown error during webhook processing"
      );
      // 500, deliberately — this tells Stripe to retry with backoff.
      // A processing failure on our side (DB hiccup, bug) is exactly the
      // case where we WANT another delivery attempt later, unlike a bad
      // signature (400, never retry) or a genuine duplicate (200, stop).
      return res.status(500).json({ received: false });
    }
  }

  return res.status(200).json({ received: true });
};
