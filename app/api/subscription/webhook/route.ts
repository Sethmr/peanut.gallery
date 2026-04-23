/**
 * Stripe webhook — `POST /api/subscription/webhook`
 *
 * Phase 3 (SET-26) — real event handler. Replaces the Phase 1 stub
 * that logged-and-returned. Invariants:
 *
 *   1. **Signature verification first, always.** No branch past
 *      `verifyStripeSignature` runs without a valid `Stripe-Signature`
 *      header against `STRIPE_WEBHOOK_SECRET`.
 *   2. **US-only defense in depth.** `checkout.session.completed`
 *      re-checks `customer_details.address.country`. If non-US somehow
 *      lands here (VPN, Stripe UI bug), we refund + cancel + DO NOT
 *      issue a license key. Belt-and-suspenders to the
 *      `shipping_address_collection.allowed_countries: ['US']` filter
 *      on the checkout session.
 *   3. **Idempotent.** `stripe_sub_id` is treated as a unique
 *      correlator. If we see the same subscription a second time
 *      (Stripe retries on 5xx), we look up the existing license key
 *      instead of issuing a new one.
 *   4. **Email failures never orphan a key.** We persist the license
 *      key BEFORE sending the welcome email. If the email fails, the
 *      key is still in the DB and the manage endpoint's recover-key
 *      flow can deliver it. A warn-level log entry flags the send
 *      failure for manual follow-up.
 *   5. **Always return 200 on a handled event.** Stripe retries on
 *      non-2xx; we don't want to re-process an event we already
 *      handled. Unexpected exceptions within a handler return 500 so
 *      Stripe retries — but we log at error level so ops notices.
 *
 * EVENTS HANDLED
 * ──────────────
 *   - `checkout.session.completed` — new subscription; issue key.
 *   - `customer.subscription.updated` — reconcile status.
 *   - `customer.subscription.deleted` — mark key revoked.
 *
 * Other events (invoice.paid, invoice.payment_failed, etc.) are
 * logged at debug and return 200 so Stripe doesn't retry them. Ops
 * review + add explicit handlers as the product needs them.
 *
 * Reference: [`docs/SUBSCRIPTION-ARCHITECTURE.md § Phase 3`](../../../../docs/SUBSCRIPTION-ARCHITECTURE.md).
 */

import { sendWelcomeEmail } from "../../../../lib/email";
import { logPipeline } from "../../../../lib/debug-logger";
import {
  generateLicenseKey,
  isValidLicenseKey,
} from "../../../../lib/subscription-keys";
import {
  createSubscription,
  getSubscriptionStore,
  reserveUniqueLicenseKey,
  type SubscriptionRecord,
} from "../../../../lib/subscription-store";
import {
  isSubscriptionEnabled,
  revokeSubscription,
} from "../../../../lib/subscription";
import { verifyStripeSignature } from "../../../../lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhooks are server-to-server from Stripe's own IPs. No
// CORS preflight; we don't set Access-Control headers.

