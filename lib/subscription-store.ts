/**
 * Subscription store — SQLite-backed Phase 2 identity with an
 * in-memory fallback that preserves the Phase 1 env-whitelist
 * behavior.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Phase 1 used an in-memory `Map<licenseKey, {email}>` populated from
 * the `SUBSCRIPTION_KEYS_WHITELIST` env var. Usage counters were
 * per-process; a Railway redeploy reset everyone's weekly cap. Phase 2
 * moves that state to a file-backed SQLite database so subscribers
 * survive redeploys and the Privacy Policy's promise of durable,
 * encrypted-at-rest subscription identity is true.
 *
 * PUBLIC API OF `lib/subscription.ts` IS UNCHANGED
 * ────────────────────────────────────────────────
 * Callers (`/api/transcribe`, `/api/subscription/status`, etc.)
 * continue to see the exact same three functions:
 *   - `isSubscriptionEnabled()`
 *   - `getSubscriptionStatus(key)`
 *   - `recordSubscriptionUsage(key, elapsedMs)`
 *   - `subscriptionDeniedBody(status)`
 *
 * Nothing in the pipeline path (Director, persona engine, claim
 * detector, transcription, fact-check search) is touched by this
 * change. This module is pure subscription storage.
 *
 * BACKWARD-COMPAT MODE SELECTION
 * ──────────────────────────────
 * The runtime picks between SQLite-backed and in-memory based on env:
 *
 *   - `SUBSCRIPTION_DB_PATH=/data/subscriptions.db` → SQLite store.
 *   - Unset → in-memory env-whitelist store (Phase 1 behavior
 *     preserved exactly). Self-hosters and local dev who haven't
 *     flipped the switch see zero change.
 *
 * Tests exercise both paths. The MemorySubscriptionStore is the
 * reference implementation; the SqliteSubscriptionStore is expected
 * to match its observable behavior.
 *
 * SCHEMA
 * ──────
 * Matches `docs/SUBSCRIPTION-ARCHITECTURE.md § Data model § Phase 2+`:
 *
 *   CREATE TABLE subscriptions (
 *     license_key    TEXT PRIMARY KEY,
 *     email          TEXT NOT NULL,
 *     stripe_sub_id  TEXT,
 *     created_at     INTEGER NOT NULL,
 *     cancelled_at   INTEGER,
 *     status         TEXT CHECK (status IN ('active','paused','revoked'))
 *                         NOT NULL
 *   );
 *   CREATE INDEX idx_subs_email ON subscriptions(email);
 *
 *   CREATE TABLE subscription_usage (
 *     license_key    TEXT NOT NULL,
 *     week_start     INTEGER NOT NULL,
 *     usage_ms       INTEGER NOT NULL DEFAULT 0,
 *     PRIMARY KEY (license_key, week_start)
 *   );
 *   CREATE INDEX idx_usage_week ON subscription_usage(week_start);
 *
 * ENCRYPTION AT REST
 * ──────────────────
 * Two options depending on how SQLite is compiled:
 *   (a) If the runtime has a SQLCipher-capable binary (set
 *       `SUBSCRIPTION_DB_KEY` and the module calls `PRAGMA key`).
 *   (b) Otherwise the DB file sits on an encrypted filesystem volume
 *       (Railway volumes + OS-level disk encryption). The public
 *       claim in the Privacy Policy ("encrypted at rest") is
 *       satisfied by either; counsel's guidance was that disk-level
 *       encryption is sufficient for the scale we're at (<1k rows).
 *
 * This module attempts `PRAGMA key` only when `SUBSCRIPTION_DB_KEY`
 * is set AND the underlying binary accepts it; otherwise it logs
 * `subscription_db_disk_encryption_only` at info level and proceeds.
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import path from "path";

import { logPipeline } from "./debug-logger";

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────────────────────

export interface SubscriptionRecord {
  licenseKey: string;
  email: string;
  stripeSubId: string | null;
  createdAt: number;
  cancelledAt: number | null;
  status: "active" | "paused" | "revoked";
}

export interface UsageRecord {
  licenseKey: string;
  weekStart: number;
  usageMs: number;
}

export interface SubscriptionStore {
  /** Returns the record for this key, or null if unknown / revoked. */
  getActiveSubscription(licenseKey: string): SubscriptionRecord | null;
  /** Returns the most recent subscription row for this email (any status). */
  getSubscriptionByEmail(email: string): SubscriptionRecord | null;
  /** Insert a new subscription. Throws if `licenseKey` already exists. */
  insertSubscription(row: SubscriptionRecord): void;
  /** Update status / cancelledAt for an existing subscription. */
  updateSubscriptionStatus(
    licenseKey: string,
    patch: { status?: SubscriptionRecord["status"]; cancelledAt?: number | null }
  ): void;
  /**
   * Return the UsageRecord for the current rolling-7-day window,
   * resetting the window if more than WEEK_MS has elapsed since
   * `weekStart`. Creates a fresh row on first access.
   */
  touchUsage(licenseKey: string): UsageRecord;
  /** Increment the current-window usage by `deltaMs`. */
  addUsage(licenseKey: string, deltaMs: number): void;
  /**
   * Optional: purge rows older than N days. Called from a periodic
   * pruner in production; safe to no-op in test / memory.
   */
  pruneOlderThanMs?(ms: number): void;
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY STORE (Phase 1 behavior, preserved for back-compat)
// ─────────────────────────────────────────────────────────────

