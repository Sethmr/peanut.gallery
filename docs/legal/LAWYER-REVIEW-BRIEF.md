# Lawyer review brief — Peanut Gallery legal docs

> **Purpose.** This brief is for outside counsel reviewing the Terms of Service and Privacy Policy drafts in this folder. It explains what the product does, what data it handles, what changed in this pass, what Seth has already decided, and where counsel still needs to make calls. Start here; it will save you time.

**Date:** 2026-04-21
**Client:** Seth Rininger, sole proprietor, **Macon County, North Carolina**, U.S.A.
**Governing law proposed:** North Carolina
**Forum proposed:** state or federal courts sitting in Macon County, NC
**Product status:** v1.6.0 shipped; v1.9.x "Peanut Gallery Plus" (paid subscription) lands on the v2.0 critical path. No paid user has been invoiced yet. Privacy Policy + Terms of Service are drafts — nothing is effective until counsel signs off.

---

## 1. Product in one paragraph

Peanut Gallery is an open-source Chrome extension (MV3, distributed through the Chrome Web Store) plus a Next.js backend hosted on Railway. The Extension captures audio from any browser tab the user authorizes, streams it to Deepgram for live transcription, then runs the transcript through Anthropic Claude and xAI Grok to produce real-time commentary from four AI "personas" displayed in a side panel. Personas are "inspired by" two sets of public figures — the Howard Stern Show on-air crew (default) and the *This Week in Startups* hosts — with anti-impersonation guardrails in the system prompts. A $8/month subscription ("Peanut Gallery Plus") pays for the Hosted Backend's API keys with a 16 h/week rolling cap. BYOK and self-host paths are always free.

**Geographic scope (new 2026-04-21):** **Peanut Gallery Plus and the Demo allowance backed by our hosted API keys are offered only to users in the United States.** The Extension, My-Keys Mode, and the right to self-host the backend are available globally under the MIT license. The U.S.-only restriction is a deliberate business decision — a solo builder cannot maintain compliance across GDPR, UK GDPR, LGPD, PIPEDA, and every other extraterritorial data-protection regime while also shipping software. International users are directed to [`docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md`](../SELF-HOST-FOR-INTERNATIONAL-USERS.md).

## 2. The three operating modes

| Mode | API keys | Identity sent to our backend | Data we persist server-side |
|---|---|---|---|
| Demo (US-only) | Ours | Per-install UUID ("installId") in the `X-Install-Id` header | Usage counter; purged 30 days after allowance exhaustion |
| My-Keys (BYOK, global) | User's, per-request | None | Nothing |
| Plus (US-only) | Ours, metered | License key in `X-Subscription-Key`; email tied to key | Email + license key + Stripe sub ID + weekly usage counter (ms); encrypted at rest |

Audio and live transcript pass through backend RAM and are discarded at session end in all modes. Feedback signals (upvote / downvote / pin / quote-card) are logged server-side for 90 days with the `installId` only — not tied to email or license key.

## 3. What Seth has already decided (you don't need to weigh in on these)

- **NC governing law + Macon County forum** — baked into ToS §17.1–17.2.
- **US-only paid tier.** ToS §1.3 frames this in Art. 3(2)-friendly language: we don't offer, market, or target non-U.S. users. Users outside the U.S. are directed to fork-and-self-host.
- **Resend** for transactional email. Verified sending domain is the `send.peanutgallery.live` subdomain — sender address is `noreply@send.peanutgallery.live`; replies route to `legal@peanutgallery.live`. Subdomain sending is a deliberate deliverability choice (industry norm). (Privacy §11)
- **Cookie-consent banner shipped** on the marketing site and mirrored in the Next.js app. Google Analytics only loads after an affirmative Accept click; choice persists in `localStorage`. IP anonymization is on; no advertising features, no Google Signals.
- **Published surfaces live:**
  - `www.peanutgallery.live/privacy/` (GitHub Pages, `site/privacy/index.html`)
  - `www.peanutgallery.live/terms/` (GitHub Pages, `site/terms/index.html`)
  - `peanutgallery.live/privacy` (Next.js, `app/privacy/page.tsx`, currently behind 308 redirect)
  - `peanutgallery.live/terms` (Next.js, `app/terms/page.tsx`, currently behind 308 redirect)
