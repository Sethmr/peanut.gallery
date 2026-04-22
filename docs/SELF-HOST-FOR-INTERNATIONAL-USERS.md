# Self-hosting Peanut Gallery outside the United States

> **Who this is for.** Anyone outside the United States who wants to use Peanut Gallery. The Chrome extension is globally available under the MIT license, but the paid **Peanut Gallery Plus** subscription and the Demo allowance backed by our hosted API keys are offered **only to U.S. users**. If that's you, this is your guide.

> **Why we draw the line at the U.S. border.** Peanut Gallery is run by one person (Seth Rininger, a sole proprietor in North Carolina). Offering a paid service internationally would pull him under GDPR, UK GDPR, LGPD, PIPEDA, the Privacy Act 1988, and a long list of other data-protection regimes — each with its own appointment-of-representative, data-subject-rights, and breach-notification obligations. A solo builder can't run a compliant service in every one of those jurisdictions and still ship software. So the deal is simple: **the code is yours — run it however you like, wherever you live. We just don't operate the paid managed service for you.**

**Last updated:** 2026-04-21

---

## Your three options

### Option 1 — My-Keys Mode (easiest, no hosting)

Install Peanut Gallery from the Chrome Web Store, open the **Backend & keys** drawer, and paste your own API keys for Deepgram, Anthropic, and xAI. The extension's offscreen document forwards those keys per-request; the Hosted Backend at `api.peanutgallery.live` acts as a dumb passthrough and stores nothing. When you use Peanut Gallery this way, **no personal data about you is stored on our backend** — your keys go directly to the providers you chose, and the providers' own privacy policies govern what they do with the audio.

This works anywhere in the world and does not require anything from you besides API keys with the relevant providers.

**What to do:**

