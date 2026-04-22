/**
 * Stripe webhook — signature verification + typed event parsing.
 *
 * WHY THIS LIVES IN ITS OWN MODULE
 * ────────────────────────────────
 * The webhook route (`app/api/subscription/webhook/route.ts`) is the
 * only entry point for state that Stripe asserts — subscription
 * creation, renewal, cancellation. Every bit of logic in that route
 * must be invoked AFTER a valid signature check, or an attacker with
 * the public webhook URL can claim arbitrary state. Keeping the
 * verification in its own file makes it (a) easy to test in
 * isolation, (b) obvious where the trust boundary is, (c) reusable
 * if we ever need to re-verify a stored webhook payload (dead-letter
 * replay).
 *
 * ALGORITHM
 * ─────────
 * Stripe's signature header takes the form:
 *
 *   t=<unix-timestamp>,v1=<hex-hmac-sha256-sig>[,v1=<sig>]*
 *
 * To verify:
 *   1. Parse `t` and every `v1` from the header.
 *   2. Reject if `|now - t| > tolerance` (default: 300 seconds).
 *   3. Compute `HMAC-SHA256(webhookSecret, `${t}.${rawBody}`)`, hex-encoded.
 *   4. Compare constant-time against each `v1`. Pass if any match.
 *
 * Reference: https://docs.stripe.com/webhooks#verify-manually
 *
 * WHY WE DON'T USE THE STRIPE NPM PACKAGE
 * ────────────────────────────────────────
 * The product's other API integrations (Anthropic, xAI, Brave,
 * Deepgram) are all direct HTTP via `fetch`. Adding the `stripe`
 * package pulls in ~4 MB of runtime + the full Stripe TypeScript
 * surface for a three-endpoint integration. The manual verifier is
 * ~50 lines of well-understood crypto — the right level of surface
 * for a security-critical path we want to read and audit.
 *
 * SAFETY INVARIANTS
 * ─────────────────
 * 1. **Constant-time comparison.** `crypto.timingSafeEqual` guards
 *    against timing-oracle side channels on the signature compare.
 * 2. **Timestamp skew rejection.** 5-minute default tolerance matches
 *    Stripe's own default. Old payloads can't be replayed.
 * 3. **Clear error codes.** The verifier returns `{ ok: false, reason }`
 *    with a machine-readable reason; callers log the reason so ops
 *    can distinguish "signed wrong" from "too old" from "no header".
 * 4. **Raw body requirement.** The route MUST read `req.text()` (or
 *    `req.arrayBuffer()`) and pass that exact string to the verifier.
 *    Any reformatting (JSON parse + re-stringify) will break the
 *    signature because Stripe hashes the EXACT bytes it sent.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface VerifyResult {
  ok: boolean;
  /** Present on ok=false. Machine-readable. */
  reason?:
    | "MISSING_HEADER"
    | "MALFORMED_HEADER"
    | "TIMESTAMP_SKEW"
    | "NO_SIGNATURE_MATCH"
    | "MISSING_SECRET";
  /** Present on ok=true. The signed timestamp from the header. */
  timestamp?: number;
}

export interface VerifyOptions {
  /** Max allowed absolute time skew in seconds. Default 300 (5 min). */
  tolerance?: number;
  /**
   * Clock for testing. Returns current unix seconds. Defaults to
   * `() => Math.floor(Date.now() / 1000)`.
   */
  now?: () => number;
}

/**
 * Verify a Stripe webhook signature. Returns `{ok: true, timestamp}`
 * on success, or `{ok: false, reason}` on any failure.
 *
 * @param rawBody the raw request body as a string — DO NOT parse or
 *                re-stringify before passing this in.
 * @param header  the `Stripe-Signature` header value.
 * @param secret  the `STRIPE_WEBHOOK_SECRET` shared with Stripe.
 * @param opts    optional tolerance + clock injection for tests.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  opts: VerifyOptions = {}
): VerifyResult {
  if (!secret) return { ok: false, reason: "MISSING_SECRET" };
  if (!header) return { ok: false, reason: "MISSING_HEADER" };

  const parsed = parseSignatureHeader(header);
  if (!parsed || parsed.v1.length === 0) {
    return { ok: false, reason: "MALFORMED_HEADER" };
  }

  const now = (opts.now ?? (() => Math.floor(Date.now() / 1000)))();
  const tolerance = opts.tolerance ?? 300;
  if (Math.abs(now - parsed.t) > tolerance) {
    return { ok: false, reason: "TIMESTAMP_SKEW" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.t}.${rawBody}`, "utf8")
    .digest();

  for (const sig of parsed.v1) {
    const candidate = Buffer.from(sig, "hex");
    if (candidate.length !== expected.length) continue;
    if (timingSafeEqual(candidate, expected)) {
      return { ok: true, timestamp: parsed.t };
    }
  }
  return { ok: false, reason: "NO_SIGNATURE_MATCH" };
}

/**
 * Build a valid Stripe-Signature header for a given body + secret.
 * **Test-only** helper — the real sender is Stripe's server. Exported
 * so the test harness can exercise the verifier end-to-end.
 */
export function signStripeBody(
  rawBody: string,
  secret: string,
  timestamp: number
): string {
  const sig = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

interface ParsedHeader {
  t: number;
  v1: string[];
}

function parseSignatureHeader(header: string): ParsedHeader | null {
  let t: number | null = null;
  const v1: string[] = [];
  for (const raw of header.split(",")) {
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const k = raw.slice(0, eq).trim();
    const v = raw.slice(eq + 1).trim();
    if (k === "t") {
      const parsed = Number.parseInt(v, 10);
      if (!Number.isFinite(parsed)) return null;
      t = parsed;
    } else if (k === "v1") {
      v1.push(v);
    }
  }
  if (t === null) return null;
  return { t, v1 };
}
