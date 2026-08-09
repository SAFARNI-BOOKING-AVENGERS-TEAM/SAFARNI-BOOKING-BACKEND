import Stripe from "stripe";

/**
 * Pinned to the exact API version this SDK's TypeScript types were
 * generated against (see node_modules/stripe/esm/apiVersion.d.ts).
 * Pinning explicitly — rather than omitting apiVersion and letting Stripe
 * fall back to the account's dashboard-configured default — means an
 * account-level version change on Stripe's side can never silently alter
 * this API's response shapes out from under the code.
 */
const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[stripe.service] Missing required environment variable: ${name}. ` +
        `Payment features cannot start without it — see .env.example.`
    );
  }
  return value;
}

/**
 * Fails fast at process startup (import time) rather than on the first
 * checkout request. A payment feature that silently no-ops or throws only
 * when a customer happens to hit it is worse than a service that refuses
 * to boot with a clear error.
 */
const stripeSecretKey = requireEnv("STRIPE_SECRET_KEY");

export const STRIPE_WEBHOOK_SECRET = requireEnv("STRIPE_WEBHOOK_SECRET");

export const stripeClient = new Stripe(stripeSecretKey, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
  // A payment request that times out client-side but actually succeeded
  // on Stripe's end is exactly the double-charge scenario we're guarding
  // against elsewhere (idempotency keys). Stripe's SDK deduplicates
  // automatic retries using the same Idempotency-Key header we already
  // attach per-request, so retrying here is safe, not just convenient.
  maxNetworkRetries: 2,
  timeout: 20_000,
  appInfo: {
    name: "Safarni Booking Backend",
    version: "1.0.0",
  },
});