1. Sign up for the three required providers and get API keys:
   - [Deepgram](https://console.deepgram.com/signup) — speech-to-text (~$200 free credit)
   - [Anthropic](https://console.anthropic.com/settings/keys) — Claude Haiku (free tier + pay-as-you-go)
   - [xAI](https://console.x.ai/) — Grok 4.1 Fast (free tier)
   - Optional: [Brave Search](https://api.search.brave.com/) — fact-check (free up to 2,000 queries/month)
2. Install Peanut Gallery from the Chrome Web Store.
3. Open the side panel → gear icon → **Backend & keys** → paste each key.
4. Start listening. Nothing about you touches `api.peanutgallery.live` beyond the session routing headers.

**Caveats:** You're a controller of the personal data you capture (audio, transcripts) under your own jurisdiction's laws. If you're in the EU and you record a conversation involving EU data subjects, GDPR applies to *you*. Whether that's OK is between you and your lawyer.

### Option 2 — Self-host the reference backend

If you want the full hosted-style experience but in your own jurisdiction, clone the repo and run the Next.js backend yourself. This is a ~30-minute deploy to Railway, Vercel, Fly, Render, or anything that runs Node.js and can connect to Deepgram.

**What to do:**

1. Follow [`docs/SELF-HOST-INSTALL.md`](SELF-HOST-INSTALL.md) for a Railway deploy. Substitute Railway for any U.S. or EU-region hosting provider you prefer — Fly.io in Frankfurt, Vercel in Dublin, Hetzner, Scaleway, etc.
2. Point your Chrome extension at your own backend URL via the **Backend & keys** drawer → **Server URL**.
3. When you self-host, **you** are the controller of:
   - Audio streamed to your backend
   - Transcript held in RAM while a session is live
   - Any operational logs you enable
   - Any subscription identifiers you choose to run (Plus is off by default; see below)
4. You take on data-protection obligations that flow from the controllership role. For EU / UK users that typically includes:
   - Publishing your own privacy notice on a domain you control
   - Recording processing activities (GDPR Art. 30) if you cross the thresholds
   - Appointing an EU / UK representative (GDPR Art. 27 / UK equivalent) if you're outside those jurisdictions but process their residents' data
   - Honoring data-subject rights (access, deletion, rectification, portability, objection)
   - Having a lawful basis for each processing activity
   - Breach notification within 72 hours of awareness

Self-hosting is the right move if you're running Peanut Gallery for yourself, your household, or a tight group of people who have all consented. It's a serious lift if you're running it as a service for strangers.

### Option 3 — Fork and rebrand (Plus-style subscription, your business)

If you want a Plus-style subscription product in your country — metered hours, license keys, Stripe checkout, all the Phase 2+ pieces in this repo — fork the project under a different name and run it as your own business. The MIT license allows this; we encourage it.

**What to do:**

1. Fork [`github.com/Sethmr/peanut.gallery`](https://github.com/Sethmr/peanut.gallery) and your-name it. Don't call your fork "Peanut Gallery" or use the Peanut mascot artwork — those are our reserved marks under [Terms §8.4](legal/TERMS-OF-SERVICE.md). Everything else is MIT-licensed and yours to reshape.
2. Stand up a Stripe account in your country (Stripe is available in [~50 countries](https://stripe.com/global) at the time of writing).
3. Read [`docs/SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) — it documents Phase 1 (in-memory + env whitelist), Phase 2 (durable storage + encryption at rest), Phase 3 (real Stripe integration), and Phase 4 (transactional email). Implement the phases in order. Phase 1 is already shipped in the repo you forked.
4. Write your own Privacy Policy and Terms of Service for your fork. You can use ours as a starting template, but the legal context will differ — you will need a lawyer in your jurisdiction to review it, the same way we needed one in ours.
5. Ship it. Tell us what you named it — we'll link to healthy regional forks from the main README, and we're happy to hear from people running it at scale.

**What forking does not do:** it does not transfer our obligations to you, and it does not make our Hosted Backend available to your users. Your fork is a new Service under your name, operated by you.

---

## Common questions

### "Can I subscribe to Peanut Gallery Plus if I'm a U.S. citizen currently living abroad?"

Plus is gated on your **billing address**, which Stripe collects at checkout. If your card's billing address is in the U.S., it works. If it's not, Stripe will route you to a checkout that we don't accept, and we'll refund + terminate if you somehow slip through.

### "Can I VPN my way around the restriction?"

You can bypass the extension-side mode selector by editing `chrome.storage.local`. What you can't bypass is the billing-address check at Stripe checkout and the U.S.-only representation you make in [Terms §1.3](legal/TERMS-OF-SERVICE.md#13-geographic-availability--united-states-only). We may revoke any license key whose underlying subscription has a non-U.S. billing address. Please don't make us.

### "Is there a plan to expand to other countries?"

Not in the v2.0 launch window. The one-solo-builder constraint is real, and international compliance is the kind of lift that would eat the entire quarter. If a healthy regional fork emerges and wants to coordinate (e.g., share persona-prompt improvements under MIT), we're open to that conversation.

### "What if I'm in the EU and I want to run Peanut Gallery against my own data?"

Option 1 (My-Keys Mode) is the cleanest path. No personal data about you goes through our backend, and your relationship with Deepgram / Anthropic / xAI / Brave is direct and governed by their own privacy policies, each of which has an EU / UK compliance posture.

### "What if I want a hosted Plus-style experience in Europe?"

Today, fork it (Option 3). Tomorrow, maybe — if someone forks it well and wants to federate, we'll figure out the interface.

---

## Related docs

- [`docs/SELF-HOST-INSTALL.md`](SELF-HOST-INSTALL.md) — step-by-step Railway deploy of the reference backend
- [`docs/BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md) — wire protocol for alternative-language backends
- [`docs/SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) — how the paid tier is engineered
- [`docs/legal/TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md) — full Terms of Service; §1.3 explains the U.S.-only policy
- [`docs/legal/PRIVACY-POLICY.md`](legal/PRIVACY-POLICY.md) — full Privacy Policy
- [`LICENSE`](../LICENSE) — MIT license that makes forking legal

Questions? Open a discussion on [GitHub Discussions](https://github.com/Sethmr/peanut.gallery/discussions) or email `legal@peanutgallery.live`.