export interface MemoryStoreOptions {
  /**
   * Initial env-whitelist in the format the Phase 1 limiter used:
   *   pg-xxxx-xxxx-xxxx=email@example.com,pg-yyyy-yyyy-yyyy=...
   */
  whitelistEnv?: string;
}

export class MemorySubscriptionStore implements SubscriptionStore {
  private subscriptions = new Map<string, SubscriptionRecord>();
  private byEmail = new Map<string, SubscriptionRecord>();
  private usage = new Map<string, UsageRecord>();

  constructor(opts: MemoryStoreOptions = {}) {
    if (opts.whitelistEnv) {
      const now = Date.now();
      for (const entry of opts.whitelistEnv.split(",")) {
        const [key, email] = entry.split("=");
        const k = (key || "").trim();
        const e = (email || "").trim();
        if (!k || !e) continue;
        const row: SubscriptionRecord = {
          licenseKey: k,
          email: e,
          stripeSubId: null,
          createdAt: now,
          cancelledAt: null,
          status: "active",
        };
        this.subscriptions.set(k, row);
        this.byEmail.set(e.toLowerCase(), row);
      }
    }
  }

  getActiveSubscription(licenseKey: string): SubscriptionRecord | null {
    const row = this.subscriptions.get(licenseKey);
    if (!row) return null;
    if (row.status === "revoked") return null;
    return row;
  }

  getSubscriptionByEmail(email: string): SubscriptionRecord | null {
    return this.byEmail.get(email.toLowerCase()) ?? null;
  }

  insertSubscription(row: SubscriptionRecord): void {
    if (this.subscriptions.has(row.licenseKey)) {
      throw new Error(`License key already exists: ${row.licenseKey}`);
    }
    this.subscriptions.set(row.licenseKey, row);
    this.byEmail.set(row.email.toLowerCase(), row);
  }

  updateSubscriptionStatus(
    licenseKey: string,
    patch: { status?: SubscriptionRecord["status"]; cancelledAt?: number | null }
  ): void {
    const row = this.subscriptions.get(licenseKey);
    if (!row) return;
    if (patch.status) row.status = patch.status;
    if ("cancelledAt" in patch) row.cancelledAt = patch.cancelledAt ?? null;
  }

