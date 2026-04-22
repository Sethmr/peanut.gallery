# Peanut Gallery Plus — Subscription Architecture

**Status:** Phase 1 scaffold shipped (2026-04-21). Phases 2–4 tracked as Linear tickets; real payments + identity land post-canary once `STRIPE_ENABLED=true` + email infra are in place.

**Living document.** Every change to the subscription contract — price, cap, flow — lands here first, then in code.

---

## North star

Peanut Gallery Plus is an **accessibility tier, not a profit center.** It exists so non-technical users can reach the product without juggling API keys. Over time, the goal is to drive price DOWN (cheaper underlying APIs, more efficient Director, cached responses) so the subscription can cover more hours for less money. Anyone who prefers to fund their own usage via BYOK always has that option — open-source-first stays the core posture.

Business outcome targets (in priority order):

1. **Non-techs can try the product without signing up.** One-off 15-minute trial per install.
2. **Non-techs who like it can keep using it.** $8/month → 16 h/week of hosted transcription + persona fires. No ads. No data mining.
3. **Techs keep BYOK unchanged.** Self-hosters + key-pasters see zero regression.
4. **We don't lose money on subscribers at scale.** Math is in [§ Economics](#economics) — at today's API rates, 16 h/week costs ~$5.40/month at the backend, leaving ~$2.60/subscriber for infrastructure + dev time. Thin margin by design.

**Not** a goal: maximize ARPU, run paid acquisition, add tiers. If economics improve and we can lower the price, we do — not raise the cap.

---

## The three backend modes

Users pick via a segmented control at the top of the Backend & keys drawer.

| Mode | Who it's for | What it sends | What it consumes |
|---|---|---|---|
| **Demo** | First-time visitors | `X-Install-Id` | Free-tier allowance (15 min, **one-off**, lifetime) |
| **My keys** (BYOK) | Techs + heavy users | Their API keys (`X-Deepgram-Key`, `X-Anthropic-Key`, etc.) | Their own provider accounts |
| **Plus** | Non-techs, casual users | `X-Subscription-Key` | Weekly-hours ledger on the subscription (16 h/week cap) |

When **Plus** is active AND the user has BYOK keys filled in too, a secondary "Use with: [Subscription \| My keys]" sub-toggle appears. Picking "My keys" collapses the session to effective-BYOK — no subscription hours are consumed. The user can flip between the two without losing either configuration.

---

## Identity — license key + email recovery

Signup flow:

1. User clicks **Subscribe** in the drawer → extension prompts for email → `POST /api/subscription/checkout` with that email.
2. Backend creates a Stripe Checkout Session for the `Peanut Gallery Plus` product (config: $8/mo, monthly billing, no trial).
3. User completes payment on Stripe's hosted page.
4. Stripe fires `checkout.session.completed` → backend webhook receives it → generates a license key (`pg-xxxx-xxxx-xxxx` — 12 hex chars in three groups) → persists `{key, email, stripeSubId, createdAt}` → emails the key to the user's signup email.
5. User pastes the key into the extension → extension stores it in `chrome.storage.local` as `pgSubscriptionKey` → subsequent `/api/transcribe` calls carry it as `X-Subscription-Key`.

Recovery flow (user lost their key):

1. User clicks **Manage / Email me my key** in the drawer.
2. Extension prompts for the signup email → `POST /api/subscription/manage` with `{email, action: "recover_key"}`.
3. Backend verifies an active subscription exists for that email → emails the current key.
4. If no subscription matches, email says "no subscription on file for this address; check the address you used at signup."

Cancellation flow:

1. User clicks **Manage / Cancel** → backend `POST /api/subscription/manage` with `{email, action: "cancel"}`.
2. Backend verifies the subscription → emails a Stripe Customer Portal link (one-time, signed).
3. User clicks the link → Stripe's hosted UI → cancels.
4. Stripe fires `customer.subscription.deleted` → webhook marks the key `revoked: true` → validator starts returning `INVALID_KEY` on the next call. Extension surfaces the 402, user sees "subscription ended — paste your own keys or resubscribe."

**Why license key and not magic link / OAuth?**

