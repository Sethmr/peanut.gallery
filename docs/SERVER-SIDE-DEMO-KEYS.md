# Server-Side Demo Key Fallback

> Why Peanut Gallery's extension ships with zero API keys in its source, and how the hosted backend covers demo users transparently.

Last updated: 2026-04-17

---

## TL;DR

The extension's key input fields are **empty by default**. The backend (`peanutgallery.live`) has its own keys in Vercel environment variables. When the extension POSTs a request with no `X-*-Key` headers, the server falls back to `process.env.*`. Users get a zero-setup demo; no secrets live in the Chrome zip, in `git`, or on Chrome Web Store.

**Future contributors: do NOT re-add a `DEMO_DEFAULT_KEYS` constant to the extension.** That pattern existed briefly during the v1.1.1 dev cycle and was removed after GitHub push protection correctly blocked the push. The architecture below replaces it — and is strictly better because it never publishes secrets.

---

## How the fallback works

### Extension side

`extension/offscreen.js` only sets a key header when the user typed a value into the input:

```js
// Only send the header if the user actually entered a key
if (config.apiKeys?.deepgram)  headers["X-Deepgram-Key"]  = config.apiKeys.deepgram;
if (config.apiKeys?.anthropic) headers["X-Anthropic-Key"] = config.apiKeys.anthropic;
if (config.apiKeys?.xai)       headers["X-XAI-Key"]       = config.apiKeys.xai;
if (config.apiKeys?.brave)     headers["X-Brave-Key"]     = config.apiKeys.brave;
// Search engine is always forwarded (server defaults to "brave" if missing)
if (config.searchEngine === "brave" || config.searchEngine === "xai") {
  headers["X-Search-Engine"] = config.searchEngine;
}
```

`extension/sidepanel.js::loadSettings()` defaults each input to empty string, not to a hard-coded key:

```js
deepgramKeyInput.value  = data.deepgramKey  || "";
anthropicKeyInput.value = data.anthropicKey || "";
xaiKeyInput.value       = data.xaiKey       || "";
braveKeyInput.value     = data.braveKey     || "";
searchEngineSelect.value = data.searchEngine || "brave";
```

### Server side

`app/api/transcribe/route.ts` (and `app/api/personas/route.ts`) resolves keys as *header-first, env-var-fallback*:

```ts
const deepgramKey  = req.headers.get("X-Deepgram-Key")  || process.env.DEEPGRAM_API_KEY;
const anthropicKey = req.headers.get("X-Anthropic-Key") || process.env.ANTHROPIC_API_KEY;
const xaiKey       = req.headers.get("X-XAI-Key")       || process.env.XAI_API_KEY;
const braveKey     = req.headers.get("X-Brave-Key")     || process.env.BRAVE_SEARCH_API_KEY;
const searchEngine = (req.headers.get("X-Search-Engine") || process.env.SEARCH_ENGINE || "brave") === "xai" ? "xai" : "brave";
```

Net effect:

| Client state | Header sent? | Server uses |
|---|---|---|
| First-time user, blank fields | No `X-*-Key` headers | `process.env.*` (shared demo keys) |
| User pasted their own keys | Headers with user's values | User's own keys |
| Any combination | Per-provider | Per-provider: user's value if present, env fallback if not |

---

## Why this design

### Security

- **No secrets in git.** GitHub push protection blocks commits that contain recognizable key formats. The old DEMO_DEFAULT_KEYS constant was caught by this and the commit was rejected.
- **No secrets in the extension zip.** The zip uploaded to Chrome Web Store contains only code — anyone who opens it sees no API keys. This matters because CWS reviewers, scrapers, and curious users all have access to the shipped bundle.
- **Rotation without recompiling.** Rotating a demo key is a Vercel env-var edit + redeploy. Extension users don't need to update — they were never holding the key in the first place.

### UX

- **Zero-setup demo.** First-time installers hit Start Listening with no fields touched and get working personas. That's exactly the demo-day experience the shared keys exist to create.
- **Honest upgrade path.** Pasting your own key in the side panel immediately overrides the server fallback for that session. The extension forwards the custom key, the server uses it, usage counts against the user's own quota.

### Operations

- **One place to rotate.** Keys live in Vercel env vars and in `.env.local` for dev. That's it. `.env.local` is gitignored. No keys in client code, no keys in docs, no keys in commit messages.

---

## Self-hoster caveat

A self-hoster pointing the extension at their own server won't have demo env vars set by default. To avoid a silent 400, `extension/sidepanel.js` runs a pre-flight check that requires the user to supply their own keys **only when the configured server URL is not `peanutgallery.live`**:

```js
const isHostedBackend = /(^|\/\/)peanutgallery\.live(\/|$)/i.test(serverUrl);
if (!isHostedBackend) {
  // Require Deepgram + Anthropic + xAI keys from the user, and a Brave key
  // when SEARCH_ENGINE=brave. Show an error if missing.
  ...
}
```

This keeps the hosted demo zero-setup while guiding self-hosters toward BYOK.

---

## What future contributors should NOT do

- ❌ Re-add a `DEMO_DEFAULT_KEYS` constant to `sidepanel.js` or anywhere else in `extension/`.
- ❌ Commit an `.env` or `.env.local` to the repo. `.gitignore` already excludes both; verify before `git add -A`.
- ❌ Hard-code any provider key into client-side code, even for "temporary" or "demo" purposes. Pushing that commit will either be blocked by GitHub or — worse — scraped by bots within minutes of being public.
- ❌ Paste real keys into markdown examples. Use placeholder formats like `sk-ant-api03-...` or `<your-key>`.

If you need the demo-access pattern on a different backend, set the env vars on that server and rely on the existing header-first fallback. The client code stays untouched.

---

## Related

- [`CHANGELOG.md` v1.1.1 → "Changed"](../CHANGELOG.md) — the migration commit.
- [`docs/DEBUGGING.md` → ISSUE-009](DEBUGGING.md) — post-mortem of the brief "embedded demo keys" detour.
- [`docs/BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md) — contract for alternative backends.
- [`.env.example`](../.env.example) — the env vars the hosted backend expects.
