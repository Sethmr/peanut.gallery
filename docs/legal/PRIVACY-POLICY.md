# Peanut Gallery — Privacy Policy

> **⚠ DRAFT — not legal advice.** This document is a starting draft for Seth to review with counsel before publishing. It's calibrated for a small open-source consumer product with a privacy-first posture. It is NOT a template you should copy into any other product without a lawyer's sign-off.

**Last updated:** 2026-04-21 (draft)
**Effective:** _not yet effective_
**Contact:** `<TBD — a support email Seth owns>`

---

## TL;DR

- **Your audio never goes anywhere except the transcription provider.** We stream it through; nobody records it — not us, not the provider (by contract).
- **Your transcript is not stored on our server.** It exists in-memory for the duration of your session, then it's gone.
- **Your API keys (if you provide them) are forwarded per-request and never written to our disk.**
- **No ads. No data sale. No third-party analytics.** Ever.
- **The only thing we store long-term about you** (and only if you subscribe to Peanut Gallery Plus): your email address, your license key, and a weekly usage counter measured in milliseconds. That's it.

If you prefer zero server-side state entirely, use "My keys" mode or self-host — both give you a zero-storage experience.

---

## 1. Who we are

Peanut Gallery is maintained by Seth Rininger ("**we**", "**us**"), sole proprietor of the project at [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery).

## 2. What the extension does on your device

- **Captures audio** from the current browser tab via `chrome.tabCapture` when you click Start Listening.
- **Streams that audio** to a backend (ours at peanutgallery.live by default, or whichever URL you configure) as 16 kHz PCM for live transcription.
- **Stores settings locally** via `chrome.storage.local`: your chosen pack, which theme you prefer, mute state per persona, response-rate dial, backend URL, API keys (if provided), subscription license key (if you subscribed), install ID, pinned favorite quips, upvotes/downvotes on individual responses, sensitivity dial.

**Nothing in `chrome.storage.local` leaves your browser unless you trigger it.** For example, upvotes/downvotes are sent to our backend as telemetry, and your subscription license key is sent with every hosted-mode request — but the storage itself is local.

## 3. What the backend receives and keeps

### Audio (all modes)

- **Received** as a continuous PCM stream while a session is live.
- **Forwarded** to the transcription provider (Deepgram by default, or whichever provider your configured key maps to).
- **Not recorded** on our server. The audio flows through in-memory buffers and is discarded.

### Transcript (all modes)

- **Produced** by the transcription provider, returned to us as text.
- **Held** in-memory during your session for the Director to route persona reactions.
- **Discarded** when the session ends. We do not write transcripts to disk.
- **Exception:** individual reaction snippets you upvote, downvote, pin, or generate a quote card from are sent to our feedback endpoint (`/api/feedback`) along with the transcript tail that informed that reaction. See §5 below for why.

### API keys (My keys mode)

- **Received** per-request as HTTP headers (`X-Deepgram-Key`, `X-Anthropic-Key`, `X-xAI-Key`, `X-Brave-Key`).
- **Forwarded** to the respective providers.
- **Not logged, not stored, not persisted** in any form server-side. We log request IDs and persona IDs; we redact keys from all log output.

### Install ID (Demo mode)

- **Received** as the `X-Install-Id` header from every request.
- **Used** to meter the free 15-minute trial per installation.
- **Held** in memory on the hosted backend for the duration of the server process. Resets on redeploy.
- **Not correlated** with any personal identifier. We can't turn your install ID into your email or IP address — it's just a random UUID.

### Email address and license key (Plus mode only)

- **Received** at signup via Stripe's hosted checkout, plus whenever you request key recovery or subscription management.
- **Stored** on our backend database alongside your Stripe subscription ID and the timestamps of subscription events (created, cancelled).
- **Used** to (1) validate your license key when you start a session and (2) deliver key-recovery and subscription-management emails.
- **Retained** as long as your subscription is active, plus 12 months for refund-eligibility and financial-records purposes. After that, email and key are purged.

### Weekly usage counter (Plus mode only)

- **Computed** as milliseconds of hosted transcription per 7-day rolling window, keyed on license key.
- **Used** to enforce the 16-hour weekly cap and render the progress bar in your drawer.
- **Retained** per-week for 30 days for cap enforcement and user-support ("did I really use that much?"). Rolled off after 30 days.

## 4. Payment processing (Plus mode only)

Stripe handles all payments. We never see or store your credit card or banking details. Stripe's data practices: [https://stripe.com/privacy](https://stripe.com/privacy).

## 5. Why we store the small amount we do store

### Email + license key

Without these, we can't send you the key you're paying for, can't help you recover a lost key, can't verify you're the owner of a subscription you're trying to cancel. This is the minimum data needed to run a subscription-based service.

### Weekly usage counter

Without this, we can't enforce the 16-hour cap or show you the progress bar. It's used-ms, not content.

### Feedback signals (upvote / downvote / pin / quote-card)

When you upvote, downvote, pin, or generate a quote card from a persona reaction, we log that action server-side along with the persona, the reaction text, and the transcript tail that informed that reaction. This is used to:

