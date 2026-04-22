/**
 * Shared HTTP-handler utilities for the subscription + feedback routes.
 *
 * Extracted from duplicate copies in `app/api/subscription/checkout/route.ts`,
 * `app/api/subscription/manage/route.ts`, and (unredacted) log lines in
 * `app/api/subscription/webhook/route.ts`. One source of truth means:
 *   - Email-validation rules don't drift between routes.
 *   - Log-redaction is applied uniformly (so support greps by `local***@domain`
 *     instead of full addresses in `logs/pipeline-debug.jsonl`).
 *   - Future validators (e.g. license-key format, country code) land here.
 *
 * Pure functions, zero I/O. Safe to import from any route handler.
 */

/**
 * RFC-5322-ish email validation. Not strict, not trying to parse IDN —
 * just catches obvious garbage before we hit Stripe or Resend with it.
 * Length ceiling matches the RFC-5321 max (254 chars total).
 */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/**
 * Redact the local part of an email for log output.
 *   alice@example.com → al***@example.com
 *   a@example.com     → a***@example.com
 *   (malformed)       → "***"
 *
 * Ops needs to correlate support tickets by *domain* + a hint of the local
 * part; we don't need full addresses in `logs/pipeline-debug.jsonl`. This
 * keeps GDPR-adjacent data minimization intact even on a US-only product.
 */
export function emailForLog(email: string): string {
  if (typeof email !== "string") return "***";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${domain}`;
}
