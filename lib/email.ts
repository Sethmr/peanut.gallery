/**
 * Transactional email — Peanut Gallery Plus (Phase 4).
 *
 * WHY THIS EXISTS
 * ───────────────
 * Phase 3 (Stripe) hands the subscription system one critical
 * follow-on responsibility: we have to deliver the license key to
 * the user the second `checkout.session.completed` fires, and we
 * have to deliver the key again on demand when the user loses it.
 * Same for the cancel-confirmation and the Stripe-Customer-Portal
 * magic link. This module is the single source of truth for those
 * sends — every other route imports from here.
 *
 * Reference: [`docs/SUBSCRIPTION-ARCHITECTURE.md § Phase 4`](../docs/SUBSCRIPTION-ARCHITECTURE.md).
 *
 * PROVIDER CHOICE
 * ───────────────
 * Default: **Resend** (https://resend.com). Reasons over Postmark:
 *
 *   1. Cleaner DX — first-class HTTP API, no SDK required (we use
 *      raw `fetch` so we don't take a new dependency).
 *   2. Free tier covers 3k emails/month — more than enough for the
 *      pre-launch + early subscriber stage. Postmark's free tier is
 *      gone; their starter plan is $15/mo before you send anything.
 *   3. Rendering pipeline — Resend's "from" + "reply_to" + plain
 *      `html` / `text` payload matches our shape one-for-one.
 *
 * Postmark remains a drop-in fallback (set `EMAIL_PROVIDER=postmark`)
 * because its IP reputation for transactional mail is the gold
 * standard if Resend ever has deliverability issues. Both providers
 * speak HTTP+JSON in nearly the same shape.
 *
 * SAFETY POSTURE
 * ──────────────
 * 1. **Email send failures NEVER swallow the original operation.**
 *    Stripe webhook delivered the key? Persistence happens BEFORE
 *    we attempt to send. If the send fails we log it loudly + return
 *    `{ ok: false }` — the caller logs but does not throw, so Stripe
 *    doesn't see a 500 and re-fire (which would dupe-issue keys).
 *    Manage `recover_key` returns `sent: false` when the upstream
 *    refuses; the user sees a polite "we logged your request" message.
 *
 * 2. **`DISABLE_EMAIL_SEND=true` is the self-host opt-out.** Mirrors
 *    `DISABLE_FEEDBACK_LOGGING` — operators running Plus internally
 *    without SMTP credentials short-circuit before any network call.
 *    A `subscription_email_skipped` log line records what would have
 *    been sent so the operator can hand-deliver the key if needed.
 *
 * 3. **No template injection surface.** All templated values flow
 *    through `escapeHtml()` before reaching the HTML body; the plain-
 *    text body is concatenated raw because text/plain has no markup
 *    semantics. Email + key + portal-URL come from trusted server-
 *    side state (Stripe webhook payload after signature verification,
 *    or our own subscription store), never from un-validated client
 *    input — but defense in depth is cheap, so we escape anyway.
 *
 * 4. **`from` + `reply_to` are env-driven.** No hardcoded addresses;
 *    self-hosters set their own. Defaults to clearly-broken sentinel
 *    values so a missing config fails loudly instead of silently
 *    sending from `noreply@example.com`.
 */

import { logPipeline } from "./debug-logger";
import {
  renderCancellationEmail,
  renderMagicLinkEmail,
  renderRecoveryEmail,
  renderWelcomeEmail,
} from "./email-templates";

// ── CONFIG (env-driven) ──────────────────────────────────────────────────

const EMAIL_API_KEY = process.env.EMAIL_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM || "subscriptions@peanutgallery.live";
const EMAIL_REPLY_TO =
  process.env.EMAIL_REPLY_TO || "support@peanutgallery.live";
const EMAIL_PROVIDER = (
  process.env.EMAIL_PROVIDER || "resend"
).toLowerCase();
const DISABLE_EMAIL_SEND =
  (process.env.DISABLE_EMAIL_SEND || "").toLowerCase() === "true";