  touchUsage(licenseKey: string): UsageRecord {
    const t = Date.now();
    const existing = this.usage.get(licenseKey);
    if (!existing) {
      const fresh: UsageRecord = { licenseKey, usageMs: 0, weekStart: t };
      this.usage.set(licenseKey, fresh);
      return fresh;
    }
    if (t - existing.weekStart >= WEEK_MS) {
      existing.usageMs = 0;
      existing.weekStart = t;
    }
    return existing;
  }

  addUsage(licenseKey: string, deltaMs: number): void {
    const row = this.touchUsage(licenseKey);
    row.usageMs += Math.max(0, deltaMs);
  }

  pruneOlderThanMs(): void {
    // No-op for the memory store — tests create fresh instances.
  }
}

// ─────────────────────────────────────────────────────────────
// SQLITE STORE (Phase 2 — durable)
// ─────────────────────────────────────────────────────────────

/**
 * SQLite-backed implementation. Lazily imports `better-sqlite3` so
 * tests + memory-mode runtimes never pay the native-module load
 * cost. If the import fails (e.g. sandbox without the prebuilt
 * binary), the module logs at warn and throws; the caller should
 * fall back to the memory store.
 */
export class SqliteSubscriptionStore implements SubscriptionStore {
  // `any` here is load-bearing: better-sqlite3's exported types
  // would require the @types import to resolve at type-check time
  // even when the module isn't used. The lazy-loaded object is
  // well-shaped at runtime; we narrow via runtime checks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;
  private readonly dbPath: string;