- **Privacy + Terms links** added to the Extension's Settings drawer footer.
- **Email aliases live:** Cloudflare is authoritative; inbound `privacy@`, `legal@`, `security@`, `seth@peanutgallery.live` route via **Cloudflare Email Routing** to Seth's personal inbox. Outbound Plus email sends from `noreply@send.peanutgallery.live` via **Resend** with SPF + DKIM + DMARC (p=none initially).
- **Publish posture**: Seth elected to publish as if Phase 2 is already shipped. The Privacy Policy speaks in present tense about encryption-at-rest and durable storage. Phase 2 shipping will close the small gap between doc and code within a short window.

## 4. Highest-priority items still for counsel

In rough order of legal exposure:

### 4.1 Persona right-of-publicity (ToS §8.2)

Personas are inspired by living public figures. The system prompts include anti-impersonation guardrails (see `lib/packs/*/personas.ts` and `docs/packs/twist/RESEARCH.md`). The "inspired by" disclaimer is modeled on U.S. parody / commentary fair-use doctrine, but NY (Howard Stern's state) and CA (TWiST hosts' state) have statutory right-of-publicity regimes that can reach commentary-adjacent uses. **Please confirm the disclaimer is sufficient, or recommend a tighter framing.** A takedown path is already in place at `legal@peanutgallery.live`.

### 4.2 Recording-consent exposure (ToS §5.1, Privacy §15 on the published page)

The Extension can capture audio from any tab the user authorizes. We've pushed responsibility onto the user as clearly as we know how. NC itself is a one-party-consent state (N.C.G.S. §15A-287) which helps the venue, but a U.S. user in CA / FL / IL / MD / MA / MT / NH / NV / PA / WA may violate their own state's two-party statute by using the Extension. **Please confirm the disclaimer is sufficient under: (a) California Invasion of Privacy Act (Penal Code §§631–632), (b) Illinois Eavesdropping Act, and (c) federal Wiretap Act (18 U.S.C. §2511). If the answer is "add a runtime consent gate," Seth can build one into the Start Listening flow before v2.0.

### 4.3 US-only gating mechanics (new — ToS §1.3)

The current ToS gates Plus on a user representation + Stripe's billing-country data. Counsel to confirm:

- Is the billing-country check + representation the right gating mechanism, or should we add an IP-geolocation soft gate as belt-and-suspenders (in addition)?
- Is the "refund + terminate any subscription whose billing address is outside the U.S." language enough to avoid *accidentally* offering the service in an EU member state in a way that triggers Art. 3(2)?
- Should the marketing site display the U.S.-only notice on the landing page and pricing CTA, not just in the ToS + Privacy Policy?

### 4.4 NC consumer-law exposure (ToS §14, §15)

NC's Unfair and Deceptive Trade Practices Act (**N.C.G.S. §75-1.1**) allows treble damages + attorney fees for unfair/deceptive practices and is generally not waivable by contract. **Please confirm the warranty disclaimer + liability cap don't conflict with UDTPA — or add a carve-out if they do.** The cap is also capped at the greater of the user's last-12-months paid amount or $100.

### 4.5 Arbitration + class-action waiver (ToS §17.4)

Still a `<TBD>`. NC is friendly to FAA-preempted arbitration clauses and class-action waivers post-*Concepcion*, but this is ultimately a drafting + tradeoff call. Please include one or document the decision not to.

### 4.6 CCPA / CPRA posture (Privacy §6)

We say we do not sell or share personal information for cross-context behavioral advertising. **Please confirm** — especially whether transcript snippets forwarded to Anthropic / xAI / Brave for inference constitute "sharing" under CPRA's expanded definition (we think inference-only passthrough is out of scope; please confirm). Confirm no CCPA "Do Not Sell or Share" link is required on the marketing site given our disclosed practices.

### 4.7 Auto-renewal compliance (ToS §6.3)

