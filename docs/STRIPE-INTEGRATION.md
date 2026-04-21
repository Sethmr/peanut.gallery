# Stripe integration — step-by-step Seth-only setup

Operator walkthrough for getting Stripe wired into Peanut Gallery Plus. Sibling to [`CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md) — same pattern, click-by-click. Companion to [`SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) (the why) and Linear ticket [SET-28](https://linear.app/seth-dev/issue/SET-28) (the manual-side checklist Seth tracks against).

Time budget: ~15 min in the Stripe dashboard, plus ~1 min to drop four strings into Railway.

---

## Before you start

You already have a Stripe account. Make sure of two things:

1. You're at the top of the screen on **Test mode** — the orange/yellow toggle in the dashboard header should read "TEST DATA." Everything below happens in test mode first; we flip to live at the end.
2. You're in the right account if you have multiple. Top-left dropdown.

---

## Step 1 — Create the product + price

1. Left sidebar → **Product catalog** (or `dashboard.stripe.com/test/products`).
2. **+ Add product** (top right).
3. **Name:** `Peanut Gallery Plus`
4. **Description:** `Hosted backend access — 16 hours of transcription per week, no API key juggling.`
5. **Image:** optional. The masthead peanut is at `marketing/peanut-mark.png` if you want consistency.
6. **More options → Tax behavior:** leave as `auto` for now. Stripe Tax (Step 5) handles the rest.
7. Under **Pricing:**
   - **Pricing model:** `Standard pricing` (the default).
   - **Price:** `8.00 USD`
   - **Billing period:** `Monthly`
   - **Tax behavior:** `Inclusive` if you want $8 to be the all-in price; `Exclusive` if you want to add tax on top. Pick what feels right; you can change later.
8. **Save product.**
9. On the product detail page that loads, find the **Pricing** card → click into the price → **Copy** the price ID (starts with `price_`). Save it for Step 4 — this is your `STRIPE_PRICE_ID`.

---

## Step 2 — Generate a restricted API key

Don't use the standard secret key — restricted keys are scoped, easier to revoke, and the canonical pattern for service integrations.

1. Left sidebar → **Developers → API keys** (or `dashboard.stripe.com/test/apikeys`).
2. **+ Create restricted key** (button under "Restricted keys").
3. **Key name:** `Peanut Gallery Plus backend`
4. Permissions — set the following to the values shown; everything else stays at **None**:

| Resource | Permission |
|---|---|
| Checkout Sessions | **Write** |
| Customers | **Write** |
| Customer Portal | **Write** |
| Prices | **Read** |
| Products | **Read** |
| Subscriptions | **Read** |
| Webhook Endpoints | **Read** |

5. **Create key.** You'll see the key string (starts with `rk_test_` in test mode, `rk_live_` in live). **Copy it now — you won't see it again.** Save for Step 4 — this is your `STRIPE_SECRET_KEY`.

---

## Step 3 — Register the webhook endpoint

This is how Stripe tells our backend "someone just subscribed" / "someone just cancelled."

1. Left sidebar → **Developers → Webhooks** (or `dashboard.stripe.com/test/webhooks`).
2. **+ Add endpoint** (top right).
3. **Endpoint URL:** `https://api.peanutgallery.live/api/subscription/webhook`
   - This requires SET-31 (DNS for the api subdomain) to be done first. If `nslookup api.peanutgallery.live` still returns NXDOMAIN, fix that ticket first or Stripe will fail validation here.
4. **Description:** `Peanut Gallery Plus — subscription lifecycle events`
5. **Events to send:** click **+ Select events** and search/check exactly these three:
   - `checkout.session.completed` — someone paid; we issue them a key
   - `customer.subscription.updated` — status changes (paused, past_due, etc.)
   - `customer.subscription.deleted` — cancelled
6. **Add endpoint.**
7. On the endpoint detail page, find the **Signing secret** card → click **Reveal** → **Copy** the secret (starts with `whsec_`). Save for Step 4 — this is your `STRIPE_WEBHOOK_SECRET`.

---

## Step 4 — Drop env vars into Railway

You now have four strings:

| Env var | Source | Value |
|---|---|---|
| `STRIPE_SECRET_KEY` | Step 2 | `rk_test_...` |
| `STRIPE_PRICE_ID` | Step 1 | `price_...` |
| `STRIPE_WEBHOOK_SECRET` | Step 3 | `whsec_...` |
| `STRIPE_ENABLED` | (literal) | `true` |

Via Railway CLI from your repo:

```bash
railway variables --set STRIPE_SECRET_KEY=rk_test_xxx \
                  --set STRIPE_PRICE_ID=price_xxx \
                  --set STRIPE_WEBHOOK_SECRET=whsec_xxx \
                  --set STRIPE_ENABLED=true
railway up
```

Or via the dashboard: Railway project → **Variables** → **+ New Variable** × 4.

While you're in env vars, you'll also want `ENABLE_SUBSCRIPTION=true` if it's not already set — that's the master switch for the subscription endpoints to respond.

---

## Step 5 — (Optional) Enable Customer Portal

Lets subscribers self-serve cancel + update billing without you in the loop. Recommended.

1. Left sidebar → **Settings → Billing → Customer portal** (or `dashboard.stripe.com/test/settings/billing/portal`).
2. **Activate test link** (button at the top once enabled).
3. Configure what subscribers can do:
   - **Subscriptions → Cancel:** `Allow customers to cancel their subscriptions` ✓
   - **Subscription cancellations → Mode:** `Cancel at end of billing period` (matches our ToS — no pro-rata cancellation, but pro-rata refund on request via support).
   - **Cancellation reasons:** check `Too expensive` / `Switched service` / `Customer service` / `Other` so you get signal on why people churn.
   - **Payment methods → Update payment method:** ✓
   - **Invoice history → Allow customers to view their invoice history:** ✓
4. **Branding** → upload the Peanut Gallery wordmark + set the brand color to `#cc2229` (the stamp red) so the portal feels like our product.
5. **Save changes.**

---

## Step 6 — (Optional) Enable Stripe Tax

Only do this if you plan to sell internationally. US-only? Skip.

1. **Settings → Tax** (or `dashboard.stripe.com/test/tax/settings`).
2. **Get started → Add origin address** (your business address).
3. **Add tax registration** for jurisdictions where you have nexus. Most US small operators only need their home state.
4. Stripe will start auto-collecting tax on checkouts.

---

## Step 7 — Verify in test mode

Before flipping to live, end-to-end test the subscription flow:

```bash
# In one terminal — make sure your local Next.js dev server is running
cd chrome-extension && npm run dev

# In another terminal — install the Stripe CLI if you haven't:
brew install stripe/stripe-cli/stripe

# Forward Stripe webhooks to your local dev server
stripe listen --forward-to localhost:3000/api/subscription/webhook
```

The CLI prints a temporary webhook secret like `whsec_local_...`. For local-dev testing only, override `STRIPE_WEBHOOK_SECRET` in your `.env.local` to that value.

Then trigger a test event:

```bash
stripe trigger checkout.session.completed
```

Look for the event in your Next.js terminal output. The route logs to `logs/pipeline-debug.jsonl` as `subscription_webhook_received`. (Once SET-26 ships and replaces the stub, the same event will trigger key issuance + email.)

---

## Step 8 — Going to live mode

When you've validated the test flow and SET-26 + SET-27 have shipped:

1. Top of Stripe dashboard — flip the **TEST DATA** toggle to **LIVE**.
2. Repeat **Steps 1–3** in live mode (creating the live product + live restricted key + live webhook endpoint). Stripe doesn't share resources between modes.
3. Replace the four Railway env vars with their live equivalents.
4. Tag a Peanut Gallery release that includes the v1.9.x subscription work.
5. Update the marketing site to mention Plus + post the published ToS + Privacy Policy URLs.

---

## Cost expectations

- **Stripe fees:** 2.9% + $0.30 per successful subscription charge. On $8/mo, that's $0.53 — gross margin is $7.47/sub before backend API costs (see [`SUBSCRIPTION-ARCHITECTURE.md § Economics`](SUBSCRIPTION-ARCHITECTURE.md#economics)).
- **Stripe Tax:** $0 setup; 0.5% of taxable transactions when active. Negligible at our volume.
- **Customer Portal:** free.
- **No fixed monthly fees** on Stripe at this scale. You only pay per transaction.

---

## What goes back to Claude

Once Steps 1–4 are done and you've moved [SET-28](https://linear.app/seth-dev/issue/SET-28) to Done:

1. Move [SET-26](https://linear.app/seth-dev/issue/SET-26) (Phase 3 Stripe integration) to **Todo**. Daemon picks it up because it's AI-assigned.
2. Spawned agent reads `SUBSCRIPTION-ARCHITECTURE.md § Phase 3`, writes the real Stripe Checkout + webhook handler against the env vars you just set.
3. PR opens; agent moves SET-26 to In Review (per PR #103); you merge when CI's green.

You should NEVER need to share the API keys with anyone (including me). They live in Railway env, the code reads them server-side, and that's the entire access pattern.

---

## Troubleshooting

**"Invalid URL" when registering the webhook in Step 3** → the `api.peanutgallery.live` subdomain doesn't resolve. Do [SET-31 (DNS fix)](https://linear.app/seth-dev/issue/SET-31) first, wait for DNS propagation (5–15 min), retry.

**Webhook events don't arrive in dev** → the Stripe CLI forwarder must be running, and your `.env.local` `STRIPE_WEBHOOK_SECRET` must match what the CLI prints (NOT the dashboard secret in dev).

**Restricted key returns 401 on a Checkout Session create** → the key is missing the **Customers: Write** or **Checkout Sessions: Write** permission. Recreate or edit the restricted key under Developers → API keys.

**Customer Portal link 404s** → you didn't click "Activate test link" in Step 5. Stripe gates portal access behind a one-time activation per mode.

---

## Related docs

- [`SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) — full system design + economics
- [`legal/TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md) — references the cancel + refund policy this guide implements
- [`legal/PRIVACY-POLICY.md`](legal/PRIVACY-POLICY.md) — references how Stripe payment data is handled
- [`CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md) — sibling operator guide for the v3 Director canary
- Linear: [SET-28](https://linear.app/seth-dev/issue/SET-28) (this work) → unblocks [SET-26](https://linear.app/seth-dev/issue/SET-26) (Stripe code)