1. Improve the personas' prompts over time (what lines do users actually like?)
2. Improve the Director's routing (was the right persona picked for the moment?)
3. Pick highlights when you review a past session (the "best of this episode" feature)

We do **not** tie this feedback to your email, your subscription key, or any other identifier that would let us trace a vote back to a specific person. The log carries the install ID and session ID at most. If you prefer to opt out entirely, self-hosters can set `DISABLE_FEEDBACK_LOGGING=true` on their backend. We don't currently offer a user-facing opt-out toggle but intend to add one before the first paid launch.

## 6. What we explicitly don't do

- **No advertising.** The product does not show ads, and we do not build ad-targeting profiles.
- **No data sale or rent.** We do not sell, rent, or barter user data in any form.
- **No third-party analytics.** No Google Analytics, no Mixpanel, no Amplitude. The backend logs operational telemetry (response times, error rates, structured debug events for ops) to its own disk; those logs are never shared externally.
- **No cross-context tracking.** The extension does not track you across tabs, sites, or sessions except via the install ID (needed for the free-tier limit) and your subscription key (needed to authenticate Plus sessions).
- **No audio recording.** At no point is your audio persisted on our server.
- **No transcript storage.** Beyond the session lifetime and the feedback-logged snippets described in §5, transcripts are not kept.
- **No ML training on your data.** We do not train any model on your transcripts, reactions, voice, or feedback signals. If that ever changes, the change would require a new version of this policy with 30 days' notice to Plus subscribers + an explicit opt-in.

## 7. Data retention summary

| Data | Retention | Where |
|---|---|---|
| Audio | In-memory during session | Backend RAM |
| Transcript (live) | In-memory during session | Backend RAM |
| Transcript snippets (voted / pinned / quote-carded) | 90 days | Pipeline log (on the Railway instance) |
| API keys (BYOK) | Never stored | — |
| Install ID | Process lifetime (resets on redeploy) | Backend RAM |
| Email + license key (Plus) | Subscription lifetime + 12 months | Backend database |
| Weekly usage counter (Plus) | 30 days | Backend database |
| Operational logs (request IDs, errors, timings) | 30 days | Backend disk |
| Payment records (via Stripe) | Per Stripe's policy | Stripe |

## 8. Cookies and tracking technology

The extension uses `chrome.storage.local` (which Chrome implements via IndexedDB on your disk). This is local to your browser and not a cookie. The backend does not set cookies or tracking beacons; it's a stateless API behind a session ID.

## 9. Your rights

Wherever you live, you have the right to:

- **Know** what we store about you. See §3 above; if anything's missing, ask at the contact address and we'll correct this document.
- **Access** your data. Email us and we'll send you whatever is stored for your email address (which is always: email, license key, subscription status, last 30 days of usage counters).
- **Delete** your data. Cancelling your subscription triggers deletion after the 12-month retention window described in §3. You can also ask us to delete earlier; we'll comply.
- **Port** your data. The data stored is trivially exportable as JSON; ask and we'll send.
- **Object** to processing. Users in jurisdictions with GDPR-style rights can object to any processing described in §5 (feedback logging). We'll honor the objection and exclude your install ID from future feedback logging.

GDPR and CCPA specifics: **<TBD — Seth to confirm with counsel whether this product's size triggers specific compliance obligations.>** The product is small enough that we believe we fall below most regulatory thresholds, but "believe" is not "know." Legal review before the first paid launch.

## 10. Children

Peanut Gallery is not directed at children under 13. We don't knowingly collect data from children under 13. If you're a parent and believe a child under 13 has subscribed, email us and we'll refund + delete.

## 11. International data transfers

The Railway backend is hosted in the United States (currently us-west2). If you're outside the US and you use the hosted tier, your audio + transcript pass through US-based infrastructure transiently. Your email and license key, if you subscribe, are stored on the US-hosted database. By subscribing, you consent to this transfer.

If this transfer isn't acceptable for your situation, use "My keys" mode or self-host in your preferred region.

## 12. Security

- HTTPS for all backend traffic.
- API keys and subscription keys never in URLs or referrer headers.
- Stripe handles all payment data; we never see a credit card number.
- License keys are stored in a database encrypted at rest at Phase 2 (SQLCIPHER or application-level AES-GCM — method pinned at Phase-2 ship time).
- We rotate the hosted backend's shared demo keys at least quarterly or sooner if compromised.

No system is perfectly secure. If you spot a security issue, please report it via [SECURITY.md](../../.github/SECURITY.md) — not a public GitHub issue.

## 13. Changes to this policy

We can update this policy. For material changes affecting Plus subscribers (scope of data collected, retention durations, third-party sharing), we'll email active subscribers at least 30 days before the change and allow cancellation with a pro-rata refund. For non-material changes (clarifications, typo fixes), the change is effective on publication at the updated "Last updated" date.

## 14. Contact

Questions, data requests, privacy complaints, "I spotted an error in this policy" notes: `<TBD — support email>`.

---

*End of draft. See the [Terms of Service](TERMS-OF-SERVICE.md) for the product's usage terms.*
