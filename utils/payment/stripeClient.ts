import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

if (secretKey) {
  stripeClient = new Stripe(secretKey);
} else {
  console.warn(
    "[stripe]: STRIPE_SECRET_KEY is not set — the API will start normally, but payment endpoints are disabled until Stripe is configured."
  );
}

export const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY to use payment endpoints.");
  }

  return stripeClient;
};

export const isStripeConfigured = () => Boolean(stripeClient);
