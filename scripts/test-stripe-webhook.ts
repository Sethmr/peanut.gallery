#!/usr/bin/env tsx
/**
 * Unit tests for the Stripe webhook signature verifier (SET-26).
 *
 * Covers:
 *   - Signature verification happy path
 *   - Reject on missing secret / header
 *   - Reject on malformed header
 *   - Reject on timestamp skew
 *   - Reject on tampered body
 *   - Constant-time comparison shape (multi-signature support)
 *   - Custom tolerance
 *
 * Does NOT touch:
 *   - The route handler itself — route tests are integration-shaped
 *     and live outside this unit suite. The handler is a thin switch
 *     over event.type; the crypto-critical piece is the verifier.
 *   - Director, persona-engine, claim-detector. Subscription webhook
 *     is pure identity / billing plumbing.
 */

import { signStripeBody, verifyStripeSignature } from "../lib/stripe-webhook";

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

const SECRET = "whsec_test_sikritvalue";
const BODY = '{"id":"evt_abc","type":"checkout.session.completed"}';

function testHappyPath(): void {
  section("verify — happy path");
  const now = 1_700_000_000;
  const header = signStripeBody(BODY, SECRET, now);
  const v = verifyStripeSignature(BODY, header, SECRET, { now: () => now });
  assert(v.ok, "verifies a freshly signed body");
  assertEq(v.timestamp, now, "returns the signed timestamp");
}

function testNegativePaths(): void {
  section("verify — rejection paths");
  const now = 1_700_000_000;
  const header = signStripeBody(BODY, SECRET, now);

  // Missing secret
  const v1 = verifyStripeSignature(BODY, header, "", { now: () => now });
  assert(!v1.ok, "rejects missing secret");
  assertEq(v1.reason, "MISSING_SECRET", "missing-secret reason");

  // Missing header
  const v2 = verifyStripeSignature(BODY, null, SECRET, { now: () => now });
  assert(!v2.ok, "rejects missing header");
  assertEq(v2.reason, "MISSING_HEADER", "missing-header reason");

  // Malformed header (no t=, no v1=)
  const v3 = verifyStripeSignature(BODY, "not-a-header", SECRET, {
    now: () => now,
  });
  assert(!v3.ok, "rejects malformed header (no fields)");

  // Malformed header (no v1)
  const v4 = verifyStripeSignature(BODY, `t=${now}`, SECRET, {
    now: () => now,
  });
  assert(!v4.ok, "rejects header with t but no v1");
  assertEq(v4.reason, "MALFORMED_HEADER", "no-v1 reason");

  // Timestamp skew (beyond tolerance)
  const v5 = verifyStripeSignature(BODY, header, SECRET, {
    now: () => now + 10_000,
  });
  assert(!v5.ok, "rejects skewed timestamp");
  assertEq(v5.reason, "TIMESTAMP_SKEW", "timestamp-skew reason");

  // Tampered body
  const v6 = verifyStripeSignature(
    BODY + "\u0000tampered",
    header,
    SECRET,
    { now: () => now }
  );
  assert(!v6.ok, "rejects tampered body");
  assertEq(v6.reason, "NO_SIGNATURE_MATCH", "no-sig-match reason");

  // Wrong secret
  const v7 = verifyStripeSignature(BODY, header, "wrong_secret", {
    now: () => now,
  });
  assert(!v7.ok, "rejects wrong secret");
  assertEq(v7.reason, "NO_SIGNATURE_MATCH", "wrong-secret also reads as no-match");
}

function testTolerance(): void {
  section("verify — tolerance behavior");
  const now = 1_700_000_000;
  const header = signStripeBody(BODY, SECRET, now);

  // 301s past → default 300s tolerance rejects
  const v1 = verifyStripeSignature(BODY, header, SECRET, {
    now: () => now + 301,
  });
  assert(!v1.ok, "301s past default tolerance rejects");

  // 299s past → within default tolerance
  const v2 = verifyStripeSignature(BODY, header, SECRET, {
    now: () => now + 299,
  });
  assert(v2.ok, "299s past default tolerance accepts");

  // 299s BEFORE → within default tolerance (future-dated acceptable
  // within the same window; NTP skew can easily land a few seconds
  // in the future).
  const v3 = verifyStripeSignature(BODY, header, SECRET, {
    now: () => now - 299,
  });
  assert(v3.ok, "future-skew within default tolerance accepts");

  // Custom tighter tolerance
  const v4 = verifyStripeSignature(BODY, header, SECRET, {
    now: () => now + 60,
    tolerance: 30,
  });
  assert(!v4.ok, "custom tolerance enforced");
}

function testMultipleSignatures(): void {
  section("verify — multiple v1 signatures");
  const now = 1_700_000_000;
  // Stripe sometimes sends multiple v1 signatures during key rotation.
  // The header format supports arbitrary v1 entries. Build one manually:
  const sigGood = signStripeBody(BODY, SECRET, now).split("v1=")[1];
  const header = `t=${now},v1=deadbeef00000000000000000000000000000000000000000000000000000000,v1=${sigGood}`;
  const v = verifyStripeSignature(BODY, header, SECRET, { now: () => now });
  assert(v.ok, "accepts when any v1 matches");

  // All bad
  const headerAllBad = `t=${now},v1=deadbeef,v1=cafebabe`;
  const vBad = verifyStripeSignature(BODY, headerAllBad, SECRET, {
    now: () => now,
  });
  assert(!vBad.ok, "rejects when all v1 signatures are bad");
}

function main(): void {
  testHappyPath();
  testNegativePaths();
  testTolerance();
  testMultipleSignatures();

  console.log(
    `\n${passed}/${total} tests ${passed === total ? "passed" : "FAILED"}`
  );
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
