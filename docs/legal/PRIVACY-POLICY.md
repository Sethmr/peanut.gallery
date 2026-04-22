# Peanut Gallery — Privacy Policy

> **⚠ DRAFT — not legal advice.** This document is a working draft for Seth to review with counsel before publishing. It is calibrated for a small, open-source-first consumer Chrome extension with an optional paid tier. It is NOT a template you should copy into any other product without your own lawyer's sign-off.

> **Where bracketed placeholders (`<TBD …>`) appear**, they mark decisions that require Seth or counsel to confirm before publication (see the [Lawyer review checklist](#lawyer-review-checklist) at the end).

**Last updated:** 2026-04-21 (draft v2 — full rewrite for v2.0 launch)
**Effective:** _not yet effective_
**Contact:** `privacy@peanutgallery.live` _(TBD — confirm Seth has provisioned this alias)_
**Companion document:** [Terms of Service](TERMS-OF-SERVICE.md). These two documents read together.

---

## TL;DR

- **Your audio is streamed through a transcription provider in real time and discarded.** We never write an audio file. The provider never records it (by contract).
- **Your live transcript exists in server memory for the duration of your session and is not persisted.** Snippets you actively upvote, downvote, pin, or quote-card are logged server-side for product improvement; see §5.
- **Your API keys (My-Keys Mode) are forwarded per-request and never written to our disk.**
- **No advertising. No data sale. No third-party analytics in the Extension.** Ever.
- **The Marketing Site at `www.peanutgallery.live` uses Google Analytics** for aggregate page-view metrics. That is the only third-party analytics in any part of the Service, and it is limited to the public website — not the Extension, not the Hosted Backend beyond its own operational logs.
- **The only data we store long-term** about a paying user is: your email, your Peanut Gallery Plus license key, your Stripe subscription identifier, and a weekly usage counter measured in milliseconds. That is all.
- **Recording-consent laws are your responsibility.** The Extension can be pointed at any audio you grant access to. Many U.S. states (and nearly all of Europe) require all-party consent to record private conversations. See [Terms of Service §5.1](TERMS-OF-SERVICE.md#51-audio-capture-and-recording-consent-laws).

If you prefer zero server-side state: use **My-Keys Mode** (no Peanut Gallery identity stored) or **self-host** the backend (no data leaves your control).

---

## 1. Who we are and who this applies to

This Privacy Policy describes how **Seth Rininger**, a sole proprietor trading as Peanut Gallery ("**we**", "**us**", "**Provider**") collects, uses, shares, and retains information when you use the Peanut Gallery Chrome extension (the "**Extension**"), the Hosted Backend at `api.peanutgallery.live`, the Marketing Site at `peanutgallery.live` and `www.peanutgallery.live`, or the Peanut Gallery Plus subscription ("**Plus**"). Together, we call these the "**Service**". Defined terms used here match those in the [Terms of Service](TERMS-OF-SERVICE.md).

**Geographic scope.** The paid Peanut Gallery Plus subscription and the Demo Mode free-trial allowance backed by our shared API keys are offered **only to users in the United States**. The Extension source code and the right to self-host the backend are globally available under the MIT license. Users outside the United States should not subscribe to Plus or use Demo Mode on the Hosted Backend; instead, use My-Keys Mode, self-host, or fork the repository. See [Terms of Service §1.3](TERMS-OF-SERVICE.md#13-geographic-availability--united-states-only) and [docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md](../SELF-HOST-FOR-INTERNATIONAL-USERS.md).

We are based in **North Carolina**, U.S.A. The Hosted Backend is currently deployed on Railway in the U.S. region `us-west2`. The Marketing Site is hosted on GitHub Pages (U.S. edge nodes globally).

We do not offer the paid Service to users in the European Economic Area, United Kingdom, or Switzerland. See §4 for how this affects GDPR and UK-GDPR applicability. For the audio stream we forward to Deepgram and the transcript content we forward to our AI providers on your behalf, we act as a passthrough — we only forward the content; we do not retain or repurpose it.

## 2. What the Extension does on your device

The Extension runs in your browser and collects only what is necessary to operate:

- **Captures audio** from the current browser tab via the `chrome.tabCapture` API when you click **Start Listening**. Audio capture stops when you click Stop, close the tab, or end the session.
- **Streams that audio** to the backend you configure (the Hosted Backend by default, a self-hosted backend if you choose) as 16 kHz PCM for live transcription.
- **Stores the following settings locally** in `chrome.storage.local`, which Chrome persists on your device:
  - Backend URL (`serverUrl`);
  - API keys you typed in (`deepgramKey`, `anthropicKey`, `xaiKey`, `braveKey`, and `openAiKey` — if you chose to paste any);
  - Pack choice (`packId`), fact-check search-engine choice (`searchEngine`), response-rate dial (`responseRate`), sensitivity level (`pgSensitivity`), theme (`theme`);
  - Per-persona mute set (`mutedPersonas`);
  - Peanut Gallery Plus license key (`pgSubscriptionKey`), backend mode (`pgBackendMode`), and sub-toggle (`pgPlusUseMode`) — populated only if you subscribe;
  - Per-install UUID (`installId`) — generated on first run, used only to meter the Demo trial on the Hosted Backend;
  - Session-recall data, in preparation for the v2.0 "Past sessions" feature: up to 50 prior sessions' metadata, sampled transcript tails (capped at 4,000 characters per session), and the persona reactions for each, under keys `sessions.index` and `sessions.<id>`. Eviction is LRU at 50 sessions;
  - User-interface preferences: first-run tutorial seen flag (`tutorialSeen`), debug-panel open state (`debugPanelOpen`);
  - Feedback signals for the active session: upvotes, downvotes, and the pinned entry (per-session keys + `pinnedEntry`).

**Nothing in `chrome.storage.local` leaves your browser unless you trigger it.** For example, your upvotes and downvotes are sent to our `/api/feedback` endpoint when you cast them (see §5 below), and your subscription license key is sent as a request header on every Hosted Backend call while Plus is active. The storage itself is local to your device.

The Extension's current permissions, for reference:

- `tabCapture` — to capture the tab's audio once you authorize it;
- `offscreen` — to host the `AudioContext` that downsamples the captured audio;
- `activeTab` — to identify the tab you chose;
- `storage` — to persist your preferences as described above;
- `sidePanel` — to render the reaction feed alongside the tab.

The Extension also declares `optional_host_permissions` for `http://*/*` and `https://*/*` so you can point it at any tab you grant access to. The Extension does not access or modify the *content* of those pages; it only reads the tab's *audio* via `chrome.tabCapture` after an explicit user gesture.

## 3. What data the backend receives and keeps

### 3.1 Audio (all modes)

- **Received** as a continuous PCM stream while a session is live.
- **Forwarded** to the transcription provider (Deepgram by default, or whichever provider your configured key maps to).
- **Not recorded** on our server. The audio flows through in-memory buffers and is discarded as each chunk is forwarded.

### 3.2 Live transcript (all modes)

- **Produced** by the transcription provider and returned to us as text.
- **Held** in memory during your session for the Director to route persona reactions.
- **Discarded** when the session ends. We do not write complete transcripts to any disk or database.
- **Exception**: individual persona-reaction snippets you *actively* upvote, downvote, pin, or quote-card are sent to our `/api/feedback` endpoint along with the transcript tail (the last ~500 characters) that informed that reaction. See §5 for how and why.

### 3.3 API keys (My-Keys / BYOK Mode)

- **Received** per-request as HTTP headers: `X-Deepgram-Key`, `X-Anthropic-Key`, `X-XAI-Key`, `X-Brave-Key`, `X-OpenAI-Key`, `X-Groq-Key`, `X-Cerebras-Key` (the last two optional for shadow-router telemetry in development).
- **Forwarded** to the respective providers.
- **Not logged, not stored, not persisted** in any form server-side. Our structured logger (`lib/debug-logger.ts`) writes only request identifiers, session identifiers, persona identifiers, and aggregate state to `logs/pipeline-debug.jsonl`. Keys are never part of any log entry.

### 3.4 Install ID (Demo Mode)

- **Received** as the `X-Install-Id` header on every request while the free-tier limiter is enabled on the backend.
- **Used** to meter the free 15-minute Demo trial per installation (`lib/free-tier-limiter.ts`).
- **Held** on the Hosted Backend only long enough to enforce the 15-minute Demo allowance. Usage counters and install-id records are purged 30 days after the Demo allowance is exhausted or the install is last seen.
- **Not correlated** with any personal identifier we hold. The `installId` is a locally generated UUID; we cannot turn it into your email address, IP address, or physical identity without extraordinary effort. It is a **pseudonymous online identifier** in the sense of GDPR Recital 30 and is treated as such.
- Under EU / UK law, we process the `installId` on the basis of **legitimate interests** — specifically, fair sharing of a limited free allowance across the user base, which is necessary for the Demo tier to exist at all.

### 3.5 Email address, license key, and subscription state (Plus Mode only)

- **Received** at signup via Stripe's hosted checkout page (Stripe collects the card data; we never see it). Also received whenever you request key recovery, billing-portal access, or cancellation through the Extension's drawer.
- **Stored** on our backend database alongside:
  - Your Stripe subscription identifier;
  - Timestamps of subscription events (created, renewed, cancelled, revoked);
  - The license key we issued (`pg-xxxx-xxxx-xxxx`);
  - The status of the subscription (active, paused, revoked).
- **Encrypted at rest** with field-level AES-GCM (or SQLCipher, depending on the deployed configuration) on a durable database attached to the Hosted Backend.
- **Used** to: (a) validate your license key when you start a session in Plus Mode; (b) deliver the key at signup; (c) deliver key-recovery and subscription-management emails; (d) generate Stripe customer-portal links for cancellation and billing-detail updates.
- **Retained** as long as your subscription is active, plus **12 months after cancellation** for refund-eligibility and financial-record purposes. After that window, your email and license key are deleted. Stripe's own retention of transaction data is governed by [Stripe's privacy policy](https://stripe.com/privacy) and may be longer for tax / anti-fraud reasons.
- Under EU / UK law, we process this data on the basis of **performance of a contract** (your subscription) and **compliance with legal obligations** (tax, anti-fraud, accounting).

### 3.6 Weekly usage counter (Plus Mode only)

- **Computed** as milliseconds of hosted transcription per rolling 7-day window, keyed on license key.
- **Used** to enforce the 16-hour weekly cap and render the progress bar in your drawer.
- **Retained** per-week for **30 days** for cap enforcement and user support (e.g., resolving "I think you overcharged my cap"). Rolled off after 30 days.

### 3.7 Operational telemetry (all modes)

The Hosted Backend emits structured log events to `logs/pipeline-debug.jsonl` for operational visibility: request IDs, session IDs, persona IDs, response timings, error conditions, director decisions, feedback actions. These logs are retained for **30 days** and never shared externally. They never include: raw API keys (redacted at the logger), live audio bytes, complete transcripts, raw email addresses (except in a restricted "subscription event" subset retained per §3.5), or payment details.

### 3.8 Feedback signals (persona reactions you interact with)

When you upvote, downvote, pin, or generate a quote-card from a persona reaction, we log that action to `/api/feedback` with the following fields (see `app/api/feedback/route.ts`):

- The session identifier;
- The entry identifier within that session;
- The action (upvote / downvote / clear_vote / pin / unpin / quote_card);
- The persona identifier (producer / troll / soundfx / joker) and pack identifier (howard / twist);
- The response text the persona produced;
- The transcript tail (last ~500 characters) that informed that reaction;
- Your `installId`;
- A timestamp.

We retain these feedback events for **90 days** in the pipeline log. We use them to (a) improve the personas' system prompts, (b) improve the Director's routing logic, and (c) pick highlights for the v2.0 session-recall feature.

**We do not tie this feedback to your email or your subscription license key.** The feedback log carries only the pseudonymous `installId` + session ID.

Under EU / UK law, we process feedback signals on the basis of **legitimate interests** — specifically, product improvement for a small open-source project that cannot afford a dedicated product-analytics team. You may object to this processing by either (a) self-hosting with `DISABLE_FEEDBACK_LOGGING=true`, or (b) refraining from voting / pinning / quote-carding. A user-facing opt-out toggle in the Extension drawer is on the roadmap and should ship before first paid launch.

### 3.9 Marketing Site analytics

The Marketing Site at `www.peanutgallery.live` and `peanutgallery.live` loads **Google Analytics** (property `G-3R9CK4LRGF`) to measure aggregate page visits. The `app/layout.tsx` Next.js route also loads the same Google Analytics tag, though the apex `peanutgallery.live` currently 308-redirects to the GitHub Pages site; both locations are disclosed here for completeness. Google Analytics receives:

- Your IP address (Google may truncate depending on region);
- Your user agent;
- The referring URL;
- Page-view events and session identifiers generated by Google's client library.

Google Analytics sets cookies (or equivalent local-storage identifiers) on the Marketing Site. We use the data only in aggregate to understand which pages are landing and which are not. We do not use Google Analytics' advertising features and have not enabled Google's remarketing, Signals, or user-ID features. See [Google's privacy policy](https://policies.google.com/privacy) and the [Google Analytics data-retention documentation](https://support.google.com/analytics/answer/7667196).

**The Extension itself does not load any third-party analytics library.** It makes network calls only to the backend you configure, to Stripe (for checkout), and (in Plus Mode) to the transactional-email provider indirectly through the Hosted Backend.

### 3.10 Payment processing (Plus Mode only)

Stripe ([stripe.com](https://stripe.com)) handles all payments for Plus. We never see, store, or process your credit card or banking details. Stripe's handling of your payment data is governed by [Stripe's privacy policy](https://stripe.com/privacy). Stripe is the controller of the payment data it collects; we are the controller of the subscription identifier Stripe sends us when a subscription begins or changes.

### 3.11 Transactional email (Plus Mode only)

We use **Resend** ([resend.com](https://resend.com)) to send license-key delivery emails, key-recovery emails, billing-portal links, and required service notifications for Plus. Messages are sent from `noreply@send.peanutgallery.live`, with `Reply-To: legal@peanutgallery.live` so your replies route to a monitored inbox. Resend receives your email address, the content of the message, and its own delivery metadata (SPF/DKIM/DMARC, opens, bounces); it is listed as a subprocessor in §11.

## 4. Geographic scope and GDPR / UK GDPR

We do not offer Plus, Demo Mode on our keys, or any other paid service to users in the European Economic Area, United Kingdom, Switzerland, or any other non-U.S. jurisdiction. We do not target those markets, do not localize or translate the Marketing Site for them, do not accept non-U.S. billing addresses for Plus, and do not monitor the behavior of users outside the United States. We rely on this narrow commercial scope (consistent with GDPR Art. 3(2) and UK-GDPR equivalents) to keep the Service within a single legal regime — the laws of the State of North Carolina and the United States.

The open-source Extension and the ability to self-host the backend are available under the MIT license to anyone, anywhere. If you live outside the United States and want to use Peanut Gallery, you may either (a) run the Extension in My-Keys Mode with your own API keys (no data flows to our backend), or (b) self-host the Next.js backend in your own jurisdiction under your own operator agreement — see [docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md](../SELF-HOST-FOR-INTERNATIONAL-USERS.md). In either case, you are the controller of any personal data you process and take on the obligations that role carries under your local law.

The Marketing Site at `www.peanutgallery.live` uses Google Analytics as described in §3.9. The Marketing Site displays a **cookie-consent banner** on first visit; Google Analytics is only loaded if you accept it. If you decline, no Google Analytics script loads and no GA cookies are set. If you are visiting from the EU / UK / Switzerland, the consent model is the same as for U.S. visitors — Google Analytics is off by default until you opt in.

## 5. Feedback signals in detail (design principle + opt-out)

Because feedback logging is the least-obvious collection we do, we want to spell it out:

**What triggers a log entry.** Only your explicit click on one of the feed-entry menu actions: upvote, downvote (or clear vote), pin (or unpin), or quote-card. Scrolling, reading, idle time, and passive presence do not log anything.

**What is logged.** The exact fields are in `app/api/feedback/route.ts` and listed in §3.8 above. We do not log your IP address or user agent on this endpoint beyond what the hosting provider collects for ordinary request routing.

**Why we log it.** Three uses, in priority order:

1. Refining the persona system prompts (are the producer's fact-checks landing? is the troll too spicy?);
2. Training / tuning the Director's routing decisions (did we pick the right persona for the moment?);
3. Selecting session highlights for the v2.0 "best of this episode" feature, which is a user-facing benefit.

**What we do not do with it.** We do not use feedback to train third-party AI models. We do not share feedback with advertisers (we don't run ads). We do not correlate feedback with your email or license key. We do not sell or rent it to anyone.

**How to opt out.** Today: self-host with `DISABLE_FEEDBACK_LOGGING=true`, or don't interact with the feed-entry menu. Soon: a user-facing opt-out toggle in the Extension's drawer — tracked in [docs/SUBSCRIPTION-ARCHITECTURE.md](../SUBSCRIPTION-ARCHITECTURE.md).

## 6. What we explicitly don't do

- **No advertising.** The Extension does not show ads. The Marketing Site does not show ads. The Hosted Backend does not inject ads. We do not build ad-targeting profiles.
- **No data sale or rent.** We do not sell, rent, or barter user data in any form. This statement is made explicitly for purposes of the California Consumer Privacy Act ("CCPA"), the California Privacy Rights Act ("CPRA"), the Virginia Consumer Data Protection Act, the Colorado Privacy Act, the Connecticut Data Privacy Act, and every other U.S. state privacy law: **we do not sell or share personal information for cross-context behavioral advertising.**
- **No third-party analytics in the Extension.** The only third-party analytics in the Service at all is Google Analytics on the Marketing Site (§3.9). The Extension itself is clean.
- **No cross-site tracking.** The Extension does not set cookies, does not inject scripts into pages you visit (the only content script runs on `peanutgallery.live` subdomains to bridge the Marketing Site's session hand-off — see `extension/content.js`), and does not read cookies or other site state.
- **No audio recording.** At no point is your captured audio persisted to a file or database on any backend we operate.
- **No complete-transcript storage.** Beyond the session lifetime and the feedback-logged snippets in §3.8, we do not keep the text of your sessions.
- **No training of our own or third-party AI models on your content.** We do not use your audio, your transcript, your persona reactions, or your feedback signals as training data for any model. If that ever changes, the change would require a new version of this Policy with 30 days' email notice to active Plus subscribers and an explicit opt-in mechanism.

## 7. Retention summary

| Data | Retention | Where |
|---|---|---|
| Audio bytes | In-memory, during session only | Backend RAM |
| Live transcript (complete) | In-memory, during session only | Backend RAM |
| Transcript snippets you voted / pinned / quote-carded | 90 days | `logs/pipeline-debug.jsonl` (Railway instance disk) |
| API keys (BYOK) | Never stored | — |
| Install ID | 30 days after Demo exhaustion or last activity | Backend database |
| Email + license key + Stripe subscription ID | Subscription lifetime + 12 months | Backend database |
| Weekly usage counter | 30 days per week-window | Backend database |
| Operational logs | 30 days | Backend disk |
| Payment / transaction records | Per Stripe's retention policy | Stripe |
| Marketing-site page-view events | Per Google Analytics retention (default 14 months; we will confirm and update if we change the setting) | Google Analytics |
| Session-recall data in your browser | Last 50 sessions, LRU-evicted | Your device, `chrome.storage.local` |

## 8. Cookies and similar technologies

- **The Extension** does not set cookies. `chrome.storage.local` (backed by IndexedDB in your browser) is local to your device and is not a cookie.
- **The Hosted Backend** does not set cookies or tracking beacons. It is a stateless API behind a session identifier returned in a response header.
- **The Marketing Site** loads Google Analytics, which sets cookies (or equivalent local-storage identifiers) with names beginning `_ga`, `_gid`, or `_gat`. We do not run any other cookie-dropping script. `<TBD — cookie banner / preferences center decision pending counsel review; see §4 and the Lawyer review checklist.>`
- **Stripe's hosted checkout page** sets its own cookies when you enter payment information. Those cookies are subject to [Stripe's cookie policy](https://stripe.com/cookies-policy).

## 9. Your rights

Wherever you live, you have the right to:

- **Know and access** what data we hold about you. For Plus subscribers, that is: your email, license key, subscription status, current weekly usage, and the last 30 days of weekly counters. For Demo or My-Keys users, there is typically nothing to access because we hold nothing tied to your identity.
- **Correct** inaccurate data. Email `privacy@peanutgallery.live` _(TBD)_ with your correction.
- **Delete** your data. Cancelling your subscription triggers deletion after the 12-month retention window. You may request earlier deletion at any time and we will comply (subject to minimum retention required by law for tax / anti-fraud purposes).
- **Port** your data. The data we hold is small and trivially exportable as JSON; ask and we will send.
- **Object to processing** where we rely on legitimate interests, especially for feedback logging (§5). We will honor the objection and exclude your `installId` from future feedback logging.
- **Withdraw consent** to any processing for which consent is the legal basis. Withdrawal does not affect the lawfulness of processing before withdrawal.
- **Opt out of "sale" or "sharing" of personal information** under U.S. state privacy laws — as stated in §6, we do not engage in sale or sharing as those terms are defined under any U.S. state privacy law.
- **Not be discriminated against** for exercising any of the above rights.

Requests go to `privacy@peanutgallery.live` _(TBD)_. We may ask you to verify your identity (e.g., confirming the email on your Stripe subscription) before we act on the request, to prevent unauthorized disclosure. We will respond within the timeframes required by applicable law — typically **45 days** under U.S. state laws (extendable by 45 days if complexity requires) and **one month** under GDPR (extendable by two months for complex requests). If we cannot fulfill a request, we will tell you why.

You also have the right to complain to your data-protection authority. A list of E.U. authorities is available at [edpb.europa.eu/about-edpb/board/members_en](https://edpb.europa.eu/about-edpb/board/members_en). U.K. users may complain to the [ICO](https://ico.org.uk/make-a-complaint/). California users may contact the [California Privacy Protection Agency](https://cppa.ca.gov/).

## 10. Children's privacy

The Service is not directed at children under 13 and we do not knowingly collect personal information from children under 13. For users in the European Economic Area, the threshold may be as high as 16 depending on the member state (GDPR Art. 8). If you are a parent or guardian and believe a child under the relevant age has subscribed or otherwise provided personal information, email us at `privacy@peanutgallery.live` _(TBD)_ and we will refund any subscription, delete the information, and revoke the `installId`.

## 11. Subprocessors / third parties we share data with

We share data only with the third-party processors listed below, strictly to the minimum necessary to operate the Service. Each is listed with the data category shared and the reason. We do not share with advertisers, data brokers, or marketing platforms.

| Subprocessor | Data we share | Purpose |
|---|---|---|
| Deepgram (U.S.) | Live audio bytes | Speech-to-text streaming |
| Anthropic (U.S.) | Transcript snippets for the Producer + Joker personas | Claude LLM inference |
| xAI (U.S.) | Transcript snippets for the Troll + Sound FX personas; fact-check queries if you selected xAI Live Search | Grok LLM inference and search |
| Brave Search (U.S. / global) | Extracted fact-check queries (short text) | Web search |
| Stripe (U.S. / global) | Payment card details (direct to Stripe), email, subscription identifier | Payment processing (Plus only) |
| Railway (U.S.) | All data flowing through the Hosted Backend in the course of ordinary hosting | Backend hosting |
| Vercel (U.S.) | Next.js route execution where used | Application hosting |
| GitHub / GitHub Pages (U.S.) | Marketing Site traffic | Static site hosting |
| Google Analytics (U.S.) | Marketing Site page-view events + associated metadata | Aggregate site analytics |
| Resend (U.S.) | Email address, license key, message content | Transactional email (Plus only); messages sent from `noreply@send.peanutgallery.live` |

We do not sell, rent, or otherwise share personal data with any third party beyond the subprocessors above. Where a subprocessor is outside your jurisdiction, we rely on the legal transfer mechanism described in §12.

## 12. International data transfers

The Hosted Backend is hosted in the United States. Because the paid Service is offered only to U.S. users (§4, Terms of Service §1.3), the Hosted Backend is not intended to receive personal data originating from outside the United States. If you use the Extension in My-Keys Mode from outside the U.S., no personal data about you flows to our backend — your API keys go directly to the providers you chose.

If the U.S.-based hosted infrastructure is unacceptable for your situation, use **My-Keys Mode** or **self-host** the backend in a region of your choice. See [docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md](../SELF-HOST-FOR-INTERNATIONAL-USERS.md).

## 13. Security

We treat security as a continuous discipline, not a checkbox. Current controls:

- **HTTPS** for all backend traffic. Mixed-content not permitted.
- **No credentials in URLs or Referer headers.** All provider keys and license keys are sent as request headers.
- **Stripe** handles all payment data; we never see a card number.
- **License keys** will be encrypted at rest at Phase 2 of the subscription rollout (method pinned at ship-time: SQLCipher on the SQLite volume or application-level AES-GCM).
- **Shared demo keys** on the Hosted Backend are rotated at least quarterly, or sooner on suspicion of compromise.
- **Structured logging** with redaction of any field containing a key.
- **Per-request timeouts** and abort-signal plumbing on every LLM call, so a rogue upstream cannot leak a hung session.
- **Narrow content-script scope** in the Extension — `extension/content.js` runs only on `peanutgallery.live` subdomains.
- **Narrow service-worker permissions** — the Extension declares only the permissions actually used and is reviewed against the [CWS compliance checklist](../../marketing/CWS-COMPLIANCE-CHECKLIST.md) before every release.

No system is perfectly secure. If you believe you have found a security issue, please report it responsibly via [`SECURITY.md`](../../.github/SECURITY.md) — not a public GitHub issue. Our target acknowledgment is 48 hours; target first-fix or mitigation for high-severity issues is 7 days.

## 14. Data-breach notice

If we become aware of a security incident that affects your personal data and is likely to result in a material risk to you, we will notify you without undue delay at the email address on file (Plus subscribers) or via the Marketing Site and in-Extension banner (Demo / My-Keys users), consistent with our obligations under GDPR Art. 33–34 and applicable U.S. state breach-notification laws.

## 15. Changes to this Policy

We may update this Policy. For **material changes** affecting Plus subscribers (scope of data collected, retention durations, third-party sharing, new subprocessors that receive personal data, or changes to international transfer mechanisms), we will email active subscribers at least **30 days** before the change takes effect and allow cancellation with a pro-rata refund. For non-material changes (clarifications, formatting, typo fixes, or subprocessor substitutions that do not materially change data handling), the change is effective on publication at the updated "Last updated" date.

## 16. Contact

Questions, data-subject requests, privacy complaints, and "I spotted an error in this Policy" notes:

- General privacy inquiries / rights requests: `privacy@peanutgallery.live` _(TBD)_
- Legal / DMCA / billing: `legal@peanutgallery.live` _(TBD)_
- Security disclosures: `security@peanutgallery.live` (see [SECURITY.md](../../.github/SECURITY.md))

Our mailing address is available on request via the addresses above.

---

## Lawyer review checklist

This checklist is for the lawyer reviewing this draft. **It is not part of the published Policy** — strip this section before publishing.

### Hard placeholders resolved

- [x] **§1**: Seth's state of residence is **North Carolina** (confirmed 2026-04-21).
- [x] **§4 Geographic scope**: Plus and Demo are **United States only**; international users directed to fork-and-self-host (confirmed 2026-04-21).
- [x] **§11 and §3.11**: Transactional email is **Resend**; verified sending domain is the `send.peanutgallery.live` subdomain, sender is `noreply@send.peanutgallery.live`, replies route to `legal@peanutgallery.live` (confirmed 2026-04-21).
- [x] **§4 + Marketing Site**: **Cookie-consent banner shipped.** Google Analytics loads only after affirmative opt-in.
- [x] **§16 contact aliases**: `privacy@`, `legal@`, `security@`, `noreply@` — in DNS provisioning as of 2026-04-21.

### Substantive items to confirm

- [ ] **Role split**: We describe ourselves as "controller" for most processing and "processor" for audio-passthrough and transcript-passthrough to AI providers. Confirm this is defensible — in particular, confirm whether Deepgram, Anthropic, and xAI accept us as a controller/controller co-processor relationship or require a DPA treating us as processor-only. Line this up with subprocessors' published DPAs.
- [ ] **Google Analytics on the Marketing Site**: §3.9 discloses GA. Confirm that (a) disclosure is sufficient under ePrivacy / PECR given current GA config, (b) GA data-retention setting is confirmed at 14 months or updated to our preference, (c) no advertising features are enabled, (d) IP-anonymization is on, (e) Google Signals is off.
- [ ] **CCPA / CPRA**: §6 says we do not "sell" or "share" personal information for cross-context behavioral advertising. Confirm we meet the CCPA definitions, including whether passing transcript snippets to Anthropic / xAI / Brave for inference / search constitutes "sharing" under CPRA's expanded definition (which targets cross-context behavioral advertising specifically; inference-only passthrough should be out of scope, but confirm). Confirm no "Do Not Sell or Share My Personal Information" link is required on the Marketing Site given our practices — the CCPA link requirement applies when selling/sharing; where we neither sell nor share, the compliant stance is to say so in the Privacy Policy and skip the link, but counsel should confirm.
- [ ] **GDPR Art. 27 representative**: We believe we are below the threshold that requires an EU representative (Seth is a U.S. sole proprietor with no permanent establishment in the EU, and the Service is not "targeted at" EU users in the Art. 3 sense). Confirm.
- [ ] **UK GDPR representative**: Same assessment for the UK; confirm.
- [ ] **§12 International transfers**: The SCC + UK IDTA reliance is standard for U.S.-hosted services. Confirm wording is current against the latest Commission SCCs (2021/914) and the latest ICO IDTA.
- [ ] **Recording consent (TOS §5.1, referenced here)**: Confirm the Privacy Policy's cross-reference is clear enough that a reader understands the recording-consent exposure is on them, not us.
- [ ] **§5 Feedback opt-out**: The Extension does not yet offer a user-facing opt-out toggle; the doc says one is coming. Confirm that disclosure is sufficient for the v2.0 launch, or insist on the toggle landing before Plus opens to the public. The subscription-architecture doc treats this as an open item.
- [ ] **§3.7 Operational log retention (30 days)** and **§3.8 Feedback log retention (90 days)**: confirm these retention windows are defensible under GDPR data-minimization and U.S. state laws' reasonable-necessity rules.
- [ ] **§13 Security**: Phase 2 encryption at rest is stated but not yet implemented. Decide whether to publish this Policy before Phase 2 ships. Recommend shipping Phase 2 first, then publishing — otherwise the Policy makes a forward-looking claim that is technically inaccurate at publish.
- [ ] **Chrome Web Store "Privacy practices" tab parity**: Confirm everything this Policy discloses matches the CWS listing's privacy disclosures. See [`marketing/CWS-COMPLIANCE-CHECKLIST.md § A3`](../../marketing/CWS-COMPLIANCE-CHECKLIST.md). Mismatches are the fastest path to CWS delisting.
- [ ] **Manifest v3 permissions audit**: Confirm the permissions list in §2 matches the current `extension/manifest.json` at publish time. The manifest currently declares `optional_host_permissions` for `http://*/*` and `https://*/*`, which expands the potential recording surface and makes the §5.1 / §2 recording-consent notice load-bearing.

### Publishing decisions

- [ ] Publish on both `site/privacy/index.html` (GitHub Pages marketing site) and `app/privacy/page.tsx` (Next.js / Vercel, currently behind the 308 redirect but live if directly fetched). Content should match; see update instructions below.
- [ ] Add a direct link to this Policy from the Extension's Backend & keys drawer, at minimum near the subscription block and near the feedback-vote buttons. Users shouldn't have to leave the Extension to find it.
- [ ] Decide whether to keep GA on the Marketing Site. If yes, build the cookie banner. If no, strip gtag from `site/index.html` and `app/layout.tsx` and remove §3.9 from this Policy.

---

*End of draft. See the pairing [Terms of Service](TERMS-OF-SERVICE.md) for the product's usage terms.*