- License key is portable: user pastes once per device, done. Magic link would need deep-link capture in MV3 (fragile).
- License key respects Peanut Gallery's "no account system creep" principle — no login state, no session tokens, no OAuth callback URLs. The key IS the identity.
- Non-techs who might choke on "API key" don't here — the UX framing is "paste the code we emailed you" (like a coupon), not "enter your subscription API token."
- Email handles identity verification at the security-perimeter events (signup, recovery, cancel) only. Daily use doesn't touch it.

---

## Data model

### `lib/subscription.ts` — in-memory Phase-1

```ts
interface UsageEntry {
  usageMs: number;
  weekStart: number;  // rolls at weekStart + 7 days
}

globalThis.__pg_subscription_store = {
  usage: Map<licenseKey, UsageEntry>;
  whitelist: Map<licenseKey, { email: string }>;
  whitelistLoadedAt: number;
};
```

- `whitelist` is loaded from `SUBSCRIPTION_KEYS_WHITELIST` env var at cold-start. Format: `pg-xxxx-xxxx-xxxx=alice@example.com,pg-yyyy-yyyy-yyyy=bob@example.com`.
- `usage` is a process-local map. Resets on redeploy — acceptable trade-off for Phase 1 pre-Stripe. Phase 2 swaps for persistent storage.

### Phase 2+ — persistent storage

SQLite on Railway volume mount, schema:

```sql
CREATE TABLE subscriptions (
  license_key   TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  stripe_sub_id TEXT,
  created_at    INTEGER NOT NULL,
  cancelled_at  INTEGER,
  status        TEXT CHECK (status IN ('active','paused','revoked')) NOT NULL
);

CREATE TABLE subscription_usage (
  license_key   TEXT NOT NULL,
  week_start    INTEGER NOT NULL,
  usage_ms      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (license_key, week_start)
);

CREATE INDEX idx_subs_email ON subscriptions(email);
CREATE INDEX idx_usage_week ON subscription_usage(week_start);
```

SQLite because: zero ops, file-based, works on Railway's single-instance deploy, restores from backup trivially. Grows to Postgres when multi-instance becomes real.

---

## Endpoints

All defined in `app/api/subscription/`.

| Endpoint | Method | Auth | Phase | Description |
|---|---|---|---|---|
| `/api/subscription/status` | GET | `X-Subscription-Key` | 1 | Returns SubscriptionStatus (valid, usedMs, remainingMs, resetAt, email). Extension polls on session start + periodically in drawer. |
| `/api/subscription/checkout` | POST | — | 1 stub, 3 real | Body: `{email}`. Returns `{checkoutUrl}`. Phase 3: creates real Stripe Checkout Session. |
| `/api/subscription/manage` | POST | — | 1 stub, 3 real | Body: `{email, action: "recover_key"\|"cancel"\|"billing"}`. Phase 3: mails magic link. |
| `/api/subscription/webhook` | POST | Stripe signature | 1 stub, 3 real | Stripe event receiver. Phase 3: verifies signature + persists subscription state. |

See the route files for the exact wire contracts.

---

## Phases

### Phase 1 — Scaffold (shipped 2026-04-21)

- Free-tier limiter converted to one-off (lifetime) trial
- `lib/subscription.ts` module (in-memory + env-whitelist)
- Four API endpoints wired (status real; checkout/manage/webhook stubbed)
- Extension UI: three-mode segmented control + subscription key input + progress bar + manage/subscribe buttons
- Feature-flagged on backend: `ENABLE_SUBSCRIPTION=true` activates the gate
- Test path: operator adds `SUBSCRIPTION_KEYS_WHITELIST=pg-test-0000-0001=me@example.com` → pastes key in extension → traffic flows

### Phase 2 — Persistent identity (Linear ticket SET-25)

- SQLite store (or Turso, or Neon Postgres — decide at ticket time based on Railway constraints)
- License-key generator (cryptographically-random 12 hex chars, `pg-` prefix, Luhn-like checksum on the last char for typo detection)
- Admin script: `npm run subscription:issue -- --email alice@example.com` → creates a row + prints the key
- Migrate the env-whitelist stub to read from the store

### Phase 3 — Stripe integration (Linear ticket SET-26)

