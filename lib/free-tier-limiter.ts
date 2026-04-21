/**
 * Free-tier rate limiter — per-installation quota for the hosted backend.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Peanut Gallery's hosted backend (peanutgallery.live) covers non-technical
 * users' API costs out of the project's pocket — they get a one-time trial
 * (default: 15 minutes of transcription, lifetime) before they must either
 * paste their own keys or subscribe to Peanut Gallery Plus. The trial is
 * deliberately small — just enough for a user to see whether the product
 * fits them — because the subscription tier (docs/SUBSCRIPTION-ARCHITECTURE.md)
 * is where non-techs are supposed to land long-term.
 *
 * TRIAL SEMANTICS (v1.7 rewrite)
 * ──────────────────────────────
 * **One-off, not rolling.** The 15 minutes are lifetime per install, not
 * per-24h. Once consumed, the trial never resets — the user has to pick a
 * path forward (BYOK or subscribe). Self-hosters who want the old rolling-
 * window behavior can set `FREE_TIER_WINDOW_HOURS=24` to restore it, but
 * the hosted default is one-off.
 *
 * DESIGN NOTES (important if you change this)
 * ───────────────────────────────────────────
 * 1. **In-memory only.** No Redis, no DB. The counter resets on server
 *    redeploy — this is a deliberate trade-off: zero new infra, zero new
 *    failure modes, zero risk of a dead dep breaking the whole backend. The
 *    hosted instance is a single Railway process, which is the only place
 *    this matters; horizontally scaling would require Redis. CAVEAT:
 *    one-off mode plus in-memory storage means a redeploy gives every
 *    user another 15 minutes until we back this with durable storage.
 *    For Phase 1 (pre-Stripe) that's acceptable — signup pressure is low.
 *    Tracked as follow-up in docs/SUBSCRIPTION-ARCHITECTURE.md § Open items.
 * 2. **Soft limit, not security.** The `installId` is a UUID the extension
 *    generates on first run. A determined user can reset it by clearing
 *    chrome.storage.local. That's fine — the goal here is to discourage
 *    casual abuse, not stop dedicated attackers. Subscription keys are
 *    the real monetization gate, not this.
 * 3. **Opt-in via env.** The limiter only engages when
 *    `ENABLE_FREE_TIER_LIMIT=true`. Self-hosters never set it, so their
 *    servers behave exactly as before. This file has no effect on any
 *    backend unless the operator explicitly turns it on.
 * 4. **Subscription bypass.** A valid `X-Subscription-Key` header
 *    short-circuits the limiter — the route checks the subscription
 *    status first, and if the key is valid, this limiter is skipped.
 *    See lib/subscription.ts for the validation path.
 * 5. **Lazy pruning.** We prune expired entries whenever a key is read, so
 *    no setInterval/timer is needed. Avoids creating background work inside
 *    a Next.js API route (which is spawned fresh-ish per request).
 * 6. **Charged at session end.** We only RESERVE usage at session start
 *    (by checking `remainingMs()`). Actual elapsed time is recorded when
 *    the session closes. A session that starts with 14 min left is allowed
 *    to run to completion even if the video is 2 hours long. This avoids
 *    the terrible UX of "we cut your show off mid-sentence."
 * 7. **Structured logging.** Every state change that affects a user
 *    (quota denial, usage recorded) goes through `logPipeline` from
 *    `debug-logger`. Info-level; keyed by installId so ops can grep the
 *    JSONL log when a user reports "I got capped" and see exactly how
 *    much they'd used.
 */

import { logPipeline } from "./debug-logger";

// ── CONFIG (all env-overridable) ─────────────────────────────────────────
const ENABLED =
  (process.env.ENABLE_FREE_TIER_LIMIT || "").toLowerCase() === "true";

const FREE_TIER_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.FREE_TIER_MINUTES || "15", 10) || 15
);

// v1.7: default is one-off (0 = never rolls). Self-hosters who want the
// pre-v1.7 rolling-24h behavior can set FREE_TIER_WINDOW_HOURS=24.
const FREE_TIER_WINDOW_HOURS = Math.max(
  0,
  Number.parseInt(process.env.FREE_TIER_WINDOW_HOURS || "0", 10) || 0
);

