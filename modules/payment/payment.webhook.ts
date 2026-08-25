import { Router, Request, Response } from "express";
import { stripeClient } from "../../utils/payment/stripeClient";
import { finalizePayment } from "./payment.service";

const webhookRouter = Router();

// Stripe needs the RAW request body (not JSON-parsed) to verify the signature,
// so this route must be registered BEFORE express.json() runs on it.
webhookRouter.post(
    "/stripe",
    async (req: Request, res: Response) => {
        const signature = req.headers["stripe-signature"] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

        let event;
        try {
            event = stripeClient.webhooks.constructEvent(req.body, signature, webhookSecret);
        } catch (err: any) {
            console.error("[stripe webhook] Signature verification failed:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === "payment_intent.succeeded") {
            const intent = event.data.object as any;
            await finalizePayment(intent.id);
        }

        // Always acknowledge receipt so Stripe doesn't keep retrying
        res.json({ received: true });
    }
);

export default webhookRouter;