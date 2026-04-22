/**
 * Subscription primitives — key validation, usage metering, status read.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Peanut Gallery's hosted tier ([`SUBSCRIPTION-ARCHITECTURE.md`](../docs/SUBSCRIPTION-ARCHITECTURE.md))
 * is an accessibility lever, not a profit center — it's how non-technical
 * users reach the product without managing API keys. This module is the
 * server-side source of truth for:
 *
 *   1. "Is this subscription key valid?" (called on `/api/transcribe` start)
 *   2. "How many hours has this key used this week?" (called for the
 *      progress bar in the drawer, and to enforce the cap at tick time)
 *   3. "Record N more ms against this key's weekly ledger" (called on
 *      session end — same pattern as `free-tier-limiter`)
 *
 * PUBLIC API IS STABLE
 * ────────────────────
 * The four exports — {@link isSubscriptionEnabled},
 * {@link getSubscriptionStatus}, {@link recordSubscriptionUsage}, and
 * {@link subscriptionDeniedBody} — have not changed shape since Phase 1.
 * Phase 2 (SET-25) rewires this module to delegate to the pluggable
 * {@link lib/subscription-store.SubscriptionStore SubscriptionStore}
 * singleton rather than its own process-local maps, but the callers
 * in `/api/transcribe`, `/api/subscription/status`, and
 * `/api/subscription/checkout` see the exact same behavior.
 *
 * STORAGE MODE SELECTION
 * ──────────────────────
 * See `lib/subscription-store.ts`. In short: `SUBSCRIPTION_DB_PATH`
 * promotes the module to the durable SQLite path; if it's unset,
 * the in-memory env-whitelist fallback preserves Phase 1 behavior
 * exactly.
 *
 * INTEGRATION WITH OTHER SYSTEMS
 * ──────────────────────────────
 * This module is intentionally decoupled from the pipeline path —
 * Director, persona engine, claim-detector, transcription,
 * fact-check search. It only deals with subscription identity +
 * usage metering. The pipeline never imports anything from here
 * except through the four public functions above (checked at review
 * time).
 *
 * DESIGN NOTES
 * ────────────
 * 1. **License keys, not OAuth tokens.** User pastes `pg-xxxx-xxxx-xxxx`
 *    into the Backend & keys drawer. Simpler than magic link; portable
 *    across devices; revocable by regenerating. See
 *    [`SUBSCRIPTION-ARCHITECTURE.md § Identity`](../docs/SUBSCRIPTION-ARCHITECTURE.md).
 * 2. **Subscription hours only count when hosted keys are used.** If the
 *    user is on BYOK mode (their own API keys attached), the subscription
 *    cap doesn't deplete — the subscription is about "pay Peanut Gallery
 *    to use its keys," not "pay Peanut Gallery to use the product."
 *    The extension enforces the mode via a segmented control in the
 *    drawer; the server respects the client's choice based on whether
 *    X-Subscription-Key is sent.
 * 3. **Weekly cap, rolling 7 days from key issuance.** Not a calendar
 *    week — avoids end-of-week clumping and makes "your reset is on
 *    Tuesday" readable in the UI (the reset instant is stamped into the
 *    key's `weekStart`).
 * 4. **Opt-in via env.** `ENABLE_SUBSCRIPTION=true` on the server turns
 *    the feature on. Self-hosters never set it — their extension UIs
 *    will still show the option (it's a client-visible radio), but
 *    attempting to use it against a server where the flag is off
 *    returns a 503. Keeps self-hosters' code paths clean.
 */

import { logPipeline } from "./debug-logger";
import { isValidLicenseKey } from "./subscription-keys";
import {
  getSubscriptionStore,
  type SubscriptionRecord,
} from "./subscription-store";

// ── CONFIG (env-driven) ──────────────────────────────────────────────────

const ENABLED =
  (process.env.ENABLE_SUBSCRIPTION || "").toLowerCase() === "true";

// Weekly cap in hours — 16h default per Seth's 2026-04-21 direction.
// Tuned upward if economics allow, downward only as a last resort if
// the stack can't be made cheap enough.
const WEEKLY_CAP_HOURS = Math.max(
  1,
  Number.parseInt(process.env.SUBSCRIPTION_WEEKLY_HOURS || "16", 10) || 16
);