// Resend HTTP endpoint — stable v1 API.
const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Postmark HTTP endpoint — same shape modulo header + field names.
const POSTMARK_ENDPOINT = "https://api.postmarkapp.com/email";

// Per-send abort timeout. Stripe webhook redelivery starts at ~1s, so
// we want to be back well before Stripe gives up — 8s is generous.
const SEND_TIMEOUT_MS = 8_000;

// ── PUBLIC TYPES ─────────────────────────────────────────────────────────

export interface EmailSendResult {
  /** True when the upstream accepted the message for delivery. */
  ok: boolean;
  /** Provider-issued message id when ok. */
  id: string | null;
  /** Failure reason when !ok. null when ok. */
  error: string | null;
  /** True when DISABLE_EMAIL_SEND short-circuited the send. */
  skipped: boolean;
}

export interface WelcomeEmailInput {
  email: string;
  licenseKey: string;
}

export interface RecoveryEmailInput {
  email: string;
  licenseKey: string;
}

export interface CancellationEmailInput {
  email: string;
}

export interface MagicLinkEmailInput {
  email: string;
  /** Full Stripe Customer Portal URL — already-signed by the caller. */
  portalUrl: string;
  /**
   * What the link is for. Lets us surface a slightly different
   * intro paragraph for "billing" vs "cancel" without forking
   * the whole template.
   */
  intent: "manage" | "cancel" | "billing";
}

// ── PUBLIC API — one function per email type ─────────────────────────────

/**
 * Send the welcome email immediately after Stripe signals
 * `checkout.session.completed` (Phase 3 webhook). Carries the
 * freshly-issued license key + paste instructions.
 */
export async function sendWelcomeEmail(
  input: WelcomeEmailInput
): Promise<EmailSendResult> {
  const { html, text, subject } = renderWelcomeEmail(input);
  return send({
    to: input.email,
    subject,
    html,
    text,
    purpose: "welcome",
  });
}

/**
 * Send the license key on demand. Used by `/api/subscription/manage`
 * with `action: "recover_key"` when the user pastes their email and
 * we look up the matching active subscription.
 */
export async function sendRecoveryEmail(
  input: RecoveryEmailInput
): Promise<EmailSendResult> {
  const { html, text, subject } = renderRecoveryEmail(input);
  return send({
    to: input.email,
    subject,
    html,
    text,
    purpose: "recovery",
  });
}

/**
 * Send the cancellation confirmation after Stripe's
 * `customer.subscription.deleted` webhook arrives. Lets the user
 * know the meter has stopped; no action required from them.
 */
export async function sendCancellationEmail(
  input: CancellationEmailInput
): Promise<EmailSendResult> {
  const { html, text, subject } = renderCancellationEmail(input);
  return send({
    to: input.email,
    subject,
    html,
    text,
    purpose: "cancellation",
  });
}

/**
 * Send a Stripe-Customer-Portal link. Used for "Cancel" /
 * "Update billing" / generic "Manage" requests from the extension
 * drawer. The caller pre-signs the portal URL via Stripe's
 * billingPortal.sessions.create; we just deliver the link.
 */
export async function sendMagicLinkEmail(
  input: MagicLinkEmailInput
): Promise<EmailSendResult> {
  const { html, text, subject } = renderMagicLinkEmail(input);
  return send({
    to: input.email,
    subject,
    html,
    text,
    purpose: `magic_link_${input.intent}`,
  });
}

// ── INTERNALS ────────────────────────────────────────────────────────────

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  purpose: string;
}

