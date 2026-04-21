/**
 * Subscription management — `POST /api/subscription/manage`
 *
 * **Phase 1 stub.** Accepts the user's signup email, logs an intent
 * event, and returns a placeholder success response. The real
 * implementation (Phase 3 in SUBSCRIPTION-ARCHITECTURE.md) sends a
 * magic link to the email for any of the following flows:
 *
 *   - "I lost my key" — mails the key associated with this email.
 *   - "Cancel my subscription" — mails a Stripe customer-portal link.
 *   - "Update my billing details" — same, different portal view.
 *
 * Phase 1 rationale: Seth will set up Stripe; SMTP integration
 * (Resend / Postmark / SES) ships alongside. Until then, this
 * endpoint is a no-op placeholder so the extension can render the
 * "Manage subscription" button without 404-ing, and so the server-
 * side log captures the intent for follow-up contact.
 *
 * Wire contract:
 *   POST /api/subscription/manage
 *   Body: { email: string, action?: "recover_key" | "cancel" | "billing" }
 *   Response 200: { ok: true, sent: boolean, message: string }
 *   Response 400: { error, code: "INVALID_EMAIL" | "INVALID_ACTION" }
 *   Response 503: { error, code: "SUBSCRIPTION_DISABLED" }
 */

import { logPipeline } from "../../../../lib/debug-logger";
import { isSubscriptionEnabled } from "../../../../lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["recover_key", "cancel", "billing"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

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

  const action =
    typeof body.action === "string" ? body.action : "recover_key";
  if (!VALID_ACTIONS.has(action)) {
    return jsonResponse(
      { error: "Unknown action", code: "INVALID_ACTION" },
      400
    );
  }

  // Phase 1: log the intent. Phase 3 swaps this for a real email send
  // via SMTP (Resend / Postmark / SES) with a signed magic link.
  logPipeline({
    event: "subscription_manage_request",
    level: "info",
    data: { email, action, phase: "stub" },
  });

  return jsonResponse(
    {
      ok: true,
      sent: false, // false in stub; true once SMTP is wired
      message:
        "Got it. Magic-link email delivery isn't wired up yet in this build — we've logged your request and will reach out manually at the email above while we finish plumbing SMTP.",
    },
    200
  );
}

/** Minimal email-shape validator. Not RFC-complete; catches the 95% case. */
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