const WEEKLY_CAP_MS = WEEKLY_CAP_HOURS * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ── PUBLIC API ───────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  /** True when the backend has subscription enabled AND the key is valid. */
  valid: boolean;
  /** Error code when invalid. null when valid. */
  error:
    | null
    | "DISABLED" // server hasn't turned the feature on
    | "INVALID_KEY" // key not found in the store
    | "CAP_REACHED"; // key is valid but has used all weekly hours
  /** Total allowance per week (ms). */
  capMs: number;
  /** Milliseconds used in the current rolling week. */
  usedMs: number;
  /** Milliseconds remaining before cap. */
  remainingMs: number;
  /** Epoch ms when the current week resets (weekStart + WEEK_MS). */
  resetAt: number;
  /** Human config snapshot. */
  weeklyCapHours: number;
  /** Email on file for the key (for display / management). Only set when valid. */
  email: string | null;
}

export function isSubscriptionEnabled(): boolean {
  return ENABLED;
}

/**
 * Validate a subscription key and return its current status. Does NOT
 * record usage — read-only. Call at the start of `/api/transcribe` to
 * gate access + populate the extension's drawer progress bar via
 * `/api/subscription/status`.
 */
export function getSubscriptionStatus(
  key: string | null | undefined
): SubscriptionStatus {
  if (!ENABLED) {
    return baseStatus("DISABLED", null);
  }
  if (!key) {
    return baseStatus("INVALID_KEY", null);
  }

  const store = getSubscriptionStore();

  // Phase 1 env-whitelist keys were plain strings (no checksum). We
  // still honor those, so format-checking is ADVISORY, not a gate.
  // A malformed key falls through to the store lookup; if the store
  // has it on its whitelist it's valid. This preserves Phase 1
  // deployments that hand out keys like `pg-test-0001-0001`.
  const record = store.getActiveSubscription(key);
  if (!record) {
    logPipeline({
      event: "subscription_key_rejected",
      level: "info",
      data: {
        reason: "INVALID_KEY",
        keyPrefix: key.slice(0, 8),
        passedFormat: isValidLicenseKey(key),
      },
    });
    return baseStatus("INVALID_KEY", null);
  }

  const usage = store.touchUsage(key);
  const remainingMs = Math.max(0, WEEKLY_CAP_MS - usage.usageMs);
  const status: SubscriptionStatus = {
    valid: remainingMs > 0,
    error: remainingMs > 0 ? null : "CAP_REACHED",
    capMs: WEEKLY_CAP_MS,
    usedMs: usage.usageMs,
    remainingMs,
    resetAt: usage.weekStart + WEEK_MS,
    weeklyCapHours: WEEKLY_CAP_HOURS,
    email: record.email,
  };

  if (!status.valid) {
    logPipeline({
      event: "subscription_cap_reached",
      level: "info",
      data: {
        keyPrefix: key.slice(0, 8),
        email: record.email,
        usedMs: usage.usageMs,
        capMs: WEEKLY_CAP_MS,
        resetAt: status.resetAt,
      },
    });
  }
  return status;
}

/**
 * Record elapsed usage against a key's weekly ledger. Mirrors the
 * free-tier limiter's `recordUsage` — called at session end with the
 * actual elapsed time. No-op when the feature is off or the key is
 * unknown (defense in depth; a stale session shouldn't be able to
 * burn cap on a revoked key).
 */
