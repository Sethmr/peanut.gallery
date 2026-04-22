/**
 * Subscription checkout — `POST /api/subscription/checkout`
 *
 * Phase 3 (SET-26) — real Stripe Checkout Session creation. Replaces
 * the Phase 1 stub that returned a "coming soon" URL. The handler
 * still falls back to the Phase 1 stub URL when `STRIPE_ENABLED` is
 * off, so self-hosters + development environments that haven't wired
 * Stripe see no behavior change.
 *
 * FLOW (Phase 3, with STRIPE_ENABLED=true + real keys)
 * ────────────────────────────────────────────────────
 *   1. Client (extension) POSTs `{email, country: "US"}`.
 *   2. We validate the email + reject non-US (US-only gate; Terms §1.3).
 *   3. We POST to Stripe's `/v1/checkout/sessions` with:
 *      - `mode=subscription`
 *      - `line_items[0][price]=STRIPE_PRICE_ID`
 *      - `customer_email=<user email>` (prefills Stripe's form)
 *      - `billing_address_collection=required`
 *      - `shipping_address_collection[allowed_countries][0]=US` — this
 *        is the canonical Stripe-side US-only enforcement; even if a
 *        user somehow POSTs from outside with `country: "US"` in the
 *        body, Stripe's hosted form rejects non-US addresses.
 *      - `allow_promotion_codes=true`
 *      - `success_url` + `cancel_url` pointing at the marketing site.
 *      - `metadata[pg_email]` so the webhook can correlate back.
 *   4. We return `{checkoutUrl, stripeEnabled: true}`.
 *   5. Extension `window.open`s the URL; user pays on Stripe's UI.
 *   6. Stripe fires `checkout.session.completed` → see webhook route.
 *
 * US-ONLY ENFORCEMENT LAYERS
 * ──────────────────────────
 *   1. Client confirm() in the extension — affirmative representation.
 *   2. This handler's `country !== "US"` check — HTTP 451.
 *   3. Stripe's `shipping_address_collection.allowed_countries: ['US']`
 *      — hosted form won't accept non-US addresses.
 *   4. Webhook re-verification of `customer_details.address.country`
 *      — refund + revoke if a non-US address somehow lands anyway.
 *
 * Wire contract:
 *   POST /api/subscription/checkout
 *   Body: { email: string, country?: string }
 *           country is ISO 3166-1 alpha-2; defaults to "US" for older
 *           clients. Non-US values are rejected with HTTP 451.
 *   Response 200: { checkoutUrl: string, stripeEnabled: boolean, sessionId?: string }
 *   Response 400: { error, code: "INVALID_EMAIL" }
 *   Response 451: { error, code: "US_ONLY" }
 *   Response 502: { error, code: "STRIPE_UPSTREAM_ERROR" }
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

// Default hosted-tier URL. Phase 4 may expose a dedicated /plus/welcome
// + /plus/cancelled page; until then the marketing landing is fine.
const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || "https://www.peanutgallery.live";

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

  // US-only gate (Terms §1.3). The extension always sends "US";
  // defending against direct POSTs that assert otherwise.
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
    // Phase 1 stub fallback. Keeps the extension button working in
    // environments that haven't flipped STRIPE_ENABLED yet.
    logPipeline({
      event: "subscription_checkout_stub",
      level: "info",
      data: { email: emailForLog(email), phase: "stripe_not_enabled" },
    });
    return jsonResponse(
      {
        checkoutUrl: "https://www.peanutgallery.live/plus?pre-launch=1",
        stripeEnabled: false,
      },
      200
    );
  }

  // Phase 3 — real Stripe.
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripeSecret || !priceId) {
    return jsonResponse(
      {
        error:
          "Stripe is enabled but STRIPE_SECRET_KEY and/or STRIPE_PRICE_ID are missing.",
        code: "STRIPE_NOT_CONFIGURED",
      },
      503
    );
  }

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", email);
  form.set("billing_address_collection", "required");
  // US-only enforcement at the Stripe layer. Shipping collection is
  // used as the country filter for digital goods — Stripe doesn't
  // expose a country filter on `billing_address_collection`, so this
  // is the canonical pattern.
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("allow_promotion_codes", "true");
  form.set(
    "success_url",
    `${PUBLIC_APP_URL}/plus/welcome?s={CHECKOUT_SESSION_ID}`
  );
  form.set("cancel_url", `${PUBLIC_APP_URL}/plus/cancelled`);
  // Put the user-asserted email into metadata so the webhook can
  // fall back on it if Stripe returns a normalized address that
  // differs (very rare — Stripe normally preserves the original).
  form.set("metadata[pg_email]", email);
  form.set("metadata[pg_country_asserted]", "US");

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Version pin — prevents Stripe from rolling new response
        // fields into us without us opting in. 2024-06-20 is the
        // current stable version at the time of this ticket; bump
        // after reading Stripe's changelog + updating the webhook
        // shape if needed.
        "Stripe-Version": "2024-06-20",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<unreadable>");
      logPipeline({
        event: "subscription_checkout_stripe_error",
        level: "error",
        data: {
          email: emailForLog(email),
          status: res.status,
          bodyPrefix: errText.slice(0, 400),
        },
      });
      return jsonResponse(
        {
          error:
            "Couldn't create a checkout session. Please try again in a moment.",
          code: "STRIPE_UPSTREAM_ERROR",
        },
        502
      );
    }

    const data = (await res.json()) as {
      id?: string;
      url?: string;
    };
    if (!data.url) {
      logPipeline({
        event: "subscription_checkout_stripe_no_url",
        level: "error",
        data: { email: emailForLog(email), sessionId: data.id ?? null },
      });
      return jsonResponse(
        {
          error: "Stripe returned a session without a URL. Try again.",
          code: "STRIPE_UPSTREAM_ERROR",
        },
        502
      );
    }

    logPipeline({
      event: "subscription_checkout_created",
      level: "info",
      data: {
        email: emailForLog(email),
        sessionId: data.id ?? null,
      },
    });
    return jsonResponse(
      {
        checkoutUrl: data.url,
        sessionId: data.id,
        stripeEnabled: true,
      },
      200
    );
  } catch (err) {
    logPipeline({
      event: "subscription_checkout_fetch_failed",
      level: "error",
      data: {
        email: emailForLog(email),
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return jsonResponse(
      {
        error: "Couldn't reach Stripe. Please try again in a moment.",
        code: "STRIPE_UPSTREAM_ERROR",
      },
      502
    );
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

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
