import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

if (secretKey) {
  stripeClient = new Stripe(secretKey, {
    timeout: 15000,
    maxNetworkRetries: 1,
  });
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

export const getStripeDiagnostics = async () => {
  const configured = Boolean(stripeClient && secretKey);
  const mode = !secretKey
    ? "not_configured"
    : secretKey.startsWith("sk_test_")
      ? "test"
      : secretKey.startsWith("sk_live_")
        ? "live"
        : "unknown";
  const webhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  if (!stripeClient) {
    return {
      configured: false,
      reachable: false,
      mode,
      webhookConfigured,
      message: "STRIPE_SECRET_KEY is not configured",
    };
  }

  try {
    // This is a read-only API call that validates the configured secret key
    // without creating or modifying Stripe objects.
    await stripeClient.balance.retrieve();
    return {
      configured,
      reachable: true,
      mode,
      webhookConfigured,
      message: webhookConfigured
        ? "Stripe credentials are valid and the webhook secret is configured"
        : "Stripe credentials are valid, but STRIPE_WEBHOOK_SECRET is missing",
    };
  } catch {
    return {
      configured,
      reachable: false,
      mode,
      webhookConfigured,
      message: "Stripe rejected the configured credentials or could not be reached",
    };
  }
};
