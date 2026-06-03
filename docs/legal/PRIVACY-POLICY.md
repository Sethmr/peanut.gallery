# Peanut Gallery — Privacy Policy

> **⚠ DRAFT — not legal advice.** This document is a starting draft for Seth to review with counsel before relying on it. It's calibrated for a small, free, open-source consumer product with a privacy-first posture. It is NOT a template you should copy into any other product without a lawyer's sign-off.

**Last updated:** 2026-06-03 (draft)
**Effective:** _not yet effective_
**Contact:** `<TBD — a support email Seth owns>`

---

## TL;DR

- **Your audio never goes anywhere except the transcription provider.** We stream it through; nobody records it — not us, not the provider (by contract).
- **Your transcript is not stored on our server.** It exists in-memory for the duration of your session, then it's gone.
- **Your API keys (if you provide them) are forwarded per-request and never written to our disk.**
- **No accounts, no email, no payments.** Peanut Gallery is free; we don't ask who you are.
- **No ads. No data sale. No third-party analytics. No ML training on your data.** Ever.
- **The only long-term server-side data** is anonymized feedback snippets (the lines you upvote / downvote / pin) and short-lived operational logs — neither tied to your identity.

If you prefer zero server-side state entirely, use "My keys" mode or self-host — both give you a zero-storage experience.

---

## 1. Who we are

Peanut Gallery is maintained by Seth Rininger ("**we**", "**us**"), sole proprietor of the project at [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery).

## 2. What the extension does on your device

- **Captures audio** from the current browser tab via `chrome.tabCapture` when you click Start Listening.
- **Streams that audio** to a backend (ours at peanutgallery.live by default, or whichever URL you configure) as 16 kHz PCM for live transcription.
- **Stores settings locally** via `chrome.storage.local`: your chosen pack, theme, mute state per persona, response-rate dial, backend URL, API keys (if provided), a license key (if you have one), install ID, pinned favorite quips, upvotes/downvotes on individual responses, sensitivity dial.

**Nothing in `chrome.storage.local` leaves your browser unless you trigger it.** For example, upvotes/downvotes are sent to our backend as anonymized telemetry — but the storage itself is local.

## 3. What the backend receives and keeps

### Audio (all modes)

- **Received** as a continuous PCM stream while a session is live.
- **Forwarded** to the transcription provider (Deepgram by default, or whichever provider your configured key maps to).
- **Not recorded** on our server. The audio flows through in-memory buffers and is discarded.

### Transcript (all modes)

- **Produced** by the transcription provider, returned to us as text.
- **Held** in-memory during your session for the Director to route persona reactions.
- **Discarded** when the session ends. We do not write transcripts to disk.
- **Exception:** individual reaction snippets you upvote, downvote, pin, or generate a quote card from are sent to our feedback endpoint (`/api/feedback`) along with the transcript tail that informed that reaction. See §5.

### API keys (My keys mode)

- **Received** per-request as HTTP headers (`X-Deepgram-Key`, `X-Anthropic-Key`, `X-xAI-Key`).
- **Forwarded** to the respective providers.
- **Not logged, not stored, not persisted** in any form server-side. We log request IDs and persona IDs; we redact keys from all log output.

### Install ID (Demo mode)

- **Received** as the `X-Install-Id` header from every request.
- **Used** to meter the free 15-minute trial per installation.
- **Held** in memory on the hosted backend for the duration of the server process. Resets on redeploy.
- **Not correlated** with any personal identifier. We can't turn your install ID into your email or IP address — it's just a random UUID.

## 4. Why we store the small amount we do store

### Feedback signals (upvote / downvote / pin / quote-card)

When you upvote, downvote, pin, or generate a quote card from a persona reaction, we log that action server-side along with the persona, the reaction text, and the transcript tail that informed it. This is used to:

1. Improve the personas' prompts over time (what lines do users actually like?)
2. Improve the Director's routing (was the right persona picked for the moment?)
3. Pick highlights when you review a past session (the "best of this episode" feature)

We do **not** tie this feedback to any identifier that would let us trace a vote back to a specific person — the log carries the install ID and session ID at most, and we collect no email or account. If you prefer to opt out entirely, self-hosters can set `DISABLE_FEEDBACK_LOGGING=true` on their backend.

## 5. What we explicitly don't do

- **No accounts, no email, no payments.** We don't run a login, don't collect an email address, and don't process payments — there is nothing to buy.
- **No advertising.** The product does not show ads, and we do not build ad-targeting profiles.
- **No data sale or rent.** We do not sell, rent, or barter user data in any form.
- **No third-party analytics.** No Google Analytics, no Mixpanel, no Amplitude. The backend logs operational telemetry (response times, error rates, structured debug events) to its own disk; those logs are never shared externally.
- **No cross-context tracking.** The extension does not track you across tabs, sites, or sessions except via the install ID (needed for the free-tier limit).
- **No audio recording.** At no point is your audio persisted on our server.
- **No transcript storage.** Beyond the session lifetime and the feedback-logged snippets described in §4, transcripts are not kept.
- **No ML training on your data.** We do not train any model on your transcripts, reactions, voice, or feedback signals. If that ever changed, it would require a new version of this policy with notice and an explicit opt-in.

## 6. Data retention summary

| Data | Retention | Where |
|---|---|---|
| Audio | In-memory during session | Backend RAM |
| Transcript (live) | In-memory during session | Backend RAM |
| Transcript snippets (voted / pinned / quote-carded) | 90 days | Pipeline log (on the Railway instance) |
| API keys (BYOK) | Never stored | — |
| Install ID | Process lifetime (resets on redeploy) | Backend RAM |
| Operational logs (request IDs, errors, timings) | 30 days | Backend disk |

## 7. Cookies and tracking technology

The extension uses `chrome.storage.local` (which Chrome implements via IndexedDB on your disk). This is local to your browser and not a cookie. The backend does not set cookies or tracking beacons; it's a stateless API behind a session ID.

## 8. Your rights

Wherever you live, you have the right to **know** what we store about you (see §3), **object** to the feedback logging in §4 (we'll exclude your install ID from future logging on request), and ask us to **delete** any feedback snippets associated with your install/session IDs. Because we collect no email or account, there is no profile to access, port, or correct.

GDPR and CCPA specifics: **<TBD — Seth to confirm with counsel whether this product's size triggers specific compliance obligations.>** The product is small and collects no personal identifiers, but "believe" is not "know." Legal review recommended.

## 9. Children

Peanut Gallery is not directed at children under 13, and we don't knowingly collect data from them. Because we collect no personal data, there is nothing to delete on a child's behalf, but if you have a concern, email us.

## 10. International data transfers

The Railway backend is hosted in the United States (currently us-west2). If you're outside the US and use the hosted tier, your audio + transcript pass through US-based infrastructure transiently and are not retained. If that isn't acceptable for your situation, use "My keys" mode or self-host in your preferred region.

## 11. Security

- HTTPS for all backend traffic.
- API keys never in URLs or referrer headers; redacted from all logs.
- We rotate the hosted backend's shared demo keys at least quarterly or sooner if compromised.

No system is perfectly secure. If you spot a security issue, please report it via [SECURITY.md](../../.github/SECURITY.md) — not a public GitHub issue.

## 12. Changes to this policy

We can update this policy. Changes are effective on publication at the updated "Last updated" date. If we ever introduce a material new data flow (for example, accounts or a paid tier — not currently offered), we'll describe it here before it takes effect.

## 13. Contact

Questions, data requests, privacy complaints, "I spotted an error in this policy" notes: `<TBD — support email>`.

---

*End of draft. See the [Terms of Service](TERMS-OF-SERVICE.md) for the product's usage terms.*
