/**
 * Subscription checkout — `POST /api/subscription/checkout`
 *
 * **Phase 1 stub.** Returns the URL of an externally-hosted Stripe
 * Checkout session. Phase 3 wires the real Stripe integration:
 *
 *   1. Read `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET`
 *      from env.
 *   2. Create a Stripe Checkout Session server-side for the configured
 *      price (Peanut Gallery Plus — $8/month default) with
 *      `billing_address_collection: 'required'` and an
 *      `allowed_countries: ['US']` shipping-style filter so Stripe's own
 *      UI rejects non-U.S. billing addresses.
 *   3. Return the `checkoutUrl` so the extension can `window.open` it.
 *   4. Webhook (`/api/subscription/webhook`) handles `checkout.session.completed`
 *      → re-verifies billing country from `customer_details.address.country`
 *      → refund + revoke if not US (defense in depth)
 *      → otherwise: generate license key → email to user → persist mapping.
 *
 * Phase 1: returns a hard-coded "coming soon" URL so the extension
 * button works without breaking. Seth flips the STRIPE_ENABLED flag
 * + drops the real keys in env, and the Phase 3 code path activates.
 *
 * **US-only gate (2026-04-21).** Peanut Gallery Plus is offered only to
 * users in the United States (see Terms of Service §1.3). The extension
 * collects an affirmative country confirmation before kicking off
 * checkout and forwards it as the `country` field in this request body.
 * This server checks the client-asserted country and rejects non-US
 * immediately with HTTP 451 (Unavailable For Legal Reasons). Phase 3
 * adds Stripe-side enforcement via `billing_address_collection` and a
 * webhook-time re-check against the billing address Stripe actually
 * collected — the single client-side flag is not load-bearing.
 *
 * Wire contract:
 *   POST /api/subscription/checkout
 *   Body: { email: string, country?: string }
 *           country is an ISO 3166-1 alpha-2 code; defaults to "US" for
 *           older clients. Non-US values are rejected.
 *   Response 200: { checkoutUrl: string, stripeEnabled: boolean }
 *   Response 400: { error, code: "INVALID_EMAIL" }
 *   Response 451: { error, code: "US_ONLY" }
 *   Response 503: { error, code: "SUBSCRIPTION_DISABLED" | "STRIPE_NOT_CONFIGURED" }
 */

import { logPipeline } from "../../../../lib/debug-logger";
import { isSubscriptionEnabled } from "../../../../lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const STRIPE_ENABLED =
  (process.env.STRIPE_ENABLED || "").toLowerCase() === "true";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  if (!isSubscriptionEnabled()) {
    return jsonResponse(
      {
        error: "Peanut Gallery Plus isn't enabled on this backend.",
        code: "SUBSCRIPTION_DISABLED",
      },
      503
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !isValidEmail(email)) {
    return jsonResponse(
      { error: "Invalid email address", code: "INVALID_EMAIL" },
      400
    );
  }

  // US-only gate. Client asserts the country it's subscribing from; we
  // reject anything but US at this layer and Stripe will re-verify at
  // Phase 3 via billing-address collection. Older clients that don't
  // send the field default to US for forward compatibility — the real
  // enforcement happens at Stripe and in the webhook.
  const rawCountry =
    typeof body.country === "string" ? body.country.trim().toUpperCase() : "US";
  if (rawCountry !== "US") {
    logPipeline({
      event: "subscription_checkout_us_only_rejected",
      level: "info",
      data: { email: emailForLog(email), country: rawCountry },
    });
    return jsonResponse(
      {
        error:
          "Peanut Gallery Plus is available only to users in the United States. If you're outside the US, use My-Keys Mode or self-host — see docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md on GitHub.",
        code: "US_ONLY",
      },
      451
    );
  }

  if (!STRIPE_ENABLED) {
    // Phase 1: Stripe isn't set up yet. Log + return a landing-page URL
    // the extension opens; landing page explains the status.
    logPipeline({
      event: "subscription_checkout_stub",
      level: "info",
      data: { email: emailForLog(email), phase: "stripe_not_configured" },
    });
    return jsonResponse(
      {
        checkoutUrl: "https://www.peanutgallery.live/plus?pre-launch=1",
        stripeEnabled: false,
      },
      200
    );
  }

  // Phase 3 (real Stripe) — guarded until env is set up:
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeSecret || !priceId) {
    return jsonResponse(
      {
        error: "Stripe is not configured on this backend.",
        code: "STRIPE_NOT_CONFIGURED",
      },
      503
    );
  }

  // TODO(phase-3): implement Stripe Checkout Session creation via fetch.
  // The US-only posture is enforced by (a) the client-asserted country
  // check above, (b) Stripe's `billing_address_collection: 'required'`
  // combined with a shipping-style allowed_countries filter, and
  // (c) webhook-time re-verification of `customer_details.address.country`.
  //
  //   const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
  //     method: "POST",
  //     headers: {
  //       "Authorization": `Bearer ${stripeSecret}`,
  //       "Content-Type": "application/x-www-form-urlencoded",
  //     },
  //     body: new URLSearchParams({
  //       "customer_email": email,
  //       "mode": "subscription",
  //       "line_items[0][price]": priceId,
  //       "line_items[0][quantity]": "1",
  //       "billing_address_collection": "required",
  //       // US-only: using shipping_address_collection as the country
  //       // gate because Stripe's billing_address_collection itself
  //       // doesn't expose a country filter. Shipping isn't actually
  //       // shipped (digital goods); this is the canonical US-only
  //       // checkout pattern.
  //       "shipping_address_collection[allowed_countries][0]": "US",
  //       "success_url": `${process.env.PUBLIC_APP_URL}/plus/welcome?s={CHECKOUT_SESSION_ID}`,
  //       "cancel_url": `${process.env.PUBLIC_APP_URL}/plus/cancelled`,
  //       "allow_promotion_codes": "true",
  //     }),
  //   }).then((r) => r.json());
  //   return jsonResponse({ checkoutUrl: res.url, stripeEnabled: true }, 200);

  logPipeline({
    event: "subscription_checkout_stub",
    level: "warn",
    data: {
      email: emailForLog(email),
      phase: "stripe_configured_but_handler_stub",
    },
  });
  return jsonResponse(
    {
      checkoutUrl: "https://www.peanutgallery.live/plus?pre-launch=1",
      stripeEnabled: true,
    },
    200
  );
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/**
 * Redact the local part of an email for log output — we need to
 * correlate support tickets by email but shouldn't splatter full
 * addresses into the pipeline log.
 */
function emailForLog(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${domain}`;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
