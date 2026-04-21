# Peanut Gallery — Terms of Service

> **⚠ DRAFT — not legal advice.** This document is a starting draft for Seth to review with counsel before publishing. It's calibrated for a small open-source-first consumer product with an optional paid tier. It is NOT a template you should copy into any other product without a lawyer's sign-off. Treat every claim and every carve-out as revisable.

**Last updated:** 2026-04-21 (draft)
**Effective:** _not yet effective_
**Contact:** `<TBD — a support email Seth owns>`

---

## 1. What Peanut Gallery is

Peanut Gallery is a Chrome extension (and the backend that supports it) that listens to audio in your current browser tab and overlays live reactions from four AI personas. It's maintained by Seth Rininger ("**we**", "**us**") as an open-source project available at [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery).

There are three ways to use Peanut Gallery:

- **Demo** — free 15-minute one-off trial on our shared API keys
- **My keys** — you provide your own API keys to providers (Deepgram, Anthropic, xAI, etc.); we charge you nothing
- **Peanut Gallery Plus** — $8/month subscription; we provide the API keys + meter a weekly usage cap (16 hours)

These Terms of Service ("**Terms**") cover all three. If you disagree with anything here, don't use the product.

## 2. Accounts and identity

We deliberately do **not** run a traditional account system. Peanut Gallery's privacy posture is "keys in your browser, not our database."

- **Demo mode** assigns a random "install ID" to your extension on first run, stored only in your browser. We don't know who you are.
- **My keys mode** sends your API keys per-request and we never store them.
- **Peanut Gallery Plus** requires an email address (to deliver and manage your subscription license key) and Stripe handles the billing identity. Your email and license key are stored on our server; nothing else about your identity is.

You're responsible for the accuracy of the email address you provide at signup. We'll send your license key and any management messages there.

## 3. The free trial (Demo mode)

New installations get 15 minutes of hosted transcription + persona reactions on our shared API keys, **one time, lifetime per install**. After that, you must provide your own API keys or subscribe to continue using hosted features. Clearing your browser data resets the install ID — we treat that as expected behavior and don't attempt to prevent it.

## 4. Peanut Gallery Plus (subscription)

**Price:** $8 per month, billed monthly, no long-term commitment.
**Cap:** 16 hours of transcription per rolling 7-day period, starting when your subscription begins.
**Auto-renewal:** yes, unless you cancel.

### 4.1 How the cap works

The 16-hour cap is a soft ceiling. When you reach 16 hours in a 7-day window, sessions stop starting until the oldest usage rolls off (one hour after one week has passed, etc.). We'll show a progress bar in the extension's settings drawer so you always know where you stand.

### 4.2 Your license key

When you subscribe, we'll email a license key (format: `pg-xxxx-xxxx-xxxx`) to the address on file. You paste it into the extension's Backend & keys drawer to activate Plus. You can:

- Use the same key on multiple devices (one paste per device).
- Request a fresh key if you lose yours, by emailing a recovery request from the drawer.
- Cancel your subscription at any time via the drawer's Manage button, which emails you a Stripe customer-portal link.

### 4.3 What subscription hours DO and DON'T consume

Subscription hours meter **only** when you use our hosted API keys for a session. If you have "My keys" filled in AND an active subscription, you can switch between them per-session via a sub-toggle; BYOK sessions never count against your cap.

### 4.4 Refunds

**Pro-rata refund on request, no questions asked**, for the current billing period. Email the address at the top of this doc. We'd rather refund you and have you happy than keep your money and have you annoyed.

### 4.5 Cancellation

Cancel anytime through the Stripe customer portal (linked from the drawer's Manage button). Your subscription remains active until the end of the current billing period; we don't pro-rate cancellations (but see §4.4). After the period ends, your license key stops authenticating; you can resubscribe anytime.

## 5. What Peanut Gallery is not

- **Not legal advice, medical advice, financial advice.** The personas are entertainment. Their fact-checks are real-time search snippets + model output; treat them like a friendly smart friend commenting alongside you, not a verified source.
- **Not a recording tool.** The extension streams audio to the backend for transcription and discards it. We do not save audio files, nor do we enable you to.
- **Not an account-backed product in the traditional sense.** You have no "account page." Your email + license key are the entire stored state of your relationship with us.
- **Not ad-supported.** We don't show ads. Ever. In the app, on the website, in the newsletter (we don't have one). If advertising enters the product, that changes the terms and requires a new version of these.

