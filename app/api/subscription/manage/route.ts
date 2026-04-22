/**
 * Subscription management — `POST /api/subscription/manage`
 *
 * Three actions, all email-driven:
 *
 *   - `recover_key` — user lost their license key. We look up the
 *      active key on file for their email and re-send it. If no
 *      subscription matches, we still respond 200 with the same
 *      shape (no enumeration leak about which emails are in our
 *      store) but `sent: false` and a message that says so.
 *
 *   - `cancel` — emails a Stripe Customer Portal magic link so the
 *      user can cancel via Stripe's hosted UI. The link itself is
 *      created Phase-3-side once Stripe is wired; until then,
 *      we fall back to mailing a contact-us message so the request
 *      isn't silently dropped.
 *
 *   - `billing` — same magic-link mechanism as `cancel`, different
 *      intent so the email copy is shaped differently.
 *
 * EMAIL FAILURE POSTURE
 * ─────────────────────
 * Per `docs/SUBSCRIPTION-ARCHITECTURE.md § Phase 4` the rule is:
 * **send failures surface in logs but never swallow the original
 * operation.** Concretely: if the upstream Resend / Postmark call
 * fails, we still return 200 with `sent: false` so the user-facing
 * UI doesn't 500, and the failure shows up as a structured
 * `subscription_email_failed` log line. No exception bubbles up.
 *
 * Wire contract:
 *   POST /api/subscription/manage
 *   Body: { email: string, action?: "recover_key" | "cancel" | "billing" }
 *   Response 200: { ok: true, sent: boolean, message: string }
 *   Response 400: { error, code: "INVALID_EMAIL" | "INVALID_ACTION" }
 *   Response 503: { error, code: "SUBSCRIPTION_DISABLED" }
 */

import { logPipeline } from "../../../../lib/debug-logger";
import {
  getEmailConfig,
  sendMagicLinkEmail,
  sendRecoveryEmail,
} from "../../../../lib/email";
import {
  findActiveKeyByEmail,
  isSubscriptionEnabled,
} from "../../../../lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set(["recover_key", "cancel", "billing"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Stripe Customer Portal config-portal URL (per-account, signed by
// the Phase-3 webhook → here just consumed). Optional; when unset,
// the cancel / billing actions fall back to a "we'll reach out
// manually" message instead of 500-ing.
const STRIPE_PORTAL_URL = process.env.STRIPE_PORTAL_URL || "";

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

  logPipeline({
    event: "subscription_manage_request",
    level: "info",
    data: { email, action, ...emailConfigSnapshot() },
  });

  if (action === "recover_key") {
    return handleRecoverKey(email);
  }
  if (action === "cancel" || action === "billing") {
    return handleMagicLink(email, action);
  }
  // Defensive — VALID_ACTIONS gate should have caught this.
  return jsonResponse(
    { error: "Unknown action", code: "INVALID_ACTION" },
    400
  );
}

async function handleRecoverKey(email: string): Promise<Response> {
  const licenseKey = findActiveKeyByEmail(email);

  // Privacy: no enumeration leak. If the email isn't on file, the
  // user-visible response is the same shape as the success case
  // ("got it, check your inbox") — they just don't actually receive
  // anything. Stops casual signup-list mining via the manage API.
  if (!licenseKey) {
    logPipeline({
      event: "subscription_recover_key_no_match",
      level: "info",
      data: { email },
    });
    return jsonResponse(
      {
        ok: true,
        sent: false,
        message:
          "If an active subscription is on file for that email, we've sent the license key. Check your inbox (and spam folder) — if nothing arrives in a few minutes, double-check the address you used at signup.",
      },
      200
    );
  }

  const result = await sendRecoveryEmail({ email, licenseKey });
  if (!result.ok) {
    // Email send failed — log loudly but don't 500. The user's request
    // is real; we just can't deliver right now. They get a polite
    // message and Seth gets a log line to follow up on.
    return jsonResponse(
      {
        ok: true,
        sent: false,
        message:
          "Got it. Email delivery is having a hiccup right now — we've logged your request and will get the key to you shortly. If it doesn't arrive within an hour, reach out to support@peanutgallery.live.",
      },
      200
    );
  }

  return jsonResponse(
    {
      ok: true,
      sent: !result.skipped,
      message: result.skipped
        ? "Got it. Email is disabled on this backend; the operator has been notified to deliver your key manually."
        : "Sent. Check your inbox (and spam folder) for a message from Peanut Gallery with your license key.",
    },
    200
  );
}

async function handleMagicLink(
  email: string,
  intent: "cancel" | "billing"
): Promise<Response> {
  // Verify the email belongs to an active subscription before mailing
  // a portal link — same enumeration-protection pattern as recover_key
  // (don't reveal which addresses are subscribers).
  const licenseKey = findActiveKeyByEmail(email);
  if (!licenseKey) {
    logPipeline({
      event: "subscription_magic_link_no_match",
      level: "info",
      data: { email, intent },
    });
    return jsonResponse(
      {
        ok: true,
        sent: false,
        message:
          "If an active subscription is on file for that email, we've sent a management link. If nothing arrives in a few minutes, the email may not be tied to an active subscription.",
      },
      200
    );
  }

  if (!STRIPE_PORTAL_URL) {
    // Stripe portal isn't wired yet — Phase 3 territory. Log the
    // intent so Seth can hand-process while infra catches up.
    logPipeline({
      event: "subscription_magic_link_unconfigured",
      level: "warn",
      data: { email, intent, reason: "STRIPE_PORTAL_URL_MISSING" },
    });
    return jsonResponse(
      {
        ok: true,
        sent: false,
        message:
          "Got it. We've logged your request and will reach out manually at the email above while we finish wiring the self-serve flow.",
      },
      200
    );
  }

  const result = await sendMagicLinkEmail({
    email,
    portalUrl: STRIPE_PORTAL_URL,
    intent,
  });
  if (!result.ok) {
    return jsonResponse(
      {
        ok: true,
        sent: false,
        message:
          "Got it. Email delivery is having a hiccup right now — we've logged your request and will follow up. If you don't hear back within an hour, reach out to support@peanutgallery.live.",
      },
      200
    );
  }

  return jsonResponse(
    {
      ok: true,
      sent: !result.skipped,
      message: result.skipped
        ? "Got it. Email is disabled on this backend; the operator has been notified to deliver your management link manually."
        : "Sent. Check your inbox for a secure link to the Stripe Customer Portal.",
    },
    200
  );
}

function emailConfigSnapshot() {
  const cfg = getEmailConfig();
  return {
    emailProvider: cfg.provider,
    emailConfigured: cfg.configured,
    emailDisabled: cfg.disabled,
  };
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