export function recordSubscriptionUsage(
  key: string | null | undefined,
  elapsedMs: number
): void {
  if (!ENABLED || !key) return;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  const store = getSubscriptionStore();
  const record = store.getActiveSubscription(key);
  if (!record) return;
  const safeElapsed = Math.min(elapsedMs, WEEK_MS);
  const before = store.touchUsage(key);
  store.addUsage(key, safeElapsed);
  const after = store.touchUsage(key);
  logPipeline({
    event: "subscription_usage_recorded",
    level: "debug",
    data: {
      keyPrefix: key.slice(0, 8),
      elapsedMs: safeElapsed,
      beforeMs: before.usageMs,
      afterMs: after.usageMs,
      remainingMs: Math.max(0, WEEKLY_CAP_MS - after.usageMs),
    },
  });
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function baseStatus(
  error: NonNullable<SubscriptionStatus["error"]> | "DISABLED",
  email: string | null
): SubscriptionStatus {
  return {
    valid: false,
    error,
    capMs: WEEKLY_CAP_MS,
    usedMs: 0,
    remainingMs: 0,
    resetAt: Date.now() + WEEK_MS,
    weeklyCapHours: WEEKLY_CAP_HOURS,
    email,
  };
}

/**
 * Response body shape for the 402 returned when a subscription key has
 * hit the weekly cap. Same spirit as `quotaDeniedBody` in the free-tier
 * limiter — machine-readable code + human-readable message.
 */
export function subscriptionDeniedBody(status: SubscriptionStatus): {
  error: string;
  code:
    | "SUBSCRIPTION_DISABLED"
    | "SUBSCRIPTION_INVALID_KEY"
    | "SUBSCRIPTION_CAP_REACHED";
  weeklyCapHours: number;
  retryAfterMs: number;
  resetAt: number;
} {
  const retryAfterMs = Math.max(0, status.resetAt - Date.now());
  if (status.error === "DISABLED") {
    return {
      error:
        "Peanut Gallery Plus isn't enabled on this backend. Paste your own API keys or point at a backend that has it turned on.",
      code: "SUBSCRIPTION_DISABLED",
      weeklyCapHours: status.weeklyCapHours,
      retryAfterMs: 0,
      resetAt: status.resetAt,
    };
  }
  if (status.error === "INVALID_KEY") {
    return {
      error:
        "Subscription key not recognized. Check you pasted the whole key from your email, or request a new key via Manage subscription.",
      code: "SUBSCRIPTION_INVALID_KEY",
      weeklyCapHours: status.weeklyCapHours,
      retryAfterMs: 0,
      resetAt: status.resetAt,
    };
  }
  return {
    error: `You've hit your weekly ${status.weeklyCapHours}-hour cap on Peanut Gallery Plus. The meter resets in ${Math.ceil(
      retryAfterMs / (60 * 60 * 1000)
    )} hours. In the meantime, flip to My own keys in the drawer to keep going now.`,
    code: "SUBSCRIPTION_CAP_REACHED",
    weeklyCapHours: status.weeklyCapHours,
    retryAfterMs,
    resetAt: status.resetAt,
  };
}

// ─────────────────────────────────────────────────────────────
// PHASE 2+ API (used by webhook + admin CLI; see SET-26, SET-25)
// ─────────────────────────────────────────────────────────────

/**
 * Look up the most recent subscription record for an email address.
 * Used by `/api/subscription/manage` for recover-key and cancel flows.
 */
export function findSubscriptionByEmail(
  email: string
): SubscriptionRecord | null {
  if (!ENABLED) return null;
  return getSubscriptionStore().getSubscriptionByEmail(email);
}

/**
 * Back-compat alias for the SET-27 email-flow code that expected a
 * `findActiveKeyByEmail(email): string | null` signature. Returns
 * the license key string if an active subscription exists for this
 * email; null if the email is unknown or the subscription has been
 * revoked / cancelled. The newer {@link findSubscriptionByEmail}
 * returns the full record.
 */
export function findActiveKeyByEmail(email: string): string | null {
  const rec = findSubscriptionByEmail(email);
  if (!rec) return null;
  if (rec.status !== "active") return null;
  return rec.licenseKey;
}

/**
 * Mark a subscription revoked. Called by the Stripe webhook on
 * `customer.subscription.deleted` and by the admin CLI.
 */
export function revokeSubscription(licenseKey: string): void {
  if (!ENABLED) return;
  getSubscriptionStore().updateSubscriptionStatus(licenseKey, {
    status: "revoked",
    cancelledAt: Date.now(),
  });
  logPipeline({
    event: "subscription_revoked",
    level: "info",
    data: { keyPrefix: licenseKey.slice(0, 8) },
  });
}