## 6. Your responsibilities

- Use the product for lawful purposes. Don't aim the personas at a stream of content that's itself illegal (e.g. attempts to bypass a platform's rights management, stalking someone's private broadcasts).
- Respect the content you're listening to. The reactions are for you; if you re-share them, attribute where attribution is warranted.
- Don't abuse the shared demo keys. Clearing your install ID to reset the trial is fine (we designed for it); scripted enumeration to mint infinite trials is not.
- Don't attempt to reverse-engineer Stripe's or our webhooks to issue yourself a subscription without paying. The product is open-source; running your own backend is the legitimate free path.
- Don't redistribute your license key. One-person-per-subscription. We reserve the right to revoke keys that are clearly shared beyond a reasonable personal use (e.g. shared on a public site).

## 7. Our responsibilities

- We try to keep the hosted backend running. We don't promise 100% uptime; there is no SLA.
- We try to keep the underlying model quality at a certain bar. If a provider changes pricing or quality dramatically, we'll update the product + notify subscribers via their signup email.
- We honor the privacy posture stated in our [Privacy Policy](PRIVACY-POLICY.md). If that ever changes, subscribers get at least 30 days' notice before the change takes effect, and can cancel + refund the current period.
- We don't sell, lease, or share your data with third parties. See the Privacy Policy for detail.

## 8. Intellectual property

- **Code:** Peanut Gallery's source code is licensed under [MIT](../../LICENSE). You can read it, fork it, run it yourself.
- **Personas:** The AI personas are **inspired by** public figures (Howard Stern staff, This Week in Startups co-hosts). We don't claim ownership of those inspirations, and we explicitly say so in-product. The personas' *system prompts* are original text authored by the project.
- **Your reactions:** The text the personas produce when reacting to your session is yours to use. If it quotes a specific person or copyrighted source, normal fair-use rules apply — we don't take any ownership of the output.

## 9. Third-party services

Peanut Gallery depends on external APIs. Their outages are our outages:

- **Deepgram** (transcription)
- **Anthropic** (Claude Haiku for Director + personas)
- **xAI** (Grok for troll + sound FX)
- **Brave Search** or **xAI Live Search** (fact-check queries)
- **Stripe** (payments, subscription management — Plus subscribers only)
- **Railway** (hosting for the backend — changes if we move infra)

We negotiate none of these providers' own terms on your behalf. When a provider changes their rules, our usage is subject to those changes.

## 10. Changes to these Terms

We can update these Terms. For material changes to subscription mechanics (price, cap, billing cadence), we'll email active subscribers at least 30 days before the change and allow cancellation with a pro-rata refund. For non-material changes (clarifications, typo fixes), the change is effective on publication at the updated "Last updated" date.

## 11. Liability

Peanut Gallery is provided "as is." To the extent permitted by law, we disclaim all warranties and limit our aggregate liability to the amount you've paid us in the 12 months preceding the event giving rise to the claim. Free-tier users: this is $0.

## 12. Governing law and disputes

**<TBD — Seth's jurisdiction.>** Seth picks the governing law + dispute resolution venue. Typical choice for a US-based small product: the state you're incorporated in (or resident in, if you're a sole proprietor), with arbitration for disputes above $X and small-claims court for anything below.

## 13. Contact

Questions, cancellation requests, security reports, or "I found a bug in the Terms" notes: `<TBD — support email>`.

Security reports: also see [`SECURITY.md`](../../.github/SECURITY.md).

---

*End of draft. See the pairing [Privacy Policy](PRIVACY-POLICY.md) for data-handling specifics.*