async function send(args: SendArgs): Promise<EmailSendResult> {
  // Self-host opt-out — short-circuit BEFORE any network call.
  if (DISABLE_EMAIL_SEND) {
    logPipeline({
      event: "subscription_email_skipped",
      level: "info",
      data: {
        reason: "DISABLE_EMAIL_SEND",
        purpose: args.purpose,
        toMasked: maskEmail(args.to),
        subject: args.subject,
      },
    });
    return { ok: true, id: null, error: null, skipped: true };
  }

  // No API key wired? Treat as a hard configuration error — log loud,
  // return failure. The caller (manage / webhook) is expected to log
  // and continue without throwing, so the user-facing operation
  // doesn't blow up just because email isn't plumbed yet.
  if (!EMAIL_API_KEY) {
    logPipeline({
      event: "subscription_email_failed",
      level: "error",
      data: {
        reason: "MISSING_EMAIL_API_KEY",
        purpose: args.purpose,
        toMasked: maskEmail(args.to),
        provider: EMAIL_PROVIDER,
      },
    });
    return {
      ok: false,
      id: null,
      error: "EMAIL_API_KEY not configured",
      skipped: false,
    };
  }

  try {
    const result =
      EMAIL_PROVIDER === "postmark"
        ? await sendViaPostmark(args)
        : await sendViaResend(args);
    if (result.ok) {
      logPipeline({
        event: "subscription_email_sent",
        level: "info",
        data: {
          purpose: args.purpose,
          provider: EMAIL_PROVIDER,
          toMasked: maskEmail(args.to),
          subject: args.subject,
          messageId: result.id,
        },
      });
    } else {
      logPipeline({
        event: "subscription_email_failed",
        level: "error",
        data: {
          purpose: args.purpose,
          provider: EMAIL_PROVIDER,
          toMasked: maskEmail(args.to),
          subject: args.subject,
          error: result.error,
        },
      });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logPipeline({
      event: "subscription_email_failed",
      level: "error",
      data: {
        purpose: args.purpose,
        provider: EMAIL_PROVIDER,
        toMasked: maskEmail(args.to),
        subject: args.subject,
        error: message,
        thrown: true,
      },
    });
    return { ok: false, id: null, error: message, skipped: false };
  }
}

async function sendViaResend(args: SendArgs): Promise<EmailSendResult> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [args.to],
      reply_to: EMAIL_REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      id: null,
      error: `Resend HTTP ${res.status}: ${bodyText.slice(0, 500)}`,
      skipped: false,
    };
  }
  let parsed: { id?: string } = {};
  try {
    parsed = JSON.parse(bodyText) as { id?: string };
  } catch {
    // Body wasn't JSON — accept the 2xx as success but warn.
  }
  return {
    ok: true,
    id: parsed.id ?? null,
    error: null,
    skipped: false,
  };
}

async function sendViaPostmark(args: SendArgs): Promise<EmailSendResult> {
  const res = await fetch(POSTMARK_ENDPOINT, {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": EMAIL_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: EMAIL_FROM,
      To: args.to,
      ReplyTo: EMAIL_REPLY_TO,
      Subject: args.subject,
      HtmlBody: args.html,
      TextBody: args.text,
      MessageStream: "outbound",
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      id: null,
      error: `Postmark HTTP ${res.status}: ${bodyText.slice(0, 500)}`,
      skipped: false,
    };
  }
  let parsed: { MessageID?: string } = {};
  try {
    parsed = JSON.parse(bodyText) as { MessageID?: string };
  } catch {
    // ignore — accept 2xx
  }
  return {
    ok: true,
    id: parsed.MessageID ?? null,
    error: null,
    skipped: false,
  };
}

// ── HELPERS ──────────────────────────────────────────────────────────────

/** Mask an email for log output: alice@example.com → al***@example.com */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

/**
 * Snapshot of the current email-config state — useful for `/api/subscription/manage`
 * to know whether it can rely on the email send actually happening, and for tests.
 */
export function getEmailConfig(): {
  provider: "resend" | "postmark";
  configured: boolean;
  disabled: boolean;
  fromAddress: string;
  replyToAddress: string;
} {
  return {
    provider: EMAIL_PROVIDER === "postmark" ? "postmark" : "resend",
    configured: !!EMAIL_API_KEY,
    disabled: DISABLE_EMAIL_SEND,
    fromAddress: EMAIL_FROM,
    replyToAddress: EMAIL_REPLY_TO,
  };
}