const QUOTA_MS = FREE_TIER_MINUTES * 60 * 1000;
// When 0 (the default), the window never rolls — trial is lifetime.
// Non-zero values restore the pre-v1.7 rolling behavior.
const WINDOW_MS = FREE_TIER_WINDOW_HOURS * 60 * 60 * 1000;
const ONE_OFF = WINDOW_MS === 0;

// ── STATE ────────────────────────────────────────────────────────────────

/**
 * One entry per install-id. `usageMs` is the total cumulative time already
 * consumed inside the current rolling window. `windowStart` is the epoch
 * timestamp when the current window began — we reset both to 0 / now when a
 * window elapses.
 */
interface UsageEntry {
  usageMs: number;
  windowStart: number;
}

// Singleton-per-process map. globalThis stashing survives hot-reload in
// development (Next.js recompiles keep the same Node process for `next dev`),
// so users don't get fresh quota every time they save a file locally.
declare global {
  // eslint-disable-next-line no-var
  var __pg_free_tier_store: Map<string, UsageEntry> | undefined;
}
const store: Map<string, UsageEntry> =
  globalThis.__pg_free_tier_store ?? new Map();
if (!globalThis.__pg_free_tier_store) {
  globalThis.__pg_free_tier_store = store;
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

/**
 * Return the entry for `installId`, rolling the window if it expired. Prunes
 * in-place. Creates a fresh entry on first sight.
 */
function touchEntry(installId: string): UsageEntry {
  const t = now();
  const existing = store.get(installId);

  if (!existing) {
    const fresh: UsageEntry = { usageMs: 0, windowStart: t };
    store.set(installId, fresh);
    logPipeline({
      event: "free_tier_install_seen",
      level: "debug",
      data: { installId, windowStart: t, quotaMs: QUOTA_MS, windowMs: WINDOW_MS },
    });
    return fresh;
  }

  // Window expired → reset. Only applies when rolling-window mode is
  // enabled (FREE_TIER_WINDOW_HOURS > 0). In one-off mode (the default)
  // the trial is lifetime — no reset, no rollover.
  if (!ONE_OFF && t - existing.windowStart >= WINDOW_MS) {
    const priorUsageMs = existing.usageMs;
    existing.usageMs = 0;
    existing.windowStart = t;
    logPipeline({
      event: "free_tier_window_rolled",
      level: "info",
      data: { installId, priorUsageMs, newWindowStart: t },
    });
  }

  return existing;
}

/**
 * Cheap lazy prune: drop entries whose window has fully expired and that
 * haven't been touched in at least one window. Called opportunistically; not
 * a precise GC. Keeps the Map from growing without bound across uptime.
 */
function maybePrune(): void {
  // Only prune occasionally — amortized across calls.
  if (store.size < 100) return;
  if (Math.random() > 0.01) return; // ~1% of calls when >= 100 entries
  // In one-off mode entries live forever — no prune target. Rolling
  // mode prunes entries whose window elapsed.
  if (ONE_OFF) return;

  const cutoff = now() - WINDOW_MS;
  for (const [id, entry] of store) {
    if (entry.windowStart < cutoff) store.delete(id);
  }
}

// ── PUBLIC API ───────────────────────────────────────────────────────────

export interface QuotaStatus {
  /** True if this install is allowed to start a new session right now. */
  allowed: boolean;
  /** Total allowance per window (ms). */
  quotaMs: number;
  /** Milliseconds still available in the current window. */
  remainingMs: number;
  /** Milliseconds used so far in the current window. */
  usedMs: number;
  /** Epoch ms when the current window expires and the counter resets. */
  resetAt: number;
  /** Config: how long the rolling window is. */
  windowMs: number;
}

/**
 * True when the server operator has turned rate limiting on. Callers should
 * check this first and skip the limiter entirely when false — self-hosters
 * and local-dev should never pay any cost (not even a Map read).
 */
export function isFreeTierLimitEnabled(): boolean {
  return ENABLED;
}

/**
 * Read the current quota state for an install without modifying it. Safe to
 * call from any endpoint. If the install-id is missing or limiter is off,
 * returns an "allowed" status.
 */
export function getQuotaStatus(installId: string | null | undefined): QuotaStatus {
  if (!ENABLED || !installId) {
    return {
      allowed: true,
      quotaMs: QUOTA_MS,
      remainingMs: QUOTA_MS,
      usedMs: 0,
      resetAt: now() + WINDOW_MS,
      windowMs: WINDOW_MS,
    };
  }

  const entry = touchEntry(installId);
  const remainingMs = Math.max(0, QUOTA_MS - entry.usageMs);
  maybePrune();

  const status: QuotaStatus = {
    allowed: remainingMs > 0,
    quotaMs: QUOTA_MS,
    remainingMs,
    usedMs: entry.usageMs,
    resetAt: entry.windowStart + WINDOW_MS,
    windowMs: WINDOW_MS,
  };

  // Log denials specifically — if a user pings support saying "I got capped,"
  // ops greps the JSONL for this event + their installId to see the state.
  // Allow-paths are intentionally not logged here; they fire every tick of
  // every session and would drown the signal.
  if (!status.allowed) {
    logPipeline({
      event: "free_tier_quota_denied",
      level: "info",
      data: {
        installId,
        usedMs: status.usedMs,
        quotaMs: status.quotaMs,
        resetAt: status.resetAt,
        retryAfterMs: Math.max(0, status.resetAt - now()),
      },
    });
  }

  return status;
}

/**
 * Record elapsed usage against an install's quota. Safe to call multiple
 * times per session (e.g., once on DELETE, once on abort — the double-count
 * is acceptable and the caller should just pass the TRUE elapsed time). If
 * the limiter is off or no install-id was provided, this is a no-op.
 */
export function recordUsage(
  installId: string | null | undefined,
  elapsedMs: number
): void {
  if (!ENABLED || !installId) return;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;

  const entry = touchEntry(installId);
  // Clamp to avoid a runaway negative clock bug ever adding nonsense.
  const safeElapsed = Math.min(elapsedMs, WINDOW_MS);
  const beforeMs = entry.usageMs;
  entry.usageMs = Math.min(entry.usageMs + safeElapsed, QUOTA_MS + WINDOW_MS);

  // Debug-level so normal session closes don't spam the log; flipping
  // DEBUG_PIPELINE=true gives ops a full audit trail of who-used-what.
  logPipeline({
    event: "free_tier_usage_recorded",
    level: "debug",
    data: {
      installId,
      elapsedMs: safeElapsed,
      beforeMs,
      afterMs: entry.usageMs,
      remainingMs: Math.max(0, QUOTA_MS - entry.usageMs),
    },
  });
}

/**
 * Format a QuotaStatus into the JSON body we return on a 402 response.
 * Shaped to be useful both for humans (the extension surfaces the message)
 * and for programmatic clients (the `code` + `retryAfterMs`).
 */
export function quotaDeniedBody(status: QuotaStatus): {
  error: string;
  code: "TRIAL_EXHAUSTED";
  quotaMinutes: number;
  windowHours: number;
  oneOff: boolean;
  retryAfterMs: number;
  resetAt: number | null;
} {
  const retryAfterMs = ONE_OFF ? 0 : Math.max(0, status.resetAt - now());
  const message = ONE_OFF
    ? `You've used your free ${FREE_TIER_MINUTES}-minute trial. To keep going, paste your own free-tier API keys below — every provider has one — or subscribe to Peanut Gallery Plus for ad-hoc access without managing keys.`
    : `You've used your free ${FREE_TIER_MINUTES} minutes of hosted transcription for this ${FREE_TIER_WINDOW_HOURS}h window. Paste your own free-tier API keys below to keep going — every provider has one.`;
  return {
    error: message,
    code: "TRIAL_EXHAUSTED",
    quotaMinutes: FREE_TIER_MINUTES,
    windowHours: FREE_TIER_WINDOW_HOURS,
    oneOff: ONE_OFF,
    retryAfterMs,
    resetAt: ONE_OFF ? null : status.resetAt,
  };
}