30 days' email notice for material price / cap changes is set. No separate per-month renewal reminder is sent. California is the most aggressive state on this (CA ARL / Bus. & Prof. Code §17602, with 2026 amendments) and all our paid users may be in CA. **Please confirm we don't need a separate pre-renewal notice for monthly billing, given the short cycle and the prominent cancel UX.**

### 4.8 Chrome Web Store listing parity

Google reviews the CWS "Privacy practices" tab against the manifest's permissions. Any mismatch between the CWS listing and this Privacy Policy is a fast path to delisting. Before CWS re-submission, we should run [`marketing/CWS-COMPLIANCE-CHECKLIST.md`](../../marketing/CWS-COMPLIANCE-CHECKLIST.md) against the new text and update the CWS listing in lockstep.

### 4.9 DMCA designated agent

Register with the U.S. Copyright Office ($6 every three years). Confirm needed given our user-generated-content surface (upvoted/pinned snippets forwarded to `/api/feedback`). If so, who is the agent — Seth directly or a service like Cogent?

### 4.10 Residual `<TBD>`s in the drafts

- ToS §17.4 — arbitration / class-action waiver drafting.
- Anything else you want cleaned up before the first paid customer.

## 5. What Seth has shipped alongside the docs

For context when you review:

- **Marketing-site cookie banner** — defaulted to declined; Google Analytics does not fire until the user clicks Accept.
- **Published Terms surface at `/terms/`** — the prior draft had no ToS surface; this ships one that mirrors the broadsheet privacy page.
- **US-only self-host guide** at `docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md` — directs non-U.S. users to BYOK, self-host, or fork. Three options, plain English.
- **Extension drawer footer** — now carries direct links to Privacy, Terms, and Security.
- **GA configured with `anonymize_ip: true`** and no advertising / remarketing / Signals features.

## 6. Where everything lives (for your citations)

- **Canonical Terms draft:** [`docs/legal/TERMS-OF-SERVICE.md`](TERMS-OF-SERVICE.md)
- **Canonical Privacy draft:** [`docs/legal/PRIVACY-POLICY.md`](PRIVACY-POLICY.md)
- **Published Terms (GitHub Pages, live):** `site/terms/index.html`
- **Published Terms (Next.js):** `chrome-extension/app/terms/page.tsx`
- **Published Privacy (GitHub Pages, live):** `site/privacy/index.html`
- **Published Privacy (Next.js):** `chrome-extension/app/privacy/page.tsx`
- **International-users guide:** [`docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md`](../SELF-HOST-FOR-INTERNATIONAL-USERS.md)
- **Cookie banner component (Next.js):** `components/CookieBanner.tsx`
- **Cookie banner markup (GH Pages):** inline in `site/index.html`
- **Subscription architecture:** [`docs/SUBSCRIPTION-ARCHITECTURE.md`](../SUBSCRIPTION-ARCHITECTURE.md)
- **Design principles:** [`docs/DESIGN-PRINCIPLES.md`](../DESIGN-PRINCIPLES.md)
- **Security policy:** [`.github/SECURITY.md`](../../.github/SECURITY.md)
- **CWS compliance checklist:** [`marketing/CWS-COMPLIANCE-CHECKLIST.md`](../../marketing/CWS-COMPLIANCE-CHECKLIST.md)
- **Manifest:** [`extension/manifest.json`](../../extension/manifest.json)
- **Feedback endpoint:** [`app/api/feedback/route.ts`](../../app/api/feedback/route.ts)
- **Subscription library:** [`lib/subscription.ts`](../../lib/subscription.ts)
- **Free-tier limiter:** [`lib/free-tier-limiter.ts`](../../lib/free-tier-limiter.ts)

## 7. Turnaround + billing

Seth wants to land v2.0 with a counsel-blessed ToS, Privacy Policy, cookie banner, and any runtime consent gate you think §4.2 needs. The drafts are intentionally exhaustive so your pass is mostly redlines on specific paragraphs rather than a rewrite. Every remaining `<TBD>` marker signals a decision counsel needs to make explicitly; every `[x]` marker in the doc checklists signals a decision Seth has already made.

Thanks.
— Seth
