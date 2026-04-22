/**
 * Peanut Gallery Plus — license-key generator + format validator.
 *
 * KEY SHAPE
 * ─────────
 * `pg-xxxx-xxxx-xxxx`
 *
 * - Fixed `pg-` prefix identifies the product at a glance (so a user
 *   who pastes one into the wrong field gets a clear error instead of
 *   a cryptic 401).
 * - 12 lowercase hex characters, split into 3 groups of 4 by dashes.
 *   The leading 11 are cryptographically random (via Node `crypto`);
 *   the final char is a mod-16 Luhn-style checksum over the other 11.
 *
 * CHECKSUM
 * ────────
 * A single check character catches the common typo classes for a key
 * a user might be typing from a printed email — single-char
 * substitution, single-char insertion or deletion (partially), and
 * adjacent-digit transposition. It is NOT a security primitive; an
 * attacker can always recompute a valid checksum given the other 11
 * chars. The security property comes from the 11 chars being 44 bits
 * of entropy (16^11 ≈ 1.76 × 10¹³ unique keys).
 *
 * Algorithm:
 *   1. Parse each of the 11 hex chars to its 0–15 numeric value.
 *   2. For positions counted from the RIGHT (position 1 = rightmost
 *      of the 11), double the values at odd positions (1, 3, 5, …);
 *      leave even positions alone.
 *   3. If any doubled value exceeds 15, subtract 15.
 *   4. Sum all 11 resulting values.
 *   5. Checksum = (16 − (sum mod 16)) mod 16, encoded as a hex char.
 *
 * This is a straight 16-adic transliteration of the Luhn-10
 * algorithm used on credit-card numbers.
 */

import { randomBytes } from "crypto";

const HEX_CHARS = "0123456789abcdef";
const KEY_REGEX = /^pg-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/;

/**
 * Generate a fresh license key. Returns the canonical
 * `pg-xxxx-xxxx-xxxx` string; guaranteed to pass
 * {@link isValidLicenseKey} on its own output.
 */
export function generateLicenseKey(): string {
  const buf = randomBytes(6); // 48 bits, we use 44 (11 hex chars)
  let body = "";
  // First 11 hex chars from the random bytes
  for (let i = 0; i < 11; i++) {
    const nibble = i % 2 === 0 ? buf[i >> 1] >> 4 : buf[i >> 1] & 0xf;
    body += HEX_CHARS[nibble];
  }
  const checksum = luhnHexChecksum(body);
  const full = body + checksum;
  return `pg-${full.slice(0, 4)}-${full.slice(4, 8)}-${full.slice(8, 12)}`;
}

/**
 * True iff `key` matches the canonical format AND has a valid
 * checksum. Use this at the boundary of every subscription API that
 * accepts a user-entered key (checkout, webhook, status, manage);
 * cheap regex + checksum are a ~100× speedup over hitting the DB
 * for a malformed key.
 */
export function isValidLicenseKey(key: string): boolean {
  if (typeof key !== "string" || !KEY_REGEX.test(key)) return false;
  const body = key.slice(3).replace(/-/g, ""); // strip `pg-` + dashes → 12 hex
  if (body.length !== 12) return false;
  const payload = body.slice(0, 11);
  const provided = body.slice(11, 12);
  return luhnHexChecksum(payload) === provided;
}

/**
 * Mod-16 Luhn-style checksum over an 11-char lowercase hex string.
 * Returns a single lowercase hex character.
 *
 * Exported for the tests; callers outside the module should use
 * {@link generateLicenseKey} or {@link isValidLicenseKey}.
 */
export function luhnHexChecksum(body: string): string {
  if (body.length !== 11) {
    throw new Error(
      `luhnHexChecksum expects 11 hex chars; got ${body.length}`
    );
  }
  let sum = 0;
  // Walk right-to-left so position=1 is the rightmost of the 11.
  for (let i = 0; i < 11; i++) {
    const ch = body[10 - i];
    const val = parseInt(ch, 16);
    if (Number.isNaN(val)) {
      throw new Error(`invalid hex char in key body: ${ch}`);
    }
    const position = i + 1; // 1-indexed from the right
    let contribution = val;
    if (position % 2 === 1) {
      contribution = val * 2;
      if (contribution > 15) contribution -= 15;
    }
    sum += contribution;
  }
  const check = (16 - (sum % 16)) % 16;
  return HEX_CHARS[check];
}
