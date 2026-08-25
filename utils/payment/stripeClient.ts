import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn(
    "[stripe]: STRIPE_SECRET_KEY is not set — payment endpoints will fail until it's configured."
  );
}

export const stripeClient = new Stripe(secretKey || "");