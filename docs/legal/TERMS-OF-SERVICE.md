# Peanut Gallery — Terms of Service

> **⚠ DRAFT — not legal advice.** This document is a working draft for Seth to review with counsel before publishing. It is calibrated for a small, open-source-first consumer Chrome extension with an optional paid tier ("Peanut Gallery Plus") that runs on a hosted backend. Everything here — including every defined term, every carve-out, every retention number, every dispute-resolution placeholder — is revisable by counsel. **It is NOT a template you should copy into any other product without your own lawyer's sign-off.**

> **Where bracketed placeholders (`<TBD …>`) appear**, they mark decisions that require Seth or counsel to confirm before publication (see the [Lawyer review checklist](#lawyer-review-checklist) at the end).

**Last updated:** 2026-04-21 (draft v2 — full rewrite for v2.0 launch)
**Effective:** _not yet effective_
**Contact:** `legal@peanutgallery.live` _(TBD — confirm Seth has provisioned this alias on the peanutgallery.live MX records before publication)_
**Companion document:** [Privacy Policy](PRIVACY-POLICY.md). The Privacy Policy is incorporated by reference into these Terms.

---

## 0. Reading guide

These Terms run long because the product is unusual — a Chrome extension that can capture browser-tab audio, send it through third-party AI providers, and overlay AI-generated commentary on a live audio stream. Many of the risks (recording-consent law, AI hallucinations, persona right-of-publicity, BYOK key handling) don't appear in standard SaaS templates. Each section below has a one-line summary at the top so you can skim.

If you only read three things, read **§5 (Acceptable Use)**, **§9 (AI Output Disclaimer)**, and **§14 (Limitation of Liability)** — those are the sections that change what you can use the product for and what you can recover from us if something goes wrong.

---

## 1. About Peanut Gallery (the "Service")

> *Summary: We're a free, open-source Chrome extension; an optional $8/month subscription pays for the hosted API keys.*

Peanut Gallery (the "**Service**") consists of:

1. **The Extension** — a Chrome browser extension distributed through the Chrome Web Store and as source code at [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery), licensed under the [MIT License](../../LICENSE);
2. **The Hosted Backend** — a Next.js API hosted at `api.peanutgallery.live` ("**Hosted Backend**") that the Extension calls by default;
3. **The Marketing Site** — the public website at `www.peanutgallery.live` and `peanutgallery.live`; and
4. **Peanut Gallery Plus** ("**Plus**") — an optional monthly subscription that authorizes the Hosted Backend to perform AI calls on your behalf using API keys we own, subject to a weekly usage cap.

The Extension captures audio from the browser tab you point it at, streams that audio to a transcription provider for live conversion to text, then calls one or more large-language-model providers to produce real-time written commentary from four AI "personas" displayed in the Chrome side panel.

The Service is provided by **Seth Rininger**, a sole proprietor based in **North Carolina**, United States ("**we**", "**us**", "**our**", or the "**Provider**"). You are referred to as "**you**" or the "**User**".

### 1.1 The three operating modes

The Extension can operate in three modes that you choose at runtime in the Backend & keys drawer:

| Mode | Who pays for the API calls | Identity sent to Hosted Backend |
|---|---|---|
| **Demo Mode** | Provider, on its own keys | A pseudonymous `installId` UUID generated locally on first run |
| **My-Keys Mode** ("BYOK") | You, via your own provider accounts | None to the Hosted Backend (your keys go directly to the providers via the Backend as a passthrough) |
| **Plus Mode** | Provider, on its own keys, metered against your subscription | A subscription license key bound to your email address |

You can also point the Extension at a backend you self-host. When you do, the Hosted Backend is not involved at all and only the Extension portion of these Terms applies to you (your self-hosted backend is yours to operate).

### 1.2 Open-source license vs. these Terms

The Extension's source code is MIT-licensed. The MIT License governs your right to copy, modify, and redistribute the *code*. **These Terms govern your right to use the *Service* — i.e., the binary distributed through the Chrome Web Store, the Hosted Backend, the Marketing Site, and Plus.** If you fork the project and run your own copy, the MIT License is what matters; if you install our build from the Chrome Web Store and call our backend, both apply.

### 1.3 Geographic availability — United States only

**Peanut Gallery Plus and the Demo Mode free-trial allowance on our shared API keys are offered only to users in the United States.** The Extension itself is globally available on the Chrome Web Store under the MIT license; My-Keys Mode (BYOK) and self-hosted backends work for anyone, anywhere. The paid Plus subscription and the Demo allowance backed by our keys, however, are offered only to users whose billing address — and, in the case of Demo Mode, whose residence — is in the United States of America.

- By creating a Peanut Gallery Plus subscription, you represent and warrant that your billing address is in the United States. We rely on this representation and on Stripe's billing-country data to enforce this restriction.
- We do not knowingly offer, market, or provide Plus or the Demo allowance to users outside the United States, and we do not target any non-U.S. jurisdiction for commercial activity. If you are outside the United States, please do not subscribe to Plus or use Demo Mode against our Hosted Backend. Use My-Keys Mode, self-host the open-source backend, or fork the repository.
- Users outside the United States should read [docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md](../SELF-HOST-FOR-INTERNATIONAL-USERS.md) for step-by-step guidance on running Peanut Gallery in their own jurisdiction, under their own operator agreement with their own users. As the operator of a self-hosted instance, you become the controller of any personal data you process and take on the obligations of that role under your local law (including, where applicable, GDPR, UK GDPR, LGPD, PIPEDA, the Privacy Act, and every other data-protection regime not binding on a U.S.-only Service).
- We reserve the right to refund and terminate any Plus subscription whose billing address is outside the United States, whether created through error, misrepresentation, or a change in residence.

---

## 2. Acceptance and eligibility

> *Summary: You must be old enough to use it. Installing or using the Extension or visiting the Marketing Site means you accept these Terms.*

You accept these Terms by (a) installing or running the Extension, (b) calling the Hosted Backend from any client, (c) creating or using a Plus subscription, or (d) browsing the Marketing Site beyond the landing page. If you don't agree, do not do those things.

You represent and warrant that:

- You are at least **13 years old** to use the Extension or visit the Marketing Site (the Service is not directed at children under 13);
- You are at least **18 years old**, or the age of majority in your jurisdiction if higher, to subscribe to Plus or to enter any payment card information;
- You are not on any U.S., U.K., E.U., or U.N. sanctions list, and you will not use the Service in or for the benefit of any sanctioned country (currently including but not limited to Cuba, Iran, North Korea, Syria, the Crimea, Donetsk, Luhansk, and Kherson regions of Ukraine, and any other jurisdiction subject to U.S. comprehensive sanctions);
- You are not legally barred from using cloud transcription, AI-content, or audio-capture tooling under the laws of your jurisdiction.

If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms, and "you" includes both you and that organization.

---

## 3. Accounts and identity

> *Summary: There is no traditional account. Plus uses a license key emailed to you; everything else is keyed off a per-install UUID stored only in your browser.*

We deliberately do not run a traditional account system.

- **Demo Mode** assigns a random `installId` to your Extension on first run, stored only in your browser via `chrome.storage.local`. We don't otherwise know who you are. Clearing your browser data resets the `installId`; we treat that as expected behavior and do not attempt to prevent it. We may, but are not required to, suspend `installId`s that we have reasonable grounds to believe are scripted, fraudulent, or used to circumvent the Demo allowance described in §4.

- **My-Keys Mode** sends your provider API keys per-request as HTTP headers. The Hosted Backend forwards them to the relevant providers and does not store them. You are responsible for the security of those keys at the provider level (rotation, scope, billing alerts).

- **Plus Mode** requires an email address — collected during Stripe checkout — and a license key (format `pg-xxxx-xxxx-xxxx`) we email to that address. The license key, your email, your Stripe subscription identifier, and a per-week usage counter are stored on our backend (see [Privacy Policy §3](PRIVACY-POLICY.md)).

You are responsible for the accuracy of any email address you provide at signup. We send the license key, billing receipts, recovery messages, subscription notices, and any required service notifications to that address. **If you mistype your email, we cannot deliver the license key you paid for.** Email us within 30 days using the same payment instrument and we will reissue the key.

---

## 4. Demo Mode (the free trial)

> *Summary: Free 15 minutes, one-time per install, on our keys. Don't script abuse.*

New installations get **15 minutes of hosted transcription and persona commentary, lifetime per `installId`** ("**Demo Allowance**"), at our cost. After your Demo Allowance is exhausted, you must use My-Keys Mode or subscribe to Plus to continue using the Hosted Backend. Demo sessions are subject to the same Acceptable Use rules as paid sessions (§5).

We may change the Demo Allowance (e.g., shorten or lengthen it, gate by region, suspend it during maintenance windows) at any time without notice. We will not retroactively rescind Demo time you have already used. The Demo Allowance has no monetary value and may not be sold, traded, or assigned.

We may revoke any `installId` we reasonably determine to be the product of automated trial-resetting, mass enumeration, fraud, or other circumvention of the Demo Allowance.

---

## 5. Acceptable Use

> *Summary: Use it for lawful purposes. Recording-consent laws are your problem, not ours. No harassment, no scraping, no DMCA-bait, no malicious use of the persona output.*

You agree not to use the Service to:

### 5.1 Audio capture and recording-consent laws

- **Capture, transcribe, or process any audio that you are not legally entitled to capture, transcribe, or process** under the laws of every jurisdiction relevant to the audio (which may include the jurisdiction of the speakers, the broadcasters, the platform hosting the audio, your location, and the Hosted Backend's location). Several U.S. states (including but not limited to **California, Florida, Illinois, Maryland, Massachusetts, Montana, New Hampshire, Nevada, Pennsylvania, and Washington**) require all-party consent to record private conversations. The European Union, the United Kingdom, and many other jurisdictions impose equivalent or stricter rules under wiretap, eavesdropping, data-protection, and broadcasting laws.
- **You are solely responsible** for obtaining any consent required to capture or transcribe audio you direct the Extension toward, including but not limited to live calls, video conferences, voicemail, ambient room audio in shared spaces, and one-to-one streamed conversations.
- The Extension's `optional_host_permissions` declaration allows it to capture audio from any tab you grant access to. We grant you that capability; we do not warrant that any particular use of it is lawful in your circumstances.

### 5.2 Content rights

- Do not direct the Extension at any audio in violation of the rights of its rights-holder (including without limitation circumventing platform digital-rights-management, scraping content from a service whose terms forbid it, or producing transcripts from copyrighted material in violation of fair use / fair dealing).
- Do not redistribute persona output as if it were a verbatim transcript of, or a real statement by, any natural person whose voice was captured. Persona output is AI-generated commentary; see §9.

### 5.3 People

- Do not use the Service to harass, defame, threaten, surveil, or stalk any person.
- Do not direct the Extension at audio of any identifiable child under 13, or use the persona output to produce content sexualizing or harming any child or minor.
- Do not use the Service to attempt to identify, deanonymize, profile, or track any person without their consent.

### 5.4 Service and security

- Do not abuse the Demo Allowance through scripted enumeration, install-id rotation, fork-based circumvention, or other automated trial-resetting. Manual reset by clearing your browser data is fine; running a script that mints fresh trials at scale is not.
- Do not attempt to defeat, bypass, reverse-engineer, or exploit the Stripe webhook, license-key issuance, or subscription-cap-enforcement mechanisms. Use the open-source path instead — see [docs/SELF-HOST-INSTALL.md](../SELF-HOST-INSTALL.md) and [docs/BUILD-YOUR-OWN-BACKEND.md](../BUILD-YOUR-OWN-BACKEND.md).
- Do not redistribute, share, or resell your Plus license key. One subscription = one user's personal use across that user's devices. We may revoke license keys we reasonably determine are shared beyond personal use (e.g., posted publicly, used by an organization without a multi-seat agreement we currently do not offer).
- Do not probe, scan, or stress-test the Hosted Backend without our prior written authorization, beyond what is incidental to ordinary use. Security research is welcome via [SECURITY.md](../../.github/SECURITY.md); production-impacting tests require coordination.
- Do not circumvent any rate-limiting, abuse-prevention, or content-filtering mechanisms that we operate.

### 5.5 Persona output

- Do not use the persona output to produce content that you know or should know is false in a manner likely to defame a real person. Persona output is parody, satire, and commentary; it is not journalism. See §8 and §9.
- Do not use the persona output to impersonate any real person whose voice or likeness inspired a persona pack. Personas are inspired by public figures (Howard Stern Show staff and *This Week in Startups* hosts at the time of this draft) and the names, voices, and personalities of those public figures remain their own.

### 5.6 Other prohibited uses

- Any unlawful purpose; any purpose that violates any third party's intellectual property, privacy, publicity, or contractual rights; any purpose that introduces malware, viruses, or other harmful code into the Service; any purpose that compromises the integrity, availability, or confidentiality of the Service or any other user's data.

---

## 6. Peanut Gallery Plus (the subscription)

> *Summary: $8/month, 16 hours/week, cancel anytime, refund on request.*

### 6.1 Price

`$8.00 USD per month`, billed monthly through Stripe. Stripe may collect applicable sales tax, VAT, GST, or equivalent based on your billing address; that tax is added to the $8.00 base price and shown to you before you confirm. We may change the price by giving you at least **30 days' notice** by email; price changes take effect at the start of your next billing period and you may cancel without penalty before that takes effect.

### 6.2 Billing currency and acceptance of payment

The base subscription price is denominated in U.S. dollars. Stripe may convert it to your card's billing currency at Stripe's then-current rate. You authorize us, through Stripe, to charge your selected payment instrument $8.00 (plus tax) per month for as long as the subscription is active.

### 6.3 Auto-renewal

**Plus is an auto-renewing subscription.** Your subscription will automatically renew each month at the then-current price unless and until you cancel. We will not give you separate notice before each renewal beyond the standard Stripe receipt; for material price changes, see §6.1.

You may cancel at any time. To cancel, click **Manage subscription** in the Extension's drawer, follow the link to the Stripe customer portal we email you, and complete cancellation there. After cancellation, your subscription remains active until the end of the current billing period; we do not pro-rate cancellations except as described in §6.6.

### 6.4 Weekly usage cap

Plus includes **16 hours of hosted transcription and persona commentary per rolling 7-day period**, measured in milliseconds against the timestamp at which your subscription began. When you reach the cap, new sessions cannot start until the oldest used time rolls off. The Extension shows a progress bar in the drawer so you always know where you stand. Sessions in progress at the moment you cross the cap are allowed to continue to their natural end.

The cap is a soft ceiling chosen to keep Plus accessible to non-technical users without subsidizing a small number of high-volume users at scale. We may adjust the cap from time to time on at least 30 days' email notice if we lower it. We may raise it without notice.

Sessions that consume your own provider keys (My-Keys Mode) **never** count against the Plus cap, even when your subscription is active. The Extension exposes a per-session "Use with [Subscription | My keys]" toggle when both are configured.

### 6.5 License key

When you subscribe, we email you a license key (format `pg-xxxx-xxxx-xxxx`). You paste it into the Extension's Backend & keys drawer to activate Plus. You may use the same key on as many of your own personal devices as you wish. You may request a fresh key (which immediately revokes the prior one) by emailing a recovery request from the drawer.

If your payment fails (card declined, chargeback, dispute, fraud claim), we may suspend your license key immediately and resume it once the payment is settled, or terminate the subscription if the failure is not cured within a reasonable time (typically 14 days). You will not be charged for periods during which the key is suspended.

### 6.6 Refunds

**Pro-rata refund on request, no questions asked**, for the current billing period. Email the address at the top of this document. We would rather refund you and have you happy than keep your money and have you annoyed. We do not refund usage prior to the current billing period.

If we materially change Plus to your detriment (price up, cap down, scope reduced), we will give you 30 days' notice by email and you may cancel during that window with a pro-rata refund of the current period.

### 6.7 Cancellation by us

We may suspend or terminate your Plus subscription, with or without notice, if (a) you materially breach these Terms (especially §5 Acceptable Use), (b) we are required to do so by law, court order, or competent authority, (c) Stripe terminates our merchant account, or (d) any underlying provider on which Plus depends terminates our service in a way that makes Plus impossible to operate. If we terminate without your fault, we will refund the unused portion of your current period.

### 6.8 What you are paying for

Plus is the right to use the Hosted Backend's API keys, metered weekly, for the duration of your subscription. **Plus is not a license to the Extension itself** (which is and remains MIT-licensed) and is not a license to any specific third-party provider's service (which remains governed by that provider's own terms — see §11).

---

## 7. What the Service is and is not

> *Summary: Entertainment. Not advice. Not a recording service. Not a verified source.*

Peanut Gallery is an entertainment-and-commentary tool. It is **not**:

- **Legal, medical, financial, tax, psychological, or professional advice** of any kind. Do not rely on persona output for any decision with material consequences.
- **A verified news source**. Persona "fact-checks" pull from live web search (Brave Search or xAI Live Search at the time of this draft) and are summarized by an LLM. Both the search results and the LLM summarization may be wrong, incomplete, or out of date. The "Producer" persona is calibrated to produce confident-sounding output even when its sources are weak; this is a deliberate character choice (see [docs/DESIGN-PRINCIPLES.md §3](../DESIGN-PRINCIPLES.md#3-fact-check-sensitivity-is-per-pack-character-design)) and not a representation of accuracy.
- **A recording or archiving service**. The Service does not save audio files of your sessions. Transcript snippets that you actively choose to upvote, downvote, pin, or convert to a quote-card are sent to our feedback endpoint for product improvement; otherwise transcripts exist only in browser RAM and on the Hosted Backend in-memory for the duration of the session. See the Privacy Policy for details.
- **A traditional account-backed service**. There is no account page, no login session, no cross-device sync. Your `installId` and (if applicable) license key are the entire stored state of your relationship with us.
- **Ad-supported**. The Service does not show advertising, does not contain affiliate links, does not inject content into other websites, and does not sell user data. If advertising were ever introduced, that change would require a new version of these Terms, advance notice to active subscribers, and a refund-on-request period.
- **A guarantee of any specific persona, persona pack, model, or provider remaining available**. We may swap providers, retire personas, modify packs, or otherwise change the product over time. See §13.

---

## 8. Intellectual property

> *Summary: Our code is MIT. Persona names "inspired by" public figures (we don't own them). What the personas say while you're using the Service is yours.*

### 8.1 The Extension's source code

Licensed under the [MIT License](../../LICENSE). You may read it, fork it, modify it, run it yourself, and redistribute it subject to the MIT License. Our trademark rights in the name "Peanut Gallery" and the Peanut mascot artwork are not granted by the MIT License and are reserved (see §8.4).

### 8.2 The persona packs

The persona packs in the open-source repository are inspired by, but not licensed from, the real public figures who motivated them — currently the Howard Stern Show on-air crew and the *This Week in Startups* hosts. We make no claim of ownership over those individuals' names, voices, likenesses, or personalities. The specific *system prompts* that direct each persona's behavior are original text authored by the Provider.

If you are a public figure (or a representative of one) whose name or likeness is used in a persona pack and you want it removed or changed, email us at `legal@peanutgallery.live`. We will respond promptly and in good faith. The Howard pack and TWiST pack as shipped have anti-impersonation guardrails in their system prompts; we will continue to refine those guardrails as we learn what works.

### 8.3 Persona output (what the personas say in your sessions)

The persona output produced during your session is yours to use, subject to the Acceptable Use rules in §5. We claim no ownership in that output. Where persona output quotes, paraphrases, or refers to a third-party copyrighted source (the audio you captured, search-result snippets injected into the Producer's context, etc.), normal copyright, fair-use, and right-of-publicity rules apply to your downstream use — we are not your clearance attorney.

### 8.4 Our marks and visual identity

"Peanut Gallery", the Peanut mascot artwork, the broadsheet UI design, and the "Peanut Gallery Plus" branding are the Provider's. You may refer to them descriptively (in reviews, articles, blog posts, etc.) without our permission. You may not use them as the name or logo of any product, service, or organization that competes with the Service or implies endorsement we have not given.

### 8.5 Feedback and contributions

If you submit feedback (in-Extension upvotes, downvotes, pins, quote-cards; bug reports; feature requests; messages to support; pull requests; comments on Discussions or issues), you grant us a **non-exclusive, perpetual, worldwide, royalty-free, sublicensable, irrevocable license** to use, reproduce, modify, create derivative works of, and incorporate that feedback into the Service for any purpose, including improving persona prompts, the Director's routing logic, and the highlight picker. You waive any moral rights in that feedback to the extent permitted by law. We do not owe you compensation, attribution, or confidentiality for feedback unless we agree otherwise in writing.

You may opt out of server-side feedback logging in either of two ways: (a) self-host the Backend with `DISABLE_FEEDBACK_LOGGING=true`, or (b) refrain from upvoting, downvoting, pinning, or quote-carding any persona reaction. We are working on a user-facing opt-out toggle in the Extension's drawer — see [Privacy Policy §5](PRIVACY-POLICY.md).

### 8.6 DMCA / copyright complaints

If you believe persona output, the Marketing Site, or anything else under our control infringes your copyright, send a DMCA notice to `legal@peanutgallery.live` _(TBD)_ containing the elements required by 17 U.S.C. §512(c)(3): identification of the copyrighted work, identification of the allegedly infringing material with enough detail for us to locate it, your contact information, a statement of good-faith belief, a statement under penalty of perjury that the information is accurate and you are authorized to act on the rights-holder's behalf, and your physical or electronic signature. We will respond as required by the DMCA. Repeat infringers' subscriptions and `installId`s will be terminated.

---

## 9. AI output disclaimer

> *Summary: AI hallucinates. Persona output is not journalism. Don't rely on it. Don't redistribute it as fact.*

The Service uses third-party large-language-model providers (Anthropic and xAI, at the time of this draft) and a third-party search provider (Brave Search or xAI Live Search) to generate persona commentary in real time. **All persona output is AI-generated and may be inaccurate, misleading, fabricated, biased, offensive, or otherwise wrong.** The Service may, in particular:

- Misattribute statements to real people whose voices appear in your captured audio;
- Produce confident-sounding "fact-checks" that are not factual;
- Repeat or extend errors present in the underlying transcription, search results, or model training data;
- Generate content that, if redistributed without context, could be defamatory of public or private figures named in the audio;
- Fail in ways unique to streaming AI ("hallucinations", premature conclusions, mid-sentence reversals).

You are responsible for verifying persona output before relying on it for any purpose, and for any consequences of redistributing persona output. The "Producer" persona's `factCheckMode` setting is calibrated for character (see [docs/DESIGN-PRINCIPLES.md §3](../DESIGN-PRINCIPLES.md#3-fact-check-sensitivity-is-per-pack-character-design)), not for newsroom-grade accuracy.

If you redistribute persona output (e.g., screenshot, quote-card, blog post, social-media share), you should label it as AI-generated commentary and not as a quote from any real person whose voice was captured.

---

## 10. Privacy

> *Summary: See the [Privacy Policy](PRIVACY-POLICY.md). It's the binding companion document.*

Our handling of your data is governed by our [Privacy Policy](PRIVACY-POLICY.md), which is incorporated into these Terms by reference. By using the Service, you consent to the data handling described there, including the limited server-side storage of your subscription email, license key, and weekly usage counter (Plus only); the per-request transient handling of your API keys (BYOK); the per-installation `installId` (Demo); and the in-memory streaming of audio and transcripts (all modes).

---

## 11. Third-party services

> *Summary: We depend on outside providers; their outages and rule changes flow through to you.*

Peanut Gallery depends on external services. **Their outages, terms, and policy changes flow through to you, and we do not guarantee any specific provider remains available.** Current providers (subject to change):

- **Deepgram** ([deepgram.com](https://deepgram.com)) — speech-to-text streaming
- **Anthropic** ([anthropic.com](https://anthropic.com)) — Claude models for the Producer + Joker personas and the optional Smart Director router
- **xAI** ([x.ai](https://x.ai)) — Grok models for the Troll + Sound-FX personas; optional Live Search for fact-checking
- **Brave Search** ([brave.com](https://brave.com)) — default search provider for fact-checking
- **Stripe** ([stripe.com](https://stripe.com)) — payment processing (Plus only)
- **Railway** ([railway.com](https://railway.com)) — backend hosting (Hosted Backend)
- **Vercel** ([vercel.com](https://vercel.com)) — Next.js application hosting
- **GitHub Pages** ([pages.github.com](https://pages.github.com)) — Marketing Site hosting
- **Resend** ([resend.com](https://resend.com)) — transactional email (license-key delivery, recovery, subscription notices). Messages are sent from `noreply@send.peanutgallery.live`; replies are routed to `legal@peanutgallery.live`.
- **Google Analytics** ([marketingplatform.google.com/about/analytics](https://marketingplatform.google.com/about/analytics)) — aggregate page-view metrics on the Marketing Site only (not in the Extension)

We do not negotiate any provider's terms on your behalf. Where the Extension forwards your own API keys to a provider in My-Keys Mode, your relationship with that provider is governed by your direct agreement with them. Where the Hosted Backend uses our keys (Demo Mode and Plus Mode), our agreement with that provider applies, and we pass through the provider's relevant constraints (rate limits, content policies, regional restrictions) to you.

If a provider's terms or applicable law require us to share user content with them to receive their service (e.g., the audio stream we forward to Deepgram for transcription), that sharing is necessary for the operation of the Service and you consent to it by using the Service.

---

## 12. Self-hosting and "Build Your Own Backend"

> *Summary: If you run your own backend, these Terms only cover the Extension. Your backend is yours.*

You may host your own backend implementation (see [docs/SELF-HOST-INSTALL.md](../SELF-HOST-INSTALL.md) and [docs/BUILD-YOUR-OWN-BACKEND.md](../BUILD-YOUR-OWN-BACKEND.md)) and point the Extension at it. When you do:

- These Terms continue to govern your use of the Extension binary distributed through the Chrome Web Store. The MIT License governs your use of the source code.
- These Terms do **not** make us responsible for the operation of your self-hosted backend, the data it processes, the providers it calls, or the users it serves.
- If your self-hosted backend offers Service to other people, you are operating a service to those people under your own terms and your own privacy posture, not ours. You may not use our trademarks to market a self-hosted instance as if it were the official Service.

---

## 13. Changes to the Service and to these Terms

> *Summary: Material changes get advance notice (30 days) and a refund window for paid subscribers. Other changes update on publish.*

### 13.1 Changes to the Service

The Service is under active development. We may add, change, deprecate, or remove features, personas, packs, providers, models, design treatments, prices, caps, or operating modes at any time. We aim to give meaningful advance notice for changes that materially reduce the value of an active Plus subscription.

### 13.2 Changes to these Terms

We may update these Terms. For **material changes** that adversely affect Plus subscribers (changes to pricing, the weekly cap, billing cadence, refund mechanics, scope of data collected, or third-party data sharing), we will email active subscribers at least **30 days** before the change takes effect and allow cancellation with a pro-rata refund of the current billing period. For non-material changes (clarifications, formatting, typo fixes, contact-information updates, or accommodations to changes in third-party providers we already disclose in §11), the change is effective on publication of an updated "Last updated" date.

Continued use of the Service after a change takes effect constitutes acceptance of the changed Terms. Your sole remedy for objecting to a change is to stop using the Service and, if you are a Plus subscriber, to cancel and request a refund as described in §6.6.

---

## 14. Disclaimer of warranties

> *Summary: Provided "as is." No warranties beyond those that can't legally be disclaimed.*

**THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AND QUIET ENJOYMENT.**

We do not warrant that the Service will be uninterrupted, timely, secure, or error-free; that any defect will be corrected; that the Service is free of viruses or other harmful components; that the Hosted Backend will reach any specific uptime; that any provider used by the Hosted Backend will remain available, accurate, or affordable; or that persona output will be accurate, lawful, or fit for any purpose. **The persona output is generated by third-party AI models and is subject to all of the limitations described in §9.**

Some jurisdictions do not allow the exclusion of certain implied warranties; in those jurisdictions, the foregoing disclaimers apply to the maximum extent permitted by law.

---

## 15. Limitation of liability

> *Summary: We are a small open-source project. Our maximum liability is what you've paid us in the prior 12 months (which is $0 for free-tier users).*

**TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW:**

1. **No indirect damages.** WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, EXEMPLARY, SPECIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

2. **Liability cap.** OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE, WILL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNT YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM AND (B) ONE HUNDRED U.S. DOLLARS ($100). FOR FREE-TIER USERS WHO HAVE NEVER PAID, THE CAP IS $100.

3. **Specific exclusions.** WITHOUT LIMITING THE FOREGOING, WE WILL NOT BE LIABLE FOR (a) AI OUTPUT INACCURACY OR FABRICATION; (b) ANY USE OF THE EXTENSION TO CAPTURE AUDIO IN VIOLATION OF RECORDING-CONSENT LAWS OR OTHER APPLICABLE LAW; (c) ANY THIRD-PARTY PROVIDER'S OUTAGE, DATA HANDLING, OR POLICY CHANGE; (d) ANY USE OF YOUR API KEYS BY A PROVIDER YOU SUPPLIED THE KEY TO; (e) ANY DAMAGE OR LOSS RESULTING FROM YOUR FAILURE TO SECURE YOUR LICENSE KEY OR YOUR API KEYS; OR (f) ANY DAMAGE OR LOSS RESULTING FROM YOUR REDISTRIBUTION OF PERSONA OUTPUT.

4. **Allocation of risk.** YOU ACKNOWLEDGE THAT THESE LIMITATIONS ARE A FUNDAMENTAL ELEMENT OF THE BARGAIN BETWEEN YOU AND US AND THAT THE SERVICE WOULD NOT BE PROVIDED WITHOUT THEM.

5. **Jurisdictional carve-out.** SOME JURISDICTIONS DO NOT ALLOW THE LIMITATION OR EXCLUSION OF LIABILITY FOR INCIDENTAL OR CONSEQUENTIAL DAMAGES. IN THOSE JURISDICTIONS, OUR LIABILITY IS LIMITED TO THE GREATEST EXTENT PERMITTED BY LAW.

6. **Statutory rights.** Nothing in these Terms excludes or limits any right or remedy that cannot lawfully be excluded or limited, including (where applicable) consumer-protection rights under U.S. state law, the U.K. Consumer Rights Act 2015, or the E.U. Consumer Sales Directive.

---

## 16. Indemnification

> *Summary: If your misuse of the Service gets us sued, you cover the bill.*

You will defend, indemnify, and hold harmless Seth Rininger and any of his employees, contractors, and agents from and against any third-party claim, demand, suit, proceeding, loss, liability, judgment, settlement, or expense (including reasonable attorneys' fees) arising out of or related to (a) your use of the Service, (b) your violation of these Terms (especially §5 Acceptable Use), (c) your violation of any law or any third party's rights (including intellectual-property, privacy, publicity, recording-consent, and contract rights), (d) any audio or content you direct the Extension to process, or (e) your redistribution of persona output. We may, at our option, assume the exclusive defense and control of any matter subject to indemnification by you, in which case you will cooperate with our defense.

---

## 17. Governing law and dispute resolution

> *Summary: U.S. consumer dispute clause; Seth's home state controls; small claims is preserved; jury trial is waived; specific carve-outs for IP and injunctions.*

### 17.1 Governing law

These Terms are governed by the laws of the **State of North Carolina**, U.S.A., without regard to conflict-of-laws principles. The U.N. Convention on Contracts for the International Sale of Goods does not apply.

### 17.2 Forum

Subject to §17.3, any dispute arising out of or related to these Terms or the Service must be brought exclusively in the state or federal courts sitting in **Macon County, North Carolina**, and you and we consent to personal jurisdiction and venue in those courts.

### 17.3 Informal resolution required

Before filing any action, you and we agree to attempt to resolve the dispute by good-faith negotiation. Either party may initiate that process by sending a written description of the dispute to the other (you to `legal@peanutgallery.live`; we to your last-known email on file). If the dispute is not resolved within 60 days of that notice, either party may proceed to litigation under §17.2 (or arbitration under §17.4 if the parties have agreed to arbitrate).

### 17.4 Arbitration / class-action waiver

`<TBD — Seth + counsel to decide whether to include a binding arbitration clause + class-action waiver. Pros: caps litigation cost on a small consumer product. Cons: enforceability varies by state; CA and several others have constraints; mass-arbitration is its own risk vector. Recommend counsel review and either (a) draft a clause modeled on the AAA Consumer Arbitration Rules or JAMS Streamlined Procedures, or (b) decide explicitly not to include one and document the reasoning. Until counsel advises, this section reads "no arbitration; small-claims court available; jury trial waived for any matter that cannot be heard in small-claims." >`

### 17.5 Small-claims preserved

Notwithstanding §17.2, either party may bring an individual action in small-claims court for any claim within the jurisdictional limits of that court.

### 17.6 Jury trial waiver

To the fullest extent permitted by applicable law, **YOU AND WE WAIVE ANY RIGHT TO A TRIAL BY JURY** for any dispute arising out of or related to these Terms or the Service. This waiver does not apply where prohibited by applicable law.

### 17.7 Equitable relief; intellectual-property carve-out

Nothing in this §17 prevents either party from seeking injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual-property rights, license-key system, or the security of the Hosted Backend.

---

## 18. Suspension and termination

You may stop using the Service at any time by uninstalling the Extension and (if applicable) cancelling your Plus subscription as described in §6.3. We may suspend or terminate your access to the Service at any time, with or without cause and with or without notice, for the reasons described in §6.7 or for any material breach of these Terms.

The following sections survive termination of these Terms for any reason: §1 (definitions), §5 (Acceptable Use, to the extent it limits ongoing use of any output you obtained), §6.6 (refunds owed), §8 (intellectual property and feedback license), §9 (AI output disclaimer), §10–§11 (privacy and third-party services for past data), §14 (warranty disclaimer), §15 (limitation of liability), §16 (indemnification), §17 (governing law and dispute resolution), §19 (general provisions), and any other provision that by its nature should survive.

---

## 19. General provisions

### 19.1 Entire agreement

These Terms, together with the Privacy Policy, the [MIT License](../../LICENSE) for the source code, and any other policies expressly incorporated by reference, constitute the entire agreement between you and us regarding the Service and supersede any prior agreement on the same subject.

### 19.2 Severability

If any provision of these Terms is held unenforceable, the remaining provisions remain in full force and effect, and the unenforceable provision will be modified to the minimum extent necessary to make it enforceable while preserving its intent.

### 19.3 No waiver

Our failure to enforce any provision is not a waiver of our right to enforce it later.

### 19.4 Assignment

You may not assign or transfer these Terms or your subscription without our prior written consent; any attempted assignment without consent is void. We may assign these Terms in connection with a sale, merger, or other change of control of the Service or the project, on notice to you.

### 19.5 Force majeure

We are not liable for any failure or delay in performance caused by events beyond our reasonable control, including but not limited to acts of God, war, terrorism, cyberattack, internet outage, hosting-provider outage, third-party AI provider outage, governmental action, labor stoppage, pandemic, or fire.

### 19.6 No third-party beneficiaries

These Terms do not create any rights in favor of any third party, except that our employees, contractors, and agents are intended third-party beneficiaries of §15 and §16.

### 19.7 Notices

We may give you notices by posting on the Marketing Site, by in-Extension banner, or by emailing the address on file (Plus subscribers). You may give us notice by emailing `legal@peanutgallery.live` _(TBD)_. Notices are effective on receipt for email and on publication for in-app and on-site notices.

### 19.8 Government users

The Service is "commercial computer software" and "commercial computer software documentation" as those terms are used in 48 C.F.R. §12.212 and 48 C.F.R. §227.7202. U.S. government users acquire only those rights expressly granted by these Terms.

### 19.9 Export controls

You agree to comply with all U.S. and other applicable export-control and sanctions laws in your use of the Service.

### 19.10 Headings

Section headings are for convenience only and do not affect interpretation.

---

## 20. Contact

Questions, cancellation requests, refund requests, accessibility requests, DMCA notices, and "I found a bug in these Terms" notes:

- General / billing / legal: `legal@peanutgallery.live` _(TBD)_
- Security disclosures: `security@peanutgallery.live` (see [SECURITY.md](../../.github/SECURITY.md))
- Urgent: `seth@peanutgallery.live` with `[urgent]` in the subject line

---

## Lawyer review checklist

This checklist is for the lawyer reviewing this draft. **It is not part of the published Terms** — strip this section before publishing.

### Hard placeholders resolved

- [x] **§1**: Seth's state of residence is **North Carolina** (confirmed 2026-04-21).
- [x] **§17.2**: Forum is **Macon County, North Carolina** (confirmed 2026-04-21).
- [x] **§11**: Transactional email provider is **Resend**; sender is `noreply@send.peanutgallery.live` (verified subdomain in Resend), with `Reply-To: legal@peanutgallery.live` (confirmed 2026-04-21).
- [x] **§1.3**: Plus + Demo are **United States only**; international users fork-and-self-host (confirmed 2026-04-21).
- [x] **§20**: Email aliases `legal@`, `privacy@`, `security@`, `seth@`, `noreply@` — provisioning in progress via Cloudflare Email Routing + Resend-verified sending domain.
- [ ] **§17.4**: Decide whether to include a binding arbitration / class-action-waiver clause. Draft it or document the decision not to.
- [ ] **§20 and headers**: Confirm `legal@peanutgallery.live`, `security@peanutgallery.live`, and `seth@peanutgallery.live` are provisioned, monitored, and have an SLA Seth can keep.

### Substantive items to confirm

- [ ] **§4 Demo Mode**: Confirm we can implement install-id revocation in time for v2.0 if abuse becomes real (currently aspirational; the limiter is in-memory and resets on redeploy).
- [ ] **§5.1 Recording consent**: Confirm the listed all-party-consent states are current. Confirm the disclaimer is sufficient given Chrome Web Store's user-data policy and California's AB 375 / CCPA notice obligations. **Critical**: this is the highest-liability section in the doc — review with full attention.
- [ ] **§6.1 Price changes**: 30 days' notice is the consumer norm; confirm CA ARL (Cal. Bus. & Prof. Code §17602) and similar state auto-renewal statutes don't require longer notice or a different format (e.g., a separate cancellation reminder with the cancellation link).
- [ ] **§6.3 Auto-renewal**: Confirm we're not required to send a separate pre-renewal notice each month under any state law where we have subscribers.
- [ ] **§6.4 Cap changes**: Confirm 30-day notice for cap reductions is consistent with §13.2.
- [ ] **§6.6 Refunds**: Confirm "no questions asked" refund policy is consistent with Stripe's chargeback dispute mechanics and doesn't expose us to bank-side reversals after we refund.
- [ ] **§8.2 Persona packs**: This is a right-of-publicity exposure. The personas are "inspired by" public figures and the system prompts include anti-impersonation guardrails (see [docs/packs/twist/RESEARCH.md](../packs/twist/RESEARCH.md) and the `directorHint` text in `lib/packs/*/personas.ts`). Confirm the disclaimer language is enough to fall within the U.S. parody / commentary fair-use doctrine and isn't actionable as right-of-publicity in CA, NY, FL, or TN (the four states with the strongest right-of-publicity statutes for living public figures). Howard Stern is a New York public figure; Calacanis / Wood / Wilhelm / Harris are CA-based public figures.
- [ ] **§9 AI output disclaimer**: Confirm sufficient under FTC AI-disclosure guidance and any state-level AI-content-disclosure rules (CA AB 2655 / SB 942 / etc., depending on the year of publication).
- [ ] **§14, §15**: Confirm the warranty disclaimer + liability cap are enforceable in Seth's chosen state of residence and in EU / UK consumer-rights regimes (where statutory rights override contract). UK Consumer Rights Act 2015 and the EU Consumer Sales Directive impose floor protections that supersede the disclaimer for consumer users.
- [ ] **§15.2 Liability cap**: Confirm $100 floor for free-tier users is defensible and not "unconscionable" under state consumer-protection laws.
- [ ] **§16 Indemnification**: Confirm enforceable for consumer users (some states limit consumer indemnification clauses); narrow if needed.
- [ ] **§19.4 Assignment**: Confirm the assignment language won't trip up an acquihire / asset sale of the project.
- [ ] **Chrome Web Store policy parity**: Confirm these Terms are consistent with everything claimed in the CWS listing's "Privacy practices" tab (see [`marketing/CWS-COMPLIANCE-CHECKLIST.md`](../../marketing/CWS-COMPLIANCE-CHECKLIST.md)). The CWS reviews the privacy disclosures against the manifest's permissions; mismatches between these Terms and the CWS listing have been a fast path to delisting.
- [ ] **EU / UK consumer notes**: Confirm whether we need an EU representative under GDPR Art. 27 or a UK representative; we believe we are below the threshold but counsel should confirm.

### Items to publish alongside this document

- [ ] **A published TOS surface.** Today's repo has the Privacy Policy at `app/privacy/page.tsx` + `site/privacy/index.html` but **no published Terms surface.** Decide whether to: (a) publish at `site/terms/index.html` + `app/terms/page.tsx` mirroring the privacy pattern, (b) publish only on the GitHub Pages site, or (c) link directly from the CWS listing to the GitHub repo's `docs/legal/TERMS-OF-SERVICE.md` (works but looks unfinished). Recommend (a) before v2.0 launch.
- [ ] **Cookie disclosure.** The Marketing Site loads Google Analytics (G-3R9CK4LRGF). Publish a cookie banner consistent with EU ePrivacy + UK PECR. The current site has no banner.
- [ ] **CWS listing audit.** Run [`marketing/CWS-COMPLIANCE-CHECKLIST.md`](../../marketing/CWS-COMPLIANCE-CHECKLIST.md) against the new Terms before re-submitting any listing edit.

---

*End of draft. See the companion [Privacy Policy](PRIVACY-POLICY.md) for data-handling specifics.*
