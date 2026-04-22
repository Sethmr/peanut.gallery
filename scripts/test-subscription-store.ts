#!/usr/bin/env tsx
/**
 * Unit tests for the Phase 2 subscription store + key generator.
 *
 * Covers:
 *   - Key generator format + checksum round-trip
 *   - Format validation catches common tampering
 *   - MemorySubscriptionStore: insert / lookup / revoke / usage roll
 *   - SqliteSubscriptionStore: same behavior via SQLite
 *   - Cross-store parity: identical calls produce identical results
 *   - Back-compat: env-whitelist Phase 1 keys work without checksums
 *
 * Design goal: the two store implementations are observationally
 * equivalent. The rest of the codebase only knows the interface; if
 * a caller regresses when we swap stores, the test catches it here.
 *
 * Does NOT touch:
 *   - Director / persona-engine / claim-detector / transcription — those
 *     systems don't import from subscription-store; preserving their
 *     value was the brief.
 *   - HTTP routes — those have their own surfaces; this layer is pure.
 *
 * Run: `npm run test:subscription-store`.
 */

import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

import {
  generateLicenseKey,
  isValidLicenseKey,
  luhnHexChecksum,
} from "../lib/subscription-keys";
import {
  MemorySubscriptionStore,
  SqliteSubscriptionStore,
  type SubscriptionStore,
  type SubscriptionRecord,
} from "../lib/subscription-store";

// ─────────────────────────────────────────────────────────────
// TINY HARNESS
// ─────────────────────────────────────────────────────────────

let total = 0;
let passed = 0;
const failures: string[] = [];

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

