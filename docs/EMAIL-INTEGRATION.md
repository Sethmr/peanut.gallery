# Transactional email — step-by-step Seth-only setup

Operator walkthrough for getting transactional email wired into Peanut Gallery Plus. Sibling to [`STRIPE-INTEGRATION.md`](STRIPE-INTEGRATION.md) and [`CEREBRAS-INTEGRATION.md`](CEREBRAS-INTEGRATION.md). Companion to [`SUBSCRIPTION-ARCHITECTURE.md`](SUBSCRIPTION-ARCHITECTURE.md) (Phase 4) and Linear ticket [SET-29](https://linear.app/seth-dev/issue/SET-29) (the manual-side checklist).

Time budget: ~15 min in Resend's dashboard + ~5 min at your DNS registrar + ~1 min in Railway.

---

## Why Resend (not Postmark / SendGrid / SES)

Resend is the recommended provider for Peanut Gallery's scale + posture:

- **Free tier:** 3,000 emails/month + 100/day. We'll be well under that for the first hundred subscribers (welcome + recovery + cancel ≈ 3 emails per subscriber lifecycle).
- **Domain verification + API key in 10 minutes.** No sales call.
- **Modern API.** First-class TS SDK, but a plain `fetch` call works too — keeps the integration zero-dep.
- **Built for transactional, not marketing.** Their abuse posture is tighter, deliverability is better, and they don't try to upsell you into newsletter tooling.
- **Founders are ex-Vercel + ex-Stripe.** DX is opinionated for the same stack we're on.

Postmark is also great (similar pricing, slightly older, better support if you ever talk to humans). SendGrid is overkill + dated. SES is cheapest at scale but the setup overhead doesn't pay back until you're sending 10k+/month.

---

## Step 1 — Sign up for Resend

1. Go to **[resend.com](https://resend.com)** → **Sign up**.
2. Use **seth@manugames.com** (or the email associated with the legal entity that runs Peanut Gallery — same one tied to Stripe).
3. Skip the "tell us about your project" survey if it appears, or just type "Transactional email for a Chrome extension subscription product."

---

## Step 2 — Add and verify the sending domain

1. Dashboard → **Domains** (left sidebar) → **+ Add Domain**.
2. **Domain:** `peanutgallery.live`
3. **Region:** pick whichever is closest to Railway's region (us-east is the safe default if you're not sure where Railway is hosting you).
4. **Add Domain.**

Resend will then show you a list of DNS records you need to add at your registrar. Typically:

- **MX record** (for receiving bounce notifications)
- **TXT record** for SPF (`"v=spf1 include:amazonses.com ~all"` or similar)
- **TXT record** for DKIM (a longer string starting with `v=DKIM1; k=rsa; p=...`)
- **TXT record** for DMARC (recommended; `"v=DMARC1; p=none; rua=mailto:dmarc-reports@..."`)

Keep this Resend page open — you'll copy values from it in Step 3.

---

## Step 3 — Add the DNS records at your registrar

Same registrar where you set up the `api.peanutgallery.live` CNAME for SET-31. For each record Resend showed:

1. Open your DNS panel → **+ Add record**.
2. **Type:** match what Resend shows (`MX`, `TXT`, etc.).
3. **Host / Name:** match what Resend shows. Some registrars want the full subdomain (`resend._domainkey.peanutgallery.live`), others want just the prefix (`resend._domainkey`). Try the full form first; if the registrar complains, drop the domain suffix.
4. **Value / Content:** paste the entire string from Resend. **Don't truncate** — DKIM strings in particular are long; copy the full value (Resend has a "Copy" button on each row).
5. **TTL:** default / auto.
6. **Priority** (only for MX records): match what Resend shows (usually `10`).
7. Save each record.

Then back in Resend's domain page, click **Verify Records**. Each row should flip to a green check within 1–5 min. (If a record stays red after 10 min, paste-error is the most common cause — recopy the value carefully.)

---

## Step 4 — Generate an API key

1. Resend dashboard → **API Keys** → **+ Create API Key**.
2. **Name:** `Peanut Gallery Plus backend`
3. **Permission:** **Sending access** (we don't need full access for this integration).
4. **Domain:** restrict to `peanutgallery.live` so a leak doesn't let anyone send from a different domain.
5. **Add.**
6. Copy the key (starts with `re_`). **You won't see it again.** Save for Step 5 — this is your `EMAIL_API_KEY`.

---

## Step 5 — (Recommended) Set up a `support@` inbox for inbound mail

Resend handles **outbound** (we send to subscribers). For **inbound** customer replies you need a real inbox at `support@peanutgallery.live`. Two cheap options:

**Option A — Email forwarding via your registrar (free, fastest).**
Most registrars (Cloudflare, Porkbun, Namecheap, Google Domains, Squarespace) offer free email forwarding. Configure it to forward `support@peanutgallery.live` → `seth@manugames.com` (or wherever you actually read mail). One-time setup; then any email to support@ lands in your existing inbox.

**Option B — Real inbox (if you want a polished sender identity).**
Google Workspace ($6/mo per user) or Zoho Mail (free for 5 users on a single domain). More setup, more polish — replies look like they come from `support@peanutgallery.live` instead of forwarding to your personal address.

For MVP, Option A is enough. Upgrade to Option B if/when you have enough volume to want a separate identity for support.

Either way, the address `support@peanutgallery.live` should land in a place you actually read. The legal docs ([`TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md), [`PRIVACY-POLICY.md`](legal/PRIVACY-POLICY.md)) reference it as the contact channel.

---

## Step 6 — Drop env vars into Railway

You have one new string + two literals:

| Env var | Source | Value |
|---|---|---|
| `EMAIL_API_KEY` | Step 4 | `re_...` |
| `EMAIL_FROM` | (literal) | `Peanut Gallery <subscriptions@peanutgallery.live>` |
| `EMAIL_REPLY_TO` | (literal) | `support@peanutgallery.live` |

Via Railway CLI:

```bash
railway variables --set EMAIL_API_KEY=re_xxx \
                  --set "EMAIL_FROM=Peanut Gallery <subscriptions@peanutgallery.live>" \
                  --set EMAIL_REPLY_TO=support@peanutgallery.live
railway up
```

The `EMAIL_FROM` format with the display name in angle brackets makes the From: header read as "Peanut Gallery" instead of just the bare email address — friendlier in the user's inbox.

---

## Step 7 — Test send via the Resend playground

Before handing off to SET-27 (the integration code), confirm everything works end-to-end with a real send:

1. Resend dashboard → **Emails** → **Send Test Email** (or **Playground**).
2. **From:** `subscriptions@peanutgallery.live`
3. **To:** an address you control that's NOT the Resend-account email (Resend may suppress sends to itself for safety).
4. **Subject:** `Plus signup test`
5. **Body:** anything, e.g. `If you're seeing this, transactional email is wired up.`
6. **Send.**

Within ~30 sec you should receive the email. Check the headers — `From:` should read `Peanut Gallery <subscriptions@peanutgallery.live>`, and the email shouldn't land in spam (DKIM + SPF passing means inbox delivery).

If it lands in spam:
- DMARC policy may need to be `quarantine` or `reject` instead of `none` once you have data
- Domain reputation builds over time; first sends from a new domain are sometimes scrutinized

---

## Step 8 — Hand off to Claude

Once Steps 1–6 are done and a test send works:

1. Move [SET-29](https://linear.app/seth-dev/issue/SET-29) to **Done**.
2. Move [SET-27](https://linear.app/seth-dev/issue/SET-27) (Phase 4 email infrastructure code) to **Todo**. Daemon picks it up because it's AI-assigned.
3. Spawned agent reads `SUBSCRIPTION-ARCHITECTURE.md § Phase 4`, writes the email-send code (welcome / recovery / cancel templates) against the env vars you just set, opens a PR, you merge.

After SET-27 ships AND SET-26 is in develop, the full flow works end-to-end:
- User pays via Stripe → webhook fires → backend issues a license key → backend calls Resend → user gets an email with their key → user pastes it into the extension.

---

## Cost expectations

- **Resend free tier:** 3,000 emails/month + 100/day. We send ~3 emails per subscriber lifecycle (welcome + maybe one recovery + maybe one cancel), so you can have ~1,000 subscribers before paying anything.
- **Resend paid tier:** $20/mo for 50,000 emails. Way past Plus's MVP scale.
- **Email forwarding via registrar:** $0 for most registrars.
- **Google Workspace inbox:** $6/mo per user if you upgrade to a real `support@` mailbox.

For the first 100 subscribers: **$0/month total** for email, assuming registrar forwarding for inbound.

---

## Troubleshooting

**"DNS records not verified" after 10 min** → most common cause is a paste error in the DKIM TXT (it's the longest one). Recopy from Resend, paste again, save. Don't add line breaks.

**"From email not allowed" when test-sending** → the domain isn't fully verified yet. Wait for the green checkmark on the domain page.

**Test send works but real subscribers don't get email** → check Resend's **Logs** tab. Likely cause: bounce (invalid address) or spam filter blocked it. Logs show the SMTP exchange.

**Email lands in spam** → check `spamcheck.postmarkapp.com` to scan a sample message. Common fixes: tighten DMARC policy from `none` to `quarantine` after a week of clean data; add a real `Reply-To` header (we already do); avoid spammy words in subject lines.

**Resend monthly limit hit** → upgrade to the paid tier ($20/mo, 50k emails) or, if it's an abuse problem, add rate-limiting on the issue-key endpoint.

---

## Related docs

- [`SUBSCRIPTION-ARCHITECTURE.md § Phase 4`](SUBSCRIPTION-ARCHITECTURE.md) — what the integration code will do
- [`STRIPE-INTEGRATION.md`](STRIPE-INTEGRATION.md) — sibling operator guide for Stripe (SET-28)
- [`legal/TERMS-OF-SERVICE.md`](legal/TERMS-OF-SERVICE.md) + [`legal/PRIVACY-POLICY.md`](legal/PRIVACY-POLICY.md) — reference `support@peanutgallery.live` as the contact channel
- Linear: [SET-29](https://linear.app/seth-dev/issue/SET-29) (this work) → unblocks [SET-27](https://linear.app/seth-dev/issue/SET-27) (email integration code)