  constructor(dbPath: string, encryptionKey?: string) {
    this.dbPath = dbPath;
    // Ensure the directory exists. Railway volumes mount at a known
    // path; if the operator misconfigures, we want to fail loudly
    // at boot rather than on first subscription attempt.
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    this.db = new Database(dbPath);
    // Enable write-ahead logging for concurrent-read safety during
    // the single-writer usage we have. WAL survives crashes better
    // than rollback journal for small DBs.
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");

    // Try SQLCipher encryption if a key is provided AND the binary
    // supports it. better-sqlite3 doesn't ship SQLCipher by default,
    // so a bare `PRAGMA key` returns "not an error" on vanilla builds.
    // We probe by attempting a write after pragma and swallow the
    // error if the binary is non-cipher.
    if (encryptionKey) {
      try {
        this.db.pragma(`key = '${encryptionKey.replace(/'/g, "''")}'`);
        this.db.prepare("CREATE TABLE IF NOT EXISTS __cipher_probe (x)").run();
        this.db.prepare("DROP TABLE __cipher_probe").run();
        logPipeline({
          event: "subscription_db_sqlcipher_enabled",
          level: "info",
          data: { dbPath },
        });
      } catch (err) {
        logPipeline({
          event: "subscription_db_disk_encryption_only",
          level: "info",
          data: {
            dbPath,
            reason:
              err instanceof Error ? err.message : "pragma-key-not-supported",
            note:
              "Binary is vanilla better-sqlite3; relying on disk-level encryption for at-rest.",
          },
        });
      }
    } else {
      logPipeline({
        event: "subscription_db_disk_encryption_only",
        level: "info",
        data: {
          dbPath,
          note:
            "No SUBSCRIPTION_DB_KEY set; relying on disk-level encryption for at-rest.",
        },
      });
    }

    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        license_key    TEXT PRIMARY KEY,
        email          TEXT NOT NULL,
        stripe_sub_id  TEXT,
        created_at     INTEGER NOT NULL,
        cancelled_at   INTEGER,
        status         TEXT CHECK (status IN ('active','paused','revoked'))
                             NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subs_email ON subscriptions(email);

      CREATE TABLE IF NOT EXISTS subscription_usage (
        license_key    TEXT NOT NULL,
        week_start     INTEGER NOT NULL,
        usage_ms       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (license_key, week_start)
      );
      CREATE INDEX IF NOT EXISTS idx_usage_week
        ON subscription_usage(week_start);
    `);
  }

  getActiveSubscription(licenseKey: string): SubscriptionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM subscriptions WHERE license_key = ?")
      .get(licenseKey);
    if (!row) return null;
    const rec = rowToRecord(row);
    if (rec.status === "revoked") return null;
    return rec;
  }

  getSubscriptionByEmail(email: string): SubscriptionRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM subscriptions
           WHERE LOWER(email) = LOWER(?)
           ORDER BY created_at DESC
           LIMIT 1`
      )
      .get(email);
    return row ? rowToRecord(row) : null;
  }

  insertSubscription(row: SubscriptionRecord): void {
    this.db
      .prepare(
        `INSERT INTO subscriptions
           (license_key, email, stripe_sub_id, created_at, cancelled_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.licenseKey,
        row.email,
        row.stripeSubId,
        row.createdAt,
        row.cancelledAt,
        row.status
      );
  }

  updateSubscriptionStatus(
    licenseKey: string,
    patch: { status?: SubscriptionRecord["status"]; cancelledAt?: number | null }
  ): void {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (patch.status !== undefined) {
      sets.push("status = ?");
      vals.push(patch.status);
    }
    if ("cancelledAt" in patch) {
      sets.push("cancelled_at = ?");
      vals.push(patch.cancelledAt ?? null);
    }
    if (sets.length === 0) return;
    vals.push(licenseKey);
    this.db
      .prepare(`UPDATE subscriptions SET ${sets.join(", ")} WHERE license_key = ?`)
      .run(...vals);
  }

  touchUsage(licenseKey: string): UsageRecord {
    const t = Date.now();
    const row = this.db
      .prepare(
        `SELECT * FROM subscription_usage
           WHERE license_key = ?
           ORDER BY week_start DESC
           LIMIT 1`
      )
      .get(licenseKey) as
      | { license_key: string; week_start: number; usage_ms: number }
      | undefined;
    if (!row) {
      this.db
        .prepare(
          `INSERT INTO subscription_usage (license_key, week_start, usage_ms)
           VALUES (?, ?, 0)`
        )
        .run(licenseKey, t);
      return { licenseKey, weekStart: t, usageMs: 0 };
    }
    if (t - row.week_start >= WEEK_MS) {
      // New week — insert a fresh row. We keep the old row for
      // historical auditing (capped by the optional prune).
      this.db
        .prepare(
          `INSERT INTO subscription_usage (license_key, week_start, usage_ms)
           VALUES (?, ?, 0)`
        )
        .run(licenseKey, t);
      return { licenseKey, weekStart: t, usageMs: 0 };
    }
    return {
      licenseKey: row.license_key,
      weekStart: row.week_start,
      usageMs: row.usage_ms,
    };
  }

  addUsage(licenseKey: string, deltaMs: number): void {
    const current = this.touchUsage(licenseKey);
    const inc = Math.max(0, deltaMs);
    this.db
      .prepare(
        `UPDATE subscription_usage
            SET usage_ms = usage_ms + ?
          WHERE license_key = ? AND week_start = ?`
      )
      .run(inc, licenseKey, current.weekStart);
  }

  pruneOlderThanMs(ms: number): void {
    const cutoff = Date.now() - ms;
    this.db
      .prepare(`DELETE FROM subscription_usage WHERE week_start < ?`)
      .run(cutoff);
  }

  /** Escape hatch for tests only. */
  _rawDb(): unknown {
    return this.db;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: any): SubscriptionRecord {
  return {
    licenseKey: row.license_key,
    email: row.email,
    stripeSubId: row.stripe_sub_id ?? null,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at ?? null,
    status: row.status,
  };
}

// ─────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __pg_subscription_store_v2: SubscriptionStore | undefined;
  // eslint-disable-next-line no-var
  var __pg_subscription_store_v2_kind: "memory" | "sqlite" | undefined;
}

/**
 * Resolve the SubscriptionStore singleton for this process. Called
 * lazily from `lib/subscription.ts`; the singleton survives
 * Next.js hot-reload via globalThis.
 *
 * Env:
 *   SUBSCRIPTION_DB_PATH=/data/subscriptions.db → SqliteSubscriptionStore
 *   SUBSCRIPTION_DB_KEY (optional)              → SQLCipher PRAGMA key
 *   SUBSCRIPTION_KEYS_WHITELIST (no-DB path)    → seeds MemorySubscriptionStore
 *
 * Tests can inject a store via {@link setSubscriptionStoreForTests}.
 */
export function getSubscriptionStore(): SubscriptionStore {
  if (globalThis.__pg_subscription_store_v2) {
    return globalThis.__pg_subscription_store_v2;
  }
  const dbPath = process.env.SUBSCRIPTION_DB_PATH || "";
  if (dbPath) {
    try {
      const store = new SqliteSubscriptionStore(
        dbPath,
        process.env.SUBSCRIPTION_DB_KEY || undefined
      );
      globalThis.__pg_subscription_store_v2 = store;
      globalThis.__pg_subscription_store_v2_kind = "sqlite";
      logPipeline({
        event: "subscription_store_initialized",
        level: "info",
        data: { kind: "sqlite", dbPath },
      });
      return store;
    } catch (err) {
      logPipeline({
        event: "subscription_store_sqlite_init_failed",
        level: "error",
        data: {
          dbPath,
          message: err instanceof Error ? err.message : String(err),
          note:
            "Falling back to in-memory store; subscription identity NOT persisted.",
        },
      });
      // Fall through to memory-store init below.
    }
  }
  const store = new MemorySubscriptionStore({
    whitelistEnv: process.env.SUBSCRIPTION_KEYS_WHITELIST || "",
  });
  globalThis.__pg_subscription_store_v2 = store;
  globalThis.__pg_subscription_store_v2_kind = "memory";
  logPipeline({
    event: "subscription_store_initialized",
    level: "info",
    data: {
      kind: "memory",
      reason: dbPath ? "sqlite-init-failed" : "no-SUBSCRIPTION_DB_PATH",
    },
  });
  return store;
}

/** Test helper — inject a store implementation. */
export function setSubscriptionStoreForTests(
  store: SubscriptionStore | null
): void {
  globalThis.__pg_subscription_store_v2 = store ?? undefined;
  globalThis.__pg_subscription_store_v2_kind = store
    ? store instanceof SqliteSubscriptionStore
      ? "sqlite"
      : "memory"
    : undefined;
}

/** Observability — which store kind is active? */
export function getSubscriptionStoreKind(): "memory" | "sqlite" | "uninitialized" {
  return globalThis.__pg_subscription_store_v2_kind ?? "uninitialized";
}

/**
 * Convenience: create a subscription row for a fresh paid user.
 * Used by the Stripe webhook (Phase 3) and the admin CLI.
 *
 * The caller is responsible for generating + validating the
 * licenseKey via `lib/subscription-keys.ts` before calling this.
 */
export function createSubscription(args: {
  licenseKey: string;
  email: string;
  stripeSubId: string | null;
}): SubscriptionRecord {
  const store = getSubscriptionStore();
  const now = Date.now();
  const rec: SubscriptionRecord = {
    licenseKey: args.licenseKey,
    email: args.email,
    stripeSubId: args.stripeSubId,
    createdAt: now,
    cancelledAt: null,
    status: "active",
  };
  store.insertSubscription(rec);
  return rec;
}

/** Generate a unique license key, handling the rare collision case. */
export function reserveUniqueLicenseKey(
  generate: () => string,
  maxAttempts = 5
): string {
  const store = getSubscriptionStore();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generate();
    if (!store.getActiveSubscription(candidate)) return candidate;
  }
  // 44 bits of entropy means collisions are essentially impossible
  // for any realistic subscriber count. If we hit 5, something is
  // very wrong (e.g. RNG broken) and a random UUID fallback at
  // least lets the caller surface a clear error.
  throw new Error(
    `Could not reserve a unique license key after ${maxAttempts} attempts (trace=${randomUUID()})`
  );
}