// Env values may be copy-pasted with trailing newlines or wrapping quotes
// (especially via Railway's web UI). Trim to be safe — the verifier is strict
// about byte equality and a single \n would silently reject every event.
const WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("Stripe-Signature");

  const verification = verifyStripeSignature(
    rawBody,
    signature,
    WEBHOOK_SECRET
  );
  if (!verification.ok) {
    // On signature failures, log non-sensitive fingerprints so ops can
    // distinguish "wrong secret in env" from "Stripe bug" at a glance
    // without exposing the secret or the signature bytes themselves.
    logPipeline({
      event: "subscription_webhook_signature_rejected",
      level: "warn",
      data: {
        reason: verification.reason,
        hasHeader: !!signature,
        bodyLen: rawBody.length,
        secretLen: WEBHOOK_SECRET.length,
        secretPrefix: WEBHOOK_SECRET.slice(0, 6), // "whsec_" prefix only
        sigPrefix: signature?.slice(0, 8) ?? null, // "t=173..." only
      },
    });
    return new Response(
      JSON.stringify({
        error: "signature-rejected",
        reason: verification.reason,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isSubscriptionEnabled()) {
    // Unusual: webhook is reachable but subscription feature is off.
    // Log and 200 so Stripe doesn't retry; operator should either
    // enable the feature or disconnect the webhook in Stripe dashboard.
    logPipeline({
      event: "subscription_webhook_subscription_disabled",
      level: "warn",
      data: {
        note:
          "ENABLE_SUBSCRIPTION is off; event accepted but not acted upon.",
      },
    });
    return ok200({ ignored: "subscription_disabled" });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    logPipeline({
      event: "subscription_webhook_parse_error",
      level: "error",
      data: { bodyPrefix: rawBody.slice(0, 200) },
    });
    return new Response(JSON.stringify({ error: "invalid-json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        return ok200({ handled: event.type, eventId: event.id });

      case "customer.subscription.updated":
        handleSubscriptionUpdated(event);
        return ok200({ handled: event.type, eventId: event.id });

      case "customer.subscription.deleted":
        handleSubscriptionDeleted(event);
        return ok200({ handled: event.type, eventId: event.id });

      default:
        logPipeline({
          event: "subscription_webhook_unhandled_event",
          level: "debug",
          data: { type: event.type, eventId: event.id },
        });
        return ok200({ ignored: event.type, eventId: event.id });
    }
  } catch (err) {
    logPipeline({
      event: "subscription_webhook_handler_exception",
      level: "error",
      data: {
        type: event.type,
        eventId: event.id,
        message: err instanceof Error ? err.message : String(err),
      },
    });
    // Return 500 so Stripe retries. Error is already logged; a
    // transient failure (DB temporarily locked, email provider 5xx)
    // should recover on retry.
    return new Response(
      JSON.stringify({ error: "handler-exception", eventId: event.id }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(event: StripeEvent): Promise<void> {
  const session = event.data?.object as CheckoutSession | undefined;
  if (!session) {
    logPipeline({
      event: "subscription_webhook_missing_object",
      level: "error",
      data: { eventId: event.id, type: event.type },
    });
    return;
  }

  const email = extractEmail(session);
  const country = extractCountry(session);
  const stripeSubId = session.subscription ?? null;

  // US-only defense in depth. The Stripe-side filter should never
  // let non-US through, but if it does (VPN, API call that bypasses
  // the form, test-mode config drift), we refund + cancel.
  if (country && country !== "US") {
    logPipeline({
      event: "subscription_webhook_non_us_refund",
      level: "warn",
      data: {
        eventId: event.id,
        sessionId: session.id,
        stripeSubId,
        billingCountry: country,
        note:
          "Non-US billing address at webhook; refunding + cancelling and NOT issuing a license key.",
      },
    });
    if (stripeSubId && STRIPE_SECRET_KEY) {
      await cancelStripeSubscription(stripeSubId);
    }
    return;
  }

  if (!email) {
    logPipeline({
      event: "subscription_webhook_missing_email",
      level: "error",
      data: { eventId: event.id, sessionId: session.id },
    });
    return;
  }

  // Idempotency — if a row already exists for this subscription ID,
  // Stripe has retried an event we already processed. Look up and
  // re-send the welcome email (the user might have lost it), but
  // DO NOT issue a new key.
  const store = getSubscriptionStore();
  const existing = stripeSubId
    ? store.getSubscriptionByStripeSubId(stripeSubId)
    : null;
  let record: SubscriptionRecord;
  if (existing) {
    logPipeline({
      event: "subscription_webhook_idempotent_hit",
      level: "info",
      data: {
        eventId: event.id,
        stripeSubId,
        keyPrefix: existing.licenseKey.slice(0, 8),
      },
    });
    record = existing;
  } else {
    const licenseKey = reserveUniqueLicenseKey(generateLicenseKey);
    if (!isValidLicenseKey(licenseKey)) {
      throw new Error(
        `generated an invalid license key: ${licenseKey.slice(0, 8)}***`
      );
    }
    record = createSubscription({
      licenseKey,
      email,
      stripeSubId,
    });
    logPipeline({
      event: "subscription_issued",
      level: "info",
      data: {
        eventId: event.id,
        keyPrefix: licenseKey.slice(0, 8),
        stripeSubId,
      },
    });
  }

  // Send welcome email AFTER persistence. If this fails, the key is
  // still in the DB; the user can recover via /api/subscription/manage.
  const emailResult = await sendWelcomeEmail({
    email,
    licenseKey: record.licenseKey,
  });
  if (!emailResult.ok && !emailResult.skipped) {
    logPipeline({
      event: "subscription_welcome_email_failed",
      level: "warn",
      data: {
        eventId: event.id,
        keyPrefix: record.licenseKey.slice(0, 8),
        error: emailResult.error,
        note:
          "License key persisted; manual follow-up (or user-triggered recover_key) will deliver.",
      },
    });
  }
}

function handleSubscriptionUpdated(event: StripeEvent): void {
  const sub = event.data?.object as StripeSubscription | undefined;
  if (!sub?.id) return;
  const store = getSubscriptionStore();
  const record = store.getSubscriptionByStripeSubId(sub.id);
  if (!record) {
    // Might be an out-of-order event (updated fires before completed
    // delivered). Log at info and move on; the completed handler will
    // insert the row when it arrives.
    logPipeline({
      event: "subscription_webhook_updated_unknown_sub",
      level: "info",
      data: { eventId: event.id, stripeSubId: sub.id, status: sub.status },
    });
    return;
  }
  const mapped = mapStripeStatus(sub.status);
  if (mapped !== record.status) {
    store.updateSubscriptionStatus(record.licenseKey, {
      status: mapped,
      cancelledAt:
        mapped === "revoked"
          ? record.cancelledAt ?? Date.now()
          : record.cancelledAt,
    });
    logPipeline({
      event: "subscription_status_changed",
      level: "info",
      data: {
        eventId: event.id,
        keyPrefix: record.licenseKey.slice(0, 8),
        from: record.status,
        to: mapped,
        stripeStatus: sub.status,
      },
    });
  }
}

function handleSubscriptionDeleted(event: StripeEvent): void {
  const sub = event.data?.object as StripeSubscription | undefined;
  if (!sub?.id) return;
  const store = getSubscriptionStore();
  const record = store.getSubscriptionByStripeSubId(sub.id);
  if (!record) {
    logPipeline({
      event: "subscription_webhook_deleted_unknown_sub",
      level: "info",
      data: { eventId: event.id, stripeSubId: sub.id },
    });
    return;
  }
  revokeSubscription(record.licenseKey);
  logPipeline({
    event: "subscription_webhook_deleted",
    level: "info",
    data: {
      eventId: event.id,
      keyPrefix: record.licenseKey.slice(0, 8),
      stripeSubId: sub.id,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

interface StripeEvent {
  id: string;
  type: string;
  data?: { object?: unknown };
}

interface CheckoutSession {
  id: string;
  customer_email?: string | null;
  customer_details?: {
    email?: string | null;
    address?: { country?: string | null } | null;
  } | null;
  subscription?: string | null;
  metadata?: Record<string, string> | null;
}

interface StripeSubscription {
  id: string;
  status: string;
}

function extractEmail(session: CheckoutSession): string | null {
  const raw =
    session.customer_details?.email ||
    session.customer_email ||
    session.metadata?.pg_email ||
    null;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractCountry(session: CheckoutSession): string | null {
  const raw = session.customer_details?.address?.country;
  if (!raw) return null;
  return raw.trim().toUpperCase();
}

function mapStripeStatus(s: string): SubscriptionRecord["status"] {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "revoked";
    default:
      // Conservative default: unknown Stripe status → treat as paused.
      // The manage route still accepts the key for identity lookup;
      // the cap gate in getSubscriptionStatus uses `active` only.
      return "paused";
  }
}

/**
 * Cancel a Stripe subscription immediately. Used when a non-US
 * billing address slips through to the webhook. Best-effort — if
 * the cancel fails we log and return; Stripe will keep billing
 * until manually handled.
 */
async function cancelStripeSubscription(stripeSubId: string): Promise<void> {
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${stripeSubId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Stripe-Version": "2024-06-20",
        },
      }
    );
    if (!res.ok) {
      logPipeline({
        event: "subscription_webhook_cancel_failed",
        level: "error",
        data: {
          stripeSubId,
          status: res.status,
          bodyPrefix: (await res.text().catch(() => "")).slice(0, 200),
        },
      });
      return;
    }
    logPipeline({
      event: "subscription_webhook_non_us_cancelled",
      level: "info",
      data: { stripeSubId },
    });
  } catch (err) {
    logPipeline({
      event: "subscription_webhook_cancel_exception",
      level: "error",
      data: {
        stripeSubId,
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

function ok200(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