function assert(condition: boolean, label: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

function assertEq<T>(got: T, want: T, label: string): void {
  const ok = Object.is(got, want);
  assert(ok, `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}

function assertThrows(fn: () => unknown, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, label);
}

// ─────────────────────────────────────────────────────────────
// KEY GENERATOR + VALIDATOR
// ─────────────────────────────────────────────────────────────

function testKeyGenerator(): void {
  section("subscription-keys — generate + validate");

  for (let i = 0; i < 100; i++) {
    const k = generateLicenseKey();
    assert(/^pg-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/.test(k), `shape ok (#${i})`);
    assert(isValidLicenseKey(k), `validator accepts own output (#${i})`);
  }

  // Checksum function directly
  assertEq(
    luhnHexChecksum("00000000000"),
    "0",
    "zero body → zero checksum",
  );
  assertThrows(
    () => luhnHexChecksum("short"),
    "luhn rejects non-11-char input",
  );
  assertThrows(
    () => luhnHexChecksum("zzzzzzzzzzz"),
    "luhn rejects non-hex input",
  );

  // Validator edge cases
  // All-zeros is trivially a valid key (11 zeros → checksum 0), which
  // is fine mathematically; the 44-bit entropy of the random prefix
  // is what keeps keys un-guessable in practice, not the checksum.
  assert(isValidLicenseKey("pg-0000-0000-0000"), "all-zero key is technically valid (checksum=0)");
  assert(!isValidLicenseKey("pg-XXXX-XXXX-XXXX"), "uppercase rejected");
  assert(!isValidLicenseKey("pg-0000-0000-000"), "wrong length rejected");
  assert(!isValidLicenseKey("PG-0000-0000-0000"), "uppercase prefix rejected");
  assert(!isValidLicenseKey(""), "empty rejected");

  // Single-char tampering detection
  const good = generateLicenseKey();
  const body = good.slice(3).replace(/-/g, "");
  for (let i = 0; i < 12; i++) {
    const origCh = body[i];
    // Swap with a different hex char
    const altCh = origCh === "0" ? "1" : "0";
    const tampered = body.slice(0, i) + altCh + body.slice(i + 1);
    const formatted = `pg-${tampered.slice(0, 4)}-${tampered.slice(4, 8)}-${tampered.slice(8, 12)}`;
    assert(
      !isValidLicenseKey(formatted),
      `single-char swap at position ${i} rejected`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// STORE PARITY SUITE (runs against each impl)
// ─────────────────────────────────────────────────────────────

function runStoreParityTests(label: string, make: () => SubscriptionStore): void {
  section(`${label} — basic CRUD`);
  const s = make();
  const now = Date.now();

  // Empty store
  assertEq(s.getActiveSubscription("pg-0000-0000-0000"), null, "unknown key → null");
  assertEq(s.getSubscriptionByEmail("none@example.com"), null, "unknown email → null");

  // Insert one
  const recA: SubscriptionRecord = {
    licenseKey: "pg-aaaa-bbbb-ccc4",
    email: "alice@example.com",
    stripeSubId: "sub_alice",
    createdAt: now,
    cancelledAt: null,
    status: "active",
  };
  s.insertSubscription(recA);
  const fetched = s.getActiveSubscription(recA.licenseKey);
  assert(fetched !== null, "inserted record is fetchable");
  assertEq(fetched?.email, recA.email, "email round-trips");
  assertEq(fetched?.stripeSubId, recA.stripeSubId, "stripeSubId round-trips");
  assertEq(fetched?.status, "active", "status round-trips");
  assertEq(
    s.getSubscriptionByEmail("ALICE@example.com")?.licenseKey,
    recA.licenseKey,
    "case-insensitive email lookup",
  );

  // Duplicate insert rejected
  assertThrows(
    () => s.insertSubscription(recA),
    "duplicate licenseKey rejected on insert",
  );

  // Usage starts at zero + increments
  const u0 = s.touchUsage(recA.licenseKey);
  assertEq(u0.usageMs, 0, "fresh usage is 0");
  s.addUsage(recA.licenseKey, 1000);
  const u1 = s.touchUsage(recA.licenseKey);
  assertEq(u1.usageMs, 1000, "addUsage increments");
  s.addUsage(recA.licenseKey, 2500);
  const u2 = s.touchUsage(recA.licenseKey);
  assertEq(u2.usageMs, 3500, "addUsage accumulates");
  assertEq(u2.weekStart, u1.weekStart, "weekStart stable within window");

  // Revoked key not returned by getActive
  s.updateSubscriptionStatus(recA.licenseKey, {
    status: "revoked",
    cancelledAt: now + 10,
  });
  assertEq(
    s.getActiveSubscription(recA.licenseKey),
    null,
    "revoked key filtered from getActiveSubscription",
  );
  // But still findable by email (history preserved)
  const byEmail = s.getSubscriptionByEmail("alice@example.com");
  assertEq(byEmail?.status, "revoked", "email lookup returns revoked rows for audit");
}

// ─────────────────────────────────────────────────────────────
// BACK-COMPAT: Phase 1 env-whitelist
// ─────────────────────────────────────────────────────────────

function testPhase1Whitelist(): void {
  section("MemorySubscriptionStore — Phase 1 env-whitelist compatibility");
  const store = new MemorySubscriptionStore({
    whitelistEnv:
      "pg-test-0001-0001=founder@example.com,pg-test-0002-0002=beta@example.com",
  });
  const a = store.getActiveSubscription("pg-test-0001-0001");
  assertEq(a?.email, "founder@example.com", "env-whitelist entry #1 loaded");
  const b = store.getActiveSubscription("pg-test-0002-0002");
  assertEq(b?.email, "beta@example.com", "env-whitelist entry #2 loaded");
  assert(
    store.getActiveSubscription("pg-test-unknown") === null,
    "non-whitelisted key rejected",
  );

  // Phase 1 keys don't pass the checksum validator — this is the
  // whole point of keeping format-check advisory in subscription.ts.
  assert(
    !isValidLicenseKey("pg-test-0001-0001"),
    "Phase 1 key fails checksum (advisory, not gating)",
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

function main(): void {
  testKeyGenerator();
  runStoreParityTests("MemorySubscriptionStore", () => new MemorySubscriptionStore());

  const tmp = mkdtempSync(path.join(os.tmpdir(), "pg-sub-test-"));
  const dbPath = path.join(tmp, "subs.db");
  try {
    runStoreParityTests(
      "SqliteSubscriptionStore",
      () => new SqliteSubscriptionStore(dbPath),
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  testPhase1Whitelist();

  console.log(
    `\n${passed}/${total} tests ${passed === total ? "passed" : "FAILED"}`,
  );
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
