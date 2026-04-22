/**
 * Stripe webhook — `POST /api/subscription/webhook`
 *
 * **Phase 1 stub.** Returns 200 OK after logging the raw event so
 * Seth can configure the webhook URL in the Stripe dashboard before
 * the signature verification + persistence code lands (Phase 3).
 *
 * Phase 3 will implement:
 *
 *   1. Verify `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`
 *      (HMAC-SHA256 over the raw body + signed timestamp). Reject
 *      anything without a valid signature or > 5 min skew.
 *   2. Switch on `event.type`:
 *        `checkout.session.completed`   → verify billing country is US
 *                                         (see US-only gate below); if
 *                                         non-US, immediately refund +
 *                                         cancel the subscription via
 *                                         Stripe API and DO NOT issue a
 *                                         license key. If US: generate
 *                                         license key, persist {key,
 *                                         email, stripeSubId, createdAt},
 *                                         email key to user.
 *        `customer.subscription.updated` → reconcile status in store.
 *                                         If country changes to non-US
 *                                         via address update (rare),
 *                                         treat as cancellation.
 *        `customer.subscription.deleted` → mark key revoked; the
 *                                         validator starts returning
 *                                         INVALID_KEY on the next call.
 *   3. Return 200 on success (Stripe retries on non-2xx).
 *
 * **US-only gate (see Terms §1.3).** The checkout route rejects
 * client-asserted non-US requests immediately. Stripe itself enforces
 * the country filter via `shipping_address_collection.allowed_countries`
 * when Phase 3 ships. This webhook is defense-in-depth: even if a user
 * slips through Stripe's UI with a non-US billing address (proxy, VPN,
 * Stripe UI bug), we refuse the license key and refund.
 *
 * Why a stub endpoint exists already: Stripe requires a reachable
 * webhook URL during dashboard setup. Seth can register
 * `https://api.peanutgallery.live/api/subscription/webhook` before any
 * real handler is wired, and events accumulate in the pipeline log
 * ready to be replayed once the real handler ships.
 */

import { logPipeline } from "../../../../lib/debug-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No CORS — webhooks are server-to-server. Stripe POSTs from its
// own IPs. Same-origin-ish; we don't set Access-Control headers.

export async function POST(req: Request) {
  const signature = req.headers.get("Stripe-Signature") || null;
  const rawBody = await req.text();

  // Phase 1 stub: log everything so the event stream is at least
  // recorded. Phase 3 swaps the body-parse for signature-verified
  // parsing.
  let parsed: unknown = rawBody;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // Leave as string
  }

  // Phase 1 US-only visibility: if the event is a completed checkout,
  // log the billing country so Seth can audit whether Stripe's
  // allowed-countries filter is doing its job. This does NOT yet
  // refund non-US sessions — that's Phase 3 once the handler can
  // authenticate itself to the Stripe API.
  const eventObj = parsed as {
    type?: string;
    data?: {
      object?: {
        customer_details?: { address?: { country?: string } };
        customer?: string;
      };
    };
  } | null;
  const eventType = eventObj?.type ?? "unknown";
  const billingCountry =
    eventObj?.data?.object?.customer_details?.address?.country ?? null;

  if (eventType === "checkout.session.completed" && billingCountry && billingCountry !== "US") {
    logPipeline({
      event: "subscription_webhook_non_us_completed",
      level: "warn",
      data: {
        phase: "stub",
        billingCountry,
        note:
          "Non-US checkout reached webhook. Phase 3 must refund + cancel. See SUBSCRIPTION-ARCHITECTURE.md and Terms §1.3.",
      },
    });
  }

  logPipeline({
    event: "subscription_webhook_received",
    level: "info",
    data: {
      phase: "stub",
      hasSignature: !!signature,
      eventType,
      billingCountry,
      rawBodyLen: rawBody.length,
      note:
        "Stub handler — signature not verified, no state written. See SUBSCRIPTION-ARCHITECTURE.md § Phase 3.",
    },
  });

  return new Response(JSON.stringify({ ok: true, phase: "stub" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
