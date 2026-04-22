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
 * The module is deliberately boring: validator against an env-var allow-
 * list today; swap to a DB-backed implementation later without changing
 * the API. Everything is in-memory, Phase-1. Durability comes with
 * Stripe integration (Phase 2+).
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
 * 5. **Phase 1 storage is in-memory + env whitelist.** Validator reads
 *    `SUBSCRIPTION_KEYS_WHITELIST` as a comma-separated list of
 *    `key=email` pairs for the ad-hoc test phase. Usage counters
 *    survive process lifetime only. Phase 2 (post-Stripe) swaps to
 *    persistent storage; the public API here doesn't change.
 */

import { logPipeline } from "./debug-logger";

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

/**
 * Phase-1 validator store. Env format:
 *   SUBSCRIPTION_KEYS_WHITELIST=pg-test-abcd-1234=alice@example.com,pg-test-efgh-5678=bob@example.com
 * Keys that don't appear here are rejected. Phase 2 (post-Stripe)
 * swaps this parser for a proper store read.
 */
function loadWhitelist(): Map<string, { email: string }> {
  const raw = process.env.SUBSCRIPTION_KEYS_WHITELIST || "";
  const map = new Map<string, { email: string }>();
  for (const entry of raw.split(",")) {
    const [key, email] = entry.split("=");
    const k = (key || "").trim();
    const e = (email || "").trim();
    if (k && e) map.set(k, { email: e });
  }
  return map;
}

// ── STATE (per process) ──────────────────────────────────────────────────

interface UsageEntry {
  usageMs: number;
  weekStart: number; // epoch ms — rolls on first use past weekStart + WEEK_MS
}

declare global {
  // eslint-disable-next-line no-var
  var __pg_subscription_store:
    | {
        usage: Map<string, UsageEntry>;
        whitelist: Map<string, { email: string }>;
        whitelistLoadedAt: number;
      }
    | undefined;
}

function getStore() {
  if (!globalThis.__pg_subscription_store) {
    globalThis.__pg_subscription_store = {
      usage: new Map(),
      whitelist: loadWhitelist(),
      whitelistLoadedAt: Date.now(),
    };
  }
  return globalThis.__pg_subscription_store;
}

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
    return baseStatus(key || "", "DISABLED", null);
  }
  if (!key) {
    return baseStatus("", "INVALID_KEY", null);
  }
  const store = getStore();
  const record = store.whitelist.get(key);
  if (!record) {
    logPipeline({
      event: "subscription_key_rejected",
      level: "info",
      data: { reason: "INVALID_KEY", keyPrefix: key.slice(0, 8) },
    });
    return baseStatus(key, "INVALID_KEY", null);
  }
  const entry = touchUsage(key);
  const remainingMs = Math.max(0, WEEKLY_CAP_MS - entry.usageMs);
  const status: SubscriptionStatus = {
    valid: remainingMs > 0,
    error: remainingMs > 0 ? null : "CAP_REACHED",
    capMs: WEEKLY_CAP_MS,
    usedMs: entry.usageMs,
    remainingMs,
    resetAt: entry.weekStart + WEEK_MS,
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
        usedMs: entry.usageMs,
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
  const store = getStore();
  if (!store.whitelist.has(key)) return;
  const entry = touchUsage(key);
  const safeElapsed = Math.min(elapsedMs, WEEK_MS);
  const beforeMs = entry.usageMs;
  entry.usageMs = Math.min(entry.usageMs + safeElapsed, WEEKLY_CAP_MS + WEEK_MS);
  logPipeline({
    event: "subscription_usage_recorded",
    level: "debug",
    data: {
      keyPrefix: key.slice(0, 8),
      elapsedMs: safeElapsed,
      beforeMs,
      afterMs: entry.usageMs,
      remainingMs: Math.max(0, WEEKLY_CAP_MS - entry.usageMs),
    },
  });
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function touchUsage(key: string): UsageEntry {
  const t = Date.now();
  const store = getStore();
  const existing = store.usage.get(key);
  if (!existing) {
    const fresh: UsageEntry = { usageMs: 0, weekStart: t };
    store.usage.set(key, fresh);
    return fresh;
  }
  if (t - existing.weekStart >= WEEK_MS) {
    const priorUsageMs = existing.usageMs;
    existing.usageMs = 0;
    existing.weekStart = t;
    logPipeline({
      event: "subscription_week_rolled",
      level: "info",
      data: { keyPrefix: key.slice(0, 8), priorUsageMs, newWeekStart: t },
    });
  }
  return existing;
}

function baseStatus(
  _key: string,
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
 * Reverse-lookup: find the active license key tied to an email address.
 * Returns null when no match. Used by `/api/subscription/manage` for the
 * `recover_key` flow — user pastes their signup email, we mail back the
 * key on file.
 *
 * Phase 1: scans the env-loaded whitelist linearly (whitelist size is
 * tiny — measured in tens, not thousands). Phase 2 swaps for an indexed
 * lookup against the SQLite store; the public signature here doesn't
 * change so callers stay portable.
 *
 * Email match is case-insensitive on the local + domain parts —
 * users routinely paste with different casing than they used at
 * signup, and email addresses are not case-sensitive in practice for
 * any major provider.
 */
export function findActiveKeyByEmail(email: string): string | null {
  if (!ENABLED) return null;
  const needle = (email || "").trim().toLowerCase();
  if (!needle) return null;
  const store = getStore();
  for (const [key, record] of store.whitelist) {
    if (record.email.trim().toLowerCase() === needle) return key;
  }
  return null;
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
