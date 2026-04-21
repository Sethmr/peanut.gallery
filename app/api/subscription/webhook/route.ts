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
 *        `checkout.session.completed`   → generate license key, persist
 *                                         {key, email, stripeSubId,
 *                                         createdAt}, email key to user
 *        `customer.subscription.updated` → reconcile status in store
 *        `customer.subscription.deleted` → mark key revoked; the
 *                                         validator starts returning
 *                                         INVALID_KEY on the next call
 *   3. Return 200 on success (Stripe retries on non-2xx).
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

  logPipeline({
    event: "subscription_webhook_received",
    level: "info",
    data: {
      phase: "stub",
      hasSignature: !!signature,
      eventType:
        (parsed as { type?: string } | null)?.type ?? "unknown",
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
