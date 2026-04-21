/**
 * Subscription checkout — `POST /api/subscription/checkout`
 *
 * **Phase 1 stub.** Returns the URL of an externally-hosted Stripe
 * Checkout session. Phase 3 wires the real Stripe integration:
 *
 *   1. Read `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET`
 *      from env.
 *   2. Create a Stripe Checkout Session server-side for the configured
 *      price (Peanut Gallery Plus — $8/month default).
 *   3. Return the `checkoutUrl` so the extension can `window.open` it.
 *   4. Webhook (`/api/subscription/webhook`) handles `checkout.session.completed`
 *      → generate license key → email to user → persist mapping.
 *
 * Phase 1: returns a hard-coded "coming soon" URL so the extension
 * button works without breaking. Seth flips the STRIPE_ENABLED flag
 * + drops the real keys in env, and the Phase 3 code path activates.
 *
 * Wire contract:
 *   POST /api/subscription/checkout
 *   Body: { email: string }
 *   Response 200: { checkoutUrl: string, stripeEnabled: boolean }
 *   Response 400: { error, code: "INVALID_EMAIL" }
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

  if (!STRIPE_ENABLED) {
    // Phase 1: Stripe isn't set up yet. Log + return a landing-page URL
    // the extension opens; landing page explains the status.
    logPipeline({
      event: "subscription_checkout_stub",
      level: "info",
      data: { email, phase: "stripe_not_configured" },
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

  // TODO(phase-3): implement Stripe Checkout Session creation via fetch
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
  //       "success_url": `${process.env.PUBLIC_APP_URL}/plus/welcome?s={CHECKOUT_SESSION_ID}`,
  //       "cancel_url": `${process.env.PUBLIC_APP_URL}/plus/cancelled`,
  //       "allow_promotion_codes": "true",
  //     }),
  //   }).then((r) => r.json());
  //   return jsonResponse({ checkoutUrl: res.url, stripeEnabled: true }, 200);

  logPipeline({
    event: "subscription_checkout_stub",
    level: "warn",
    data: { email, phase: "stripe_configured_but_handler_stub" },
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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
