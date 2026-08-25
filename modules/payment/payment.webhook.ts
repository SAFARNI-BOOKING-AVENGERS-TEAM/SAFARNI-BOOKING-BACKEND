import { Router, Request, Response } from "express";
import { getStripeClient, isStripeConfigured } from "../../utils/payment/stripeClient";
import { finalizePayment } from "./payment.service";

const webhookRouter = Router();

webhookRouter.post(
  "/stripe",
  async (req: Request, res: Response) => {
    if (!isStripeConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Stripe is not configured on this server",
      });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({
        success: false,
        message: "Stripe webhook secret is not configured",
      });
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      return res.status(400).send("Missing Stripe signature");
    }

    let event;
    try {
      const stripeClient = getStripeClient();
      event = stripeClient.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (err: any) {
      console.error("[stripe webhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as any;
      await finalizePayment(intent.id);
    }

    return res.json({ received: true });
  }
);

export default webhookRouter;
