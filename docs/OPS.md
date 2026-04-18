# Peanut Gallery — Ops Runbook

> Day-to-day operational tasks: rotating API keys, setting usage caps, verifying a deploy covers the shared-demo path, handling alerts. Nothing in this file should contain a real secret — use placeholders.

Last updated: 2026-04-18 (v1.4.0)

---

## Where secrets live

| Surface | File / location | Contains real keys? |
|---|---|---|
| Local dev | `.env.local` | Yes (gitignored) |
| Production (hosted backend) | Vercel → Project → Settings → Environment Variables | Yes |
| Extension source | `extension/sidepanel.js` | **No, and must stay No** — see [`SERVER-SIDE-DEMO-KEYS.md`](SERVER-SIDE-DEMO-KEYS.md) |
| Extension zip (Chrome Web Store upload) | `peanut-gallery-v*.zip` | No |
| Git history | — | No (GitHub push protection backstop) |

The environment variables the backend reads:

```
DEEPGRAM_API_KEY
ANTHROPIC_API_KEY
XAI_API_KEY
SEARCH_ENGINE                 # `brave` (default) or `xai`
BRAVE_SEARCH_API_KEY          # required only when SEARCH_ENGINE=brave
```

See `.env.example` for the canonical list.

---

## Provider dashboards (for caps, rotation, monitoring)

| Provider | Dashboard | Where to set caps | Notes |
|---|---|---|---|
| Deepgram | https://console.deepgram.com/ | Project → Settings → **Usage & Limits** | Prepaid credit balance acts as a hard ceiling. New accounts get $200 credit. |
| Anthropic | https://console.anthropic.com/settings/limits | **Workspace monthly spend limit** + per-key spend limit under Settings → API keys | Per-key limit is the one to use for the shared demo key. Rotate button is right next to the key. |
| xAI | https://console.x.ai | Billing → Credits / Usage limits | Prepaid credit + per-key usage cap. Non-reasoning Grok 4.1 Fast is our runtime model; same key also powers Live Search when `SEARCH_ENGINE=xai`. |
| Brave Search | https://api-dashboard.search.brave.com/app/subscriptions | "Data for AI" free tier: 2,000 queries/month hard cap automatically. Paid plans have quota settings on the subscription page. | Only needed when `SEARCH_ENGINE=brave`. |

---

## Rotating a shared demo key

Standard rotation (e.g. after TWiST airs, or after a suspected leak):

1. **Create the new key on the provider dashboard.** Don't delete the old one yet.
2. **Add the new key to Vercel.** Project → Settings → Environment Variables → edit the relevant `*_API_KEY` variable → Save.
3. **Redeploy.** Vercel doesn't pick up env var changes until you redeploy. Trigger a fresh deploy of `main`.
4. **Verify the new key is in use.** Hit `GET https://peanutgallery.live/api/health` — it reports `{ deepgram: true, anthropic: true, xai: true, brave_search: true }` based on env var presence, so you'll see the env var is set. For functional verification, run a short live session from the extension with empty key fields; if reactions stream in, the server-side demo key fallback is working.
5. **Update `.env.local` on your dev machine** to match, so local dev uses the new key.
6. **Delete the old key on the provider dashboard.** After step 4 is confirmed green.

If the old key is actively leaking (e.g. caught in a public commit), reverse the order: delete the old key first, then do steps 1–5. You'll get a brief outage, which is preferable to continued abuse.

---

## Post-TWiST rotation checklist

After the bounty demo airs, rotate all four shared keys as a matter of hygiene — there's no way to know whether a curious viewer captured the running extension zip between CWS publish and show time.

- [ ] Deepgram: create new key, set usage cap, update Vercel, redeploy, delete old.
- [ ] xAI: create new key, set per-key usage cap, update Vercel, redeploy, delete old.
- [ ] Anthropic: use the Rotate button on the console, copy new value into Vercel, redeploy, confirm, revoke old.
- [ ] Brave Search: create new key, update Vercel, redeploy, delete old.
- [ ] Hit `GET /api/health` — confirm `true` on all four.
- [ ] Spot-test from the extension with no keys entered. Should produce reactions within 5–10s of starting a YouTube video.

---

## Responding to "reactions stopped coming"

Likely failure modes, in order of probability:

1. **One of the shared demo keys hit its cap.** Check `GET /api/health` (reports env var presence only, not quota), then hit each provider dashboard to see usage. Rotate or top up the offending key. Partial silence is diagnostic:
   - Baba + Jackie silent, Troll + Fred fine → **Anthropic** (producer + joker run on Claude Haiku).
   - Troll + Fred silent, Baba + Jackie fine → **xAI** (troll + soundfx run on Grok 4.1 Fast).
   - Everyone silent → **Deepgram** (no transcript, no fires).
   - Baba's fact-checks stop citing sources but he still talks → **Brave** or **xAI Live Search** (depending on `SEARCH_ENGINE`). Check `search_upstream_error` / `search_timeout` in the JSONL log.
2. **User is on a non-hosted backend** (self-host / wrong server URL) **without their own keys.** The extension's pre-flight should block this. If it didn't, check the side panel's "Backend server" field matches `https://peanutgallery.live`.
3. **Deepgram WebSocket dropped and didn't reconnect.** Check server logs for `deepgram_error` or repeated `reconnect` events. `lib/transcription.ts` has exponential backoff but a persistent auth failure will surface after a few retries.
4. **Chrome extension lost tabCapture permission.** User re-installed or reset permissions. See `extension/README.md` for the fix (re-enable site access).
5. **Search backend mis-toggled.** If `SEARCH_ENGINE=brave` is set on Vercel but `BRAVE_SEARCH_API_KEY` is blank, the Producer will still fire but with no fact-check context. Symptom: Baba talks, but his lines don't cite anything. Flip to `SEARCH_ENGINE=xai` (reuses `XAI_API_KEY`) or set a Brave key and redeploy.

---

## Where NOT to put secrets

- ❌ Commit messages. `git log` is public once pushed.
- ❌ Markdown docs (including this one). Use `sk-ant-api03-...` / `xai-...` / `BSA...` / etc. as placeholders. (Historical note: `gsk_...` was the Groq prefix we used to handle; Groq was removed in v1.4.)
- ❌ Extension source (`extension/*.js`, `extension/*.html`). Anything shipped to Chrome Web Store is trivially extractable.
- ❌ Client-side React components (`app/**/*.tsx` that run in the browser). Public bundle.
- ❌ Screenshots, videos, or demo recordings. Scrub the side panel before capturing.

When in doubt: if a user running the shipped product could see or intercept it, it's a public-facing surface. Keep the secret on the server.
