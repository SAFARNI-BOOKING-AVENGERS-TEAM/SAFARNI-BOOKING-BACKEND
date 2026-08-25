import { Router, Request, Response } from "express";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "../../utils/payment/stripeClient";
import {
  finalizePayment,
  finalizeCheckoutSession,
  markPaymentFailed,
} from "./payment.service";

const webhookRouter = Router();

webhookRouter.post(
  "/stripe",
  async (req: Request, res: Response) => {
    if (!isStripeConfigured()) {
      return res.status(503).json({ success: false, message: "Stripe is not configured on this server" });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ success: false, message: "Stripe webhook secret is not configured" });
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") return res.status(400).send("Missing Stripe signature");

    let event: Stripe.Event;
    try {
      const stripeClient = getStripeClient();
      event = stripeClient.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[stripe webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.payment_status === "paid") await finalizeCheckoutSession(session);
          break;
        }
        case "payment_intent.succeeded": {
          const intent = event.data.object as Stripe.PaymentIntent;
          await finalizePayment(intent.id);
          break;
        }
        case "payment_intent.payment_failed": {
          const intent = event.data.object as Stripe.PaymentIntent;
          await markPaymentFailed(intent.id);
          break;
        }
      }
    } catch (error) {
      console.error(`[stripe webhook] Failed to process ${event.type}:`, error);
      return res.status(500).json({ received: false });
    }

    return res.json({ received: true });
  }
);

export default webhookRouter;
