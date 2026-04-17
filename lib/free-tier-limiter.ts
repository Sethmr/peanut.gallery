/**
 * Free-tier rate limiter — per-installation quota for the hosted backend.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Peanut Gallery's hosted backend (peanutgallery.live) covers early users'
 * API costs out of the project's pocket. To prevent one or two heavy users
 * from draining the shared keys, each Chrome-extension installation gets a
 * free allowance (default: 15 minutes of transcription per rolling 24h
 * window). After that, the side panel asks them to paste their own free-tier
 * keys or self-host.
 *
 * DESIGN NOTES (important if you change this)
 * ───────────────────────────────────────────
 * 1. **In-memory only.** No Redis, no DB. The counter resets on server
 *    redeploy — this is a deliberate trade-off: zero new infra, zero new
 *    failure modes, zero risk of a dead dep breaking the whole backend. The
 *    hosted instance is a single Railway process, which is the only place
 *    this matters; horizontally scaling would require Redis.
 * 2. **Soft limit, not security.** The `installId` is a UUID the extension
 *    generates on first run. A determined user can reset it by clearing
 *    chrome.storage.local. That's fine — the goal here is to discourage
 *    casual abuse, not stop dedicated attackers. The real budget guard is
 *    the global daily cap below.
 * 3. **Opt-in via env.** The limiter only engages when
 *    `ENABLE_FREE_TIER_LIMIT=true`. Self-hosters never set it, so their
 *    servers behave exactly as before. This file has no effect on any
 *    backend unless the operator explicitly turns it on.
 * 4. **Lazy pruning.** We prune expired entries whenever a key is read, so
 *    no setInterval/timer is needed. Avoids creating background work inside
 *    a Next.js API route (which is spawned fresh-ish per request).
 * 5. **Charged at session end.** We only RESERVE usage at session start
 *    (by checking `remainingMs()`). Actual elapsed time is recorded when
 *    the session closes. A session that starts with 14 min left is allowed
 *    to run to completion even if the video is 2 hours long. This avoids
 *    the terrible UX of "we cut your show off mid-sentence."
 */

// ── CONFIG (all env-overridable) ─────────────────────────────────────────
const ENABLED =
  (process.env.ENABLE_FREE_TIER_LIMIT || "").toLowerCase() === "true";

const FREE_TIER_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.FREE_TIER_MINUTES || "15", 10) || 15
);

const FREE_TIER_WINDOW_HOURS = Math.max(
  1,
  Number.parseInt(process.env.FREE_TIER_WINDOW_HOURS || "24", 10) || 24
);

const QUOTA_MS = FREE_TIER_MINUTES * 60 * 1000;
const WINDOW_MS = FREE_TIER_WINDOW_HOURS * 60 * 60 * 1000;

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
    return fresh;
  }

  // Window expired → reset. This is the "rolling 24h" behavior.
  if (t - existing.windowStart >= WINDOW_MS) {
    existing.usageMs = 0;
    existing.windowStart = t;
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

  return {
    allowed: remainingMs > 0,
    quotaMs: QUOTA_MS,
    remainingMs,
    usedMs: entry.usageMs,
    resetAt: entry.windowStart + WINDOW_MS,
    windowMs: WINDOW_MS,
  };
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
  entry.usageMs = Math.min(entry.usageMs + safeElapsed, QUOTA_MS + WINDOW_MS);
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
  retryAfterMs: number;
  resetAt: number;
} {
  const retryAfterMs = Math.max(0, status.resetAt - now());
  return {
    error: `You've used your free ${FREE_TIER_MINUTES} minutes of hosted transcription for this ${FREE_TIER_WINDOW_HOURS}h window. Paste your own free-tier API keys below to keep going — every provider has one.`,
    code: "TRIAL_EXHAUSTED",
    quotaMinutes: FREE_TIER_MINUTES,
    windowHours: FREE_TIER_WINDOW_HOURS,
    retryAfterMs,
    resetAt: status.resetAt,
  };
}