- `STRIPE_ENABLED=true` flag gates the real path
- Checkout session creation (real) → webhook signature verification → on `checkout.session.completed`: issue key via Phase-2 generator + email to user
- Cancel via Stripe Customer Portal (hosted, no UI work on our side)
- Webhook-idempotency key handling (Stripe retries; don't issue duplicate keys on re-delivery)
- Dead-letter log: if email send fails on key issuance, persist the key + retry the email — never lose a paid customer's key

### Phase 4 — Email infrastructure (Linear ticket SET-27, shipped 2026-04-21)

- **Provider choice: Resend** (default) with Postmark fallback (`EMAIL_PROVIDER=postmark`). Resend won on DX (clean HTTP API, no SDK needed) + free tier (3k/mo covers early subscriber stage); Postmark stays drop-in for IP-reputation insurance. Both providers speak HTTP+JSON in nearly the same shape; the abstraction in [`lib/email.ts`](../lib/email.ts) is a single switch on `EMAIL_PROVIDER`, no provider-specific dependencies.
- **Templates** in [`lib/email-templates.ts`](../lib/email-templates.ts) — four pure functions returning `{subject, html, text}`:
  - `renderWelcomeEmail` — `Welcome to Peanut Gallery Plus — here's your license key`. Sent from the Phase-3 webhook on `checkout.session.completed`. Includes the key + paste instructions + support email.
  - `renderRecoveryEmail` — `Your Peanut Gallery Plus license key`. Sent from `/api/subscription/manage` action `recover_key`.
  - `renderCancellationEmail` — `Your Peanut Gallery Plus subscription is cancelled`. Sent from the Phase-3 webhook on `customer.subscription.deleted`.
  - `renderMagicLinkEmail` — `Manage / Cancel / Update billing your Peanut Gallery Plus subscription` (intent picks the subject + intro). Carries a Stripe Customer Portal URL.
- **Transport** in [`lib/email.ts`](../lib/email.ts) — public API: `sendWelcomeEmail`, `sendRecoveryEmail`, `sendCancellationEmail`, `sendMagicLinkEmail`. Each returns `EmailSendResult { ok, id, error, skipped }`. Logs `subscription_email_sent` / `subscription_email_failed` / `subscription_email_skipped` events with masked email addresses (`al***@example.com`) — never logs the full address.
- **Failure posture (load-bearing).** Send failures NEVER throw and NEVER cause a non-2xx upstream response. Stripe webhook posture: persist the issued key BEFORE attempting the welcome send so a delivery failure doesn't lose the key; on send failure log loud + still return 200 so Stripe doesn't retry-and-dupe. Manage posture: return `{ ok: true, sent: false, message }` on failure so the user-facing UI doesn't 500 — the user gets a polite "we logged your request" message and the failure shows up in the pipeline log for follow-up.
- **Privacy: no enumeration leak.** `recover_key` and the magic-link actions return the same response shape whether or not the email is on file (the message says "if an active subscription exists for that email, we've sent the link"). Stops casual subscriber-list mining via the manage API.
- **Self-host opt-out.** `DISABLE_EMAIL_SEND=true` short-circuits all sends with a `subscription_email_skipped` log line + `{ ok: true, skipped: true }` return — operators running Plus internally without SMTP plumbing can hand-deliver keys by reading the log events.
- **Domain verification.** SPF / DKIM / DMARC records on the sending domain are a one-time DNS setup tracked in `docs/GITHUB-MANUAL-STEPS.md` (operator task). Not gated by code — the provider rejects unverified senders directly.
- **Env wiring.** `EMAIL_API_KEY`, `EMAIL_FROM` (default `subscriptions@peanutgallery.live`), `EMAIL_REPLY_TO` (default `support@peanutgallery.live`), `EMAIL_PROVIDER` (default `resend`), `DISABLE_EMAIL_SEND` (default off), `STRIPE_PORTAL_URL` (optional; consumed by `manage` action `cancel`/`billing`). All documented in [`.env.example`](../.env.example).
- **All transactional; marketing email never sent from this service.**

---

## Economics

Rough per-subscriber-month numbers at 2026-04 API rates, assuming a 16 h/week cap fully used:

| Component | Cost per hour | Monthly @ ~64 h/mo |
|---|---:|---:|
| Deepgram Nova-3 (streaming) | $0.258 | $16.51 |
| Anthropic Haiku (Director + producer + joker) | $0.028 | $1.79 |
| xAI Grok 4.1 Fast (troll + sound FX) | $0.012 | $0.77 |
| Brave Search (fact-check queries) | $0.003 | $0.19 |
| **Subtotal API** | | **$19.26** |

**That's over $8.** How does this work?

1. **Most subscribers don't use the full cap.** If typical usage is 8 h/week (half), monthly cost drops to ~$9.60 — still slightly over. If it's 4 h/week (typical), drops to $4.80.
2. **v1.7 GA will cut Director cost.** Smart Director v3 on Cerebras Llama 3.1 8B (~3× faster, ~10× cheaper than Haiku for the router) drops Director spend by ~$0.02/hr — not load-bearing alone.
3. **The real savings are in Deepgram.** Nova-3 is premium. Nova-2 / Whisper variants cut transcription cost by 3–5× at a quality cost we can probably absorb. Tracked as a v2.x cost-efficiency initiative.
4. **"Not a profit center" means we accept losses.** If the math doesn't work at scale, the answer is "drive cost down," not "raise the price." Seth has authorized running the product at a loss while we learn what users want.

**Failure case:** if subscribers heavily concentrate at the cap (all 16 h/week consumed) AND we can't drive API cost down, the math breaks. Signals to watch:

- P95 hours-used/week per subscriber crossing 12 h → we're over the "casual" target.
- Total API spend / MRR ratio > 1.0 → we're losing money on every subscriber.
- Cap-reached events / week > 20% of subscriber base → raise cap or price, not both.

---

## Privacy + security posture

See [`DESIGN-PRINCIPLES.md § 5`](DESIGN-PRINCIPLES.md#5-privacy-posture--keys-in-the-browser) for the canonical rules. Subscription-specific additions:

- **No transcript storage beyond session lifetime** — the subscription's presence doesn't change this rule. Usage is counted in milliseconds, not words.
- **No advertising, ever** — explicitly stated in the ToS.
- **No data sale / third-party sharing** — explicitly stated in the Privacy Policy.
- **License keys are not PII by themselves.** The `email ↔ key` mapping is. Stored encrypted at rest (Phase 2+; SQLite `SQLCIPHER` extension or application-level AES-GCM).
- **`X-Subscription-Key` over HTTPS only.** The CORS config allows any origin for the route, but in practice only the extension sends this header and the backend always serves HTTPS on the hosted tier. Self-hosters running HTTP locally see no subscription functionality because `ENABLE_SUBSCRIPTION` is default-false.
- **Key rotation** — users can request a fresh key via `manage` → `action: "rotate_key"`. Old key immediately revoked. Phase 3 feature; stub is in place but not wired.

---

## Open items

Tracked here because they affect the architecture, not the ship:

- **In-memory usage counter on Phase 1 = redeploy = free refund.** Users get their weekly cap reset every time the Railway process restarts. Not exploitable enough to block Phase 1 launch (redeploys are rare + the cap is soft). Phase 2 fixes via SQLite persistence.
- **Single-tenant hosted backend** — the Railway deploy is one process. Horizontal scaling would require either sticky sessions or moving subscription state to Redis. Out of scope until the subscriber count justifies it.
- **Rate-limit the `/manage` endpoint** — currently no rate limit, so someone could enumerate emails by flood-posting. Add per-IP throttle before Phase 3 launch.
- **International considerations** — VAT / GST / sales tax on international subscribers. Stripe Tax handles most of this but needs enabling in dashboard.
- **Refund policy** — today's default should be "refund on request, no questions, pro-rata." Document in ToS.

---

## Related docs

- [`DESIGN-PRINCIPLES.md § 5`](DESIGN-PRINCIPLES.md) — privacy posture (including subscription alt-to-BYOK rule)
- [`DESIGN-PRINCIPLES.md § 5a`](DESIGN-PRINCIPLES.md) — subscription design intent (required for non-techs, not profitable)
- [`ROADMAP.md § v1.9.x`](ROADMAP.md) — release sequence
- [`legal/TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md) — ToS draft
- [`legal/PRIVACY-POLICY.md`](legal/PRIVACY-POLICY.md) — Privacy Policy draft
- `lib/subscription.ts` — key validation + usage metering
- `lib/free-tier-limiter.ts` — one-off trial mechanics
- `app/api/subscription/**` — endpoint implementations
