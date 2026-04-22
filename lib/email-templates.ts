/**
 * Email body templates — Peanut Gallery Plus.
 *
 * Pure functions: input → `{ subject, html, text }`. No side effects,
 * no env reads, no provider knowledge. The transport in `email.ts`
 * handles delivery; this file only shapes copy.
 *
 * DESIGN NOTES
 * ────────────
 * 1. **Both HTML + plain-text bodies in every send.** Most modern
 *    clients render the HTML; some users / corporate gateways /
 *    accessibility tools fall back to text. Keeping both means the
 *    license key is reachable regardless of rendering mode.
 *
 * 2. **All interpolated values are HTML-escaped.** Even though the
 *    inputs flow from server-trusted state (Stripe webhook payload
 *    after signature verification, or our own subscription store),
 *    template injection is a cheap class of bug to eliminate
 *    permanently — the cost of `escapeHtml()` is microseconds.
 *
 * 3. **No external assets.** No `<img>` tags, no remote CSS, no
 *    web fonts. Inline styles only. Reasons:
 *      - Some clients block remote content by default; the email
 *        looks broken before the user even decides to trust us.
 *      - A remote asset is a tracking pixel surrogate. We don't
 *        track email opens on transactional mail — it's tacky and
 *        the deliverability gain is marginal.
 *      - One less moving part to break when we move the marketing
 *        site CDN around.
 *
 * 4. **Subject lines are descriptive, not clever.** Users searching
 *    their inbox 6 months from now should find these by typing
 *    "peanut gallery license" — the literal string is in every
 *    subject for that reason.
 *
 * 5. **Voice: warm + plain.** Same tone as the rest of the
 *    Peanut Gallery surface. No emoji in subjects (some corporate
 *    mail filters score them as spam). One emoji-free greeting,
 *    one CTA, one sign-off.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface WelcomeArgs {
  email: string;
  licenseKey: string;
}

interface RecoveryArgs {
  email: string;
  licenseKey: string;
}

interface CancellationArgs {
  email: string;
}

interface MagicLinkArgs {
  email: string;
  portalUrl: string;
  intent: "manage" | "cancel" | "billing";
}

const SUPPORT_EMAIL = "support@peanutgallery.live";
const PRODUCT_NAME = "Peanut Gallery Plus";

// ── WELCOME — sent on checkout.session.completed (Phase 3 webhook) ──────

export function renderWelcomeEmail(args: WelcomeArgs): RenderedEmail {
  const subject = `Welcome to ${PRODUCT_NAME} — here's your license key`;

  const html = baseHtml({
    title: subject,
    body: `
      <p>Thanks for subscribing to ${esc(PRODUCT_NAME)}. Your license key is below — paste it once into the extension and you're set.</p>
      ${keyBlock(args.licenseKey)}
      <h3 style="${H3}">How to use it</h3>
      <ol style="${OL}">
        <li>Open the Peanut Gallery side panel on any YouTube tab.</li>
        <li>Click the settings gear (⚙) in the top corner.</li>
        <li>Under <strong>Backend &amp; keys</strong>, switch the segmented control to <strong>Plus</strong>.</li>
        <li>Paste the license key into the <em>Subscription key</em> field. The extension remembers it on this device.</li>
      </ol>
      <p>You're on 16 hours of transcription per week. The drawer's progress bar shows what's left and when it resets.</p>
      <p>If you ever lose this key, click <strong>Email me my key</strong> in the same drawer and we'll re-send it to ${esc(args.email)}.</p>
      ${supportFooter()}
    `,
  });

  const text = [
    `Welcome to ${PRODUCT_NAME}!`,
    ``,
    `Your license key:`,
    args.licenseKey,
    ``,
    `How to use it:`,
    `  1. Open the Peanut Gallery side panel on any YouTube tab.`,
    `  2. Click the settings gear in the top corner.`,
    `  3. Under "Backend & keys", switch to "Plus".`,
    `  4. Paste the license key into the "Subscription key" field.`,
    ``,
    `You're on 16 hours of transcription per week. The drawer's progress`,
    `bar shows what's left and when it resets.`,
    ``,
    `If you ever lose this key, click "Email me my key" in the same`,
    `drawer and we'll re-send it to ${args.email}.`,
    ``,
    `Questions or trouble? Reply to this email or write ${SUPPORT_EMAIL}.`,
    `— Peanut Gallery`,
  ].join("\n");

  return { subject, html, text };
}

// ── RECOVERY — sent on /api/subscription/manage action=recover_key ──────

export function renderRecoveryEmail(args: RecoveryArgs): RenderedEmail {
  const subject = `Your ${PRODUCT_NAME} license key`;

  const html = baseHtml({
    title: subject,
    body: `
      <p>You asked us to re-send the license key on file for ${esc(args.email)}. Here it is — paste it back into the extension and you're good to go.</p>
      ${keyBlock(args.licenseKey)}
      <p>If you didn't request this email, you can safely ignore it. Your key is still active and nothing has changed on your subscription.</p>
      <h3 style="${H3}">Where to paste it</h3>
      <ol style="${OL}">
        <li>Open the Peanut Gallery side panel.</li>
        <li>Settings gear (⚙) → <strong>Backend &amp; keys</strong> → <strong>Plus</strong>.</li>
        <li>Paste the key into the <em>Subscription key</em> field.</li>
      </ol>
      ${supportFooter()}
    `,
  });

  const text = [
    `Your ${PRODUCT_NAME} license key:`,
    args.licenseKey,
    ``,
    `You asked us to re-send the license key on file for ${args.email}.`,
    `Paste it back into the extension and you're good to go:`,
    ``,
    `  1. Open the Peanut Gallery side panel.`,
    `  2. Settings gear → "Backend & keys" → "Plus".`,
    `  3. Paste the key into the "Subscription key" field.`,
    ``,
    `If you didn't request this email, you can safely ignore it. Your`,
    `key is still active and nothing has changed on your subscription.`,
    ``,
    `Questions? Reply to this email or write ${SUPPORT_EMAIL}.`,
    `— Peanut Gallery`,
  ].join("\n");

  return { subject, html, text };
}

// ── CANCELLATION — sent on customer.subscription.deleted webhook ────────

export function renderCancellationEmail(
  args: CancellationArgs
): RenderedEmail {
  const subject = `Your ${PRODUCT_NAME} subscription is cancelled`;

  const html = baseHtml({
    title: subject,
    body: `
      <p>Your ${esc(PRODUCT_NAME)} subscription on ${esc(args.email)} has been cancelled. The license key tied to this account is no longer active.</p>
      <p>You won't be billed again. Any unused weekly hours stop counting from today.</p>
      <p>The extension itself keeps working — you can paste your own API keys (Deepgram, Anthropic, xAI) into the Backend &amp; keys drawer to keep using Peanut Gallery on your own account, or come back any time and resubscribe.</p>
      <p>If you cancelled by mistake, just reply to this email and we'll get you sorted.</p>
      ${supportFooter()}
    `,
  });

  const text = [
    `Your ${PRODUCT_NAME} subscription is cancelled.`,
    ``,
    `Your subscription on ${args.email} has been cancelled. The license`,
    `key tied to this account is no longer active.`,
    ``,
    `You won't be billed again. Any unused weekly hours stop counting`,
    `from today.`,
    ``,
    `The extension itself keeps working — paste your own API keys`,
    `(Deepgram, Anthropic, xAI) into Backend & keys, or come back any`,
    `time and resubscribe.`,
    ``,
    `Cancelled by mistake? Reply to this email and we'll sort it out.`,
    `— Peanut Gallery`,
  ].join("\n");

  return { subject, html, text };
}

// ── MAGIC LINK — Stripe Customer Portal URL for manage / cancel / billing

export function renderMagicLinkEmail(args: MagicLinkArgs): RenderedEmail {
  const subject =
    args.intent === "cancel"
      ? `Cancel your ${PRODUCT_NAME} subscription`
      : args.intent === "billing"
        ? `Update your ${PRODUCT_NAME} billing details`
        : `Manage your ${PRODUCT_NAME} subscription`;

  const intro =
    args.intent === "cancel"
      ? `You asked to cancel your ${esc(PRODUCT_NAME)} subscription. Open the secure link below to confirm — it takes a few seconds and goes through Stripe's hosted Customer Portal (we never see your card details).`
      : args.intent === "billing"
        ? `You asked to update billing details on your ${esc(PRODUCT_NAME)} subscription. The secure link below opens Stripe's hosted Customer Portal where you can change card on file, billing address, and similar — we never see your card details.`
        : `Use the secure link below to manage your ${esc(PRODUCT_NAME)} subscription. It opens Stripe's hosted Customer Portal where you can update billing, view invoices, or cancel — we never see your card details.`;

  const html = baseHtml({
    title: subject,
    body: `
      <p>${intro}</p>
      <p style="margin: 24px 0;">
        <a href="${esc(args.portalUrl)}" style="${BUTTON}">Open the Customer Portal</a>
      </p>
      <p style="font-size: 13px; color: #555;">If the button doesn't work, copy and paste this address into your browser:<br>
        <span style="word-break: break-all; font-family: monospace;">${esc(args.portalUrl)}</span>
      </p>
      <p style="font-size: 13px; color: #555;">This link expires after one use. Request a fresh one any time from <strong>Manage subscription</strong> in the extension drawer.</p>
      ${supportFooter()}
    `,
  });

  const text = [
    intro.replace(/<[^>]+>/g, ""),
    ``,
    `Open this link in your browser:`,
    args.portalUrl,
    ``,
    `This link expires after one use. Request a fresh one any time from`,
    `"Manage subscription" in the extension drawer.`,
    ``,
    `Questions? Reply to this email or write ${SUPPORT_EMAIL}.`,
    `— Peanut Gallery`,
  ].join("\n");

  return { subject, html, text };
}

// ── SHARED CHROME ───────────────────────────────────────────────────────

const H3 = "font-size: 16px; margin: 24px 0 8px; color: #111;";
const OL =
  "padding-left: 22px; margin: 0 0 16px; line-height: 1.55;";
const BUTTON =
  "display: inline-block; padding: 12px 22px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;";

function keyBlock(key: string): string {
  return `
    <p style="margin: 18px 0;">
      <code style="display: inline-block; padding: 12px 16px; background: #f4f1ea; border: 1px solid #d8d2c2; border-radius: 6px; font-size: 18px; letter-spacing: 0.5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">${esc(key)}</code>
    </p>
  `;
}

function supportFooter(): string {
  return `
    <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0 16px;">
    <p style="font-size: 13px; color: #555; line-height: 1.5;">
      Questions or trouble? Reply to this email or write
      <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color: #111;">${esc(SUPPORT_EMAIL)}</a>.<br>
      — Peanut Gallery
    </p>
  `;
}

function baseHtml(opts: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
</head>
<body style="margin: 0; padding: 0; background: #f7f5ef; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #111; line-height: 1.55;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f7f5ef;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width: 560px; background: #fff; border: 1px solid #e6e1d2; border-radius: 8px;">
          <tr>
            <td style="padding: 28px 32px;">
              <h1 style="margin: 0 0 16px; font-size: 22px; color: #111;">Peanut Gallery</h1>
              ${opts.body}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Minimal HTML escape covering the five-character set that has
 * actual HTML-injection meaning. Email clients are forgiving on
 * everything else; we don't need a full library here.
 */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
