# SELF-HOST-INSTALL.md

> **Audience:** anyone who wants to run their own Peanut Gallery backend —
> either to point the official Chrome extension at it, or to host the web app
> yourself. This is the **operator's guide**. It assumes you are running the
> reference backend in this repo as-is, not rewriting it.
>
> **If you want to build a backend from scratch in a different language or
> stack,** read [`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md)
> instead — that's the wire spec the extension talks to.

---

## Contents

1. [What "self-hosting" gets you](#what-self-hosting-gets-you)
2. [Prerequisites](#prerequisites)
3. [One-command setup (macOS / Linux)](#one-command-setup-macos--linux)
4. [Manual setup (Windows, or if you hate shell scripts)](#manual-setup-windows-or-if-you-hate-shell-scripts)
5. [Get your API keys (90 seconds each)](#get-your-api-keys-90-seconds-each)
6. [Point the Chrome extension at your local server](#point-the-chrome-extension-at-your-local-server)
7. [Deploy to a public host (Railway / Docker / Vercel)](#deploy-to-a-public-host-railway--docker--vercel)
8. [Create your own persona pack](#create-your-own-persona-pack)
9. [Verify it works (smoke tests)](#verify-it-works-smoke-tests)
10. [Common problems](#common-problems)
11. [Cost expectations](#cost-expectations)

---

## What "self-hosting" gets you

Peanut Gallery has two audiences for this doc:

- **Extension user who doesn't trust a shared backend.** Run the server on
  your own machine; the Chrome extension will send audio to `localhost:3000`
  and nothing ever touches `peanutgallery.live`. Your API keys, audio, and
  transcripts stay on your laptop.
- **Developer who wants to host a branded fork.** Stand it up on Railway,
  Fly, Render, Vercel (with caveats — see [Deploy](#deploy-to-a-public-host-railway--docker--vercel)),
  or any Docker host and point your own Chrome extension build at it.

If your goal is to rewrite the backend in Go / Rust / Python / anything
non-Node, stop reading and go to
[`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md).

---

## Prerequisites

Required on every OS:

| Tool | Min version | Why | Check |
|------|-------------|-----|-------|
| **Node.js** | **18.x or newer** | Next.js 15 + WebSocket + async iterators | `node -v` |
| **npm** | 9+ (ships with Node 18) | package install | `npm -v` |
| **git** | any recent | clone the repo | `git --version` |

Required **only if you plan to use the web app** (pasting YouTube URLs at
`/watch`). The Chrome extension path uses tab audio capture and does NOT need
these:

| Tool | Install (macOS) | Install (Linux) | Install (Windows) |
|------|-----------------|-----------------|-------------------|
| **yt-dlp** | `brew install yt-dlp` | `sudo apt install yt-dlp` or `pip install -U yt-dlp` | `winget install yt-dlp` |
| **ffmpeg** | `brew install ffmpeg` | `sudo apt install ffmpeg` | `winget install ffmpeg` |

> **Windows note.** The one-command setup script is bash-only. On Windows,
> use WSL2 (Ubuntu) and follow the Linux instructions, OR follow the manual
> setup section below from PowerShell.

You also need 3 required API keys (all free-tier) plus 1 optional one for
fact-checking. See
[Get your API keys](#get-your-api-keys-90-seconds-each).

---

## One-command setup (macOS / Linux)

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh
```

`setup.sh` does the following in order and will abort with a clear error if
anything is missing:

1. Checks Node ≥ 18, npm, yt-dlp, ffmpeg.
2. Runs `npm install` if `node_modules/` is missing.
3. Prompts you interactively for each API key and writes them to
   `.env.local` (which is git-ignored).
4. Starts `npm run dev` on `http://localhost:3000`.
5. Opens the browser for you.

When the script finishes, the web app is live at `http://localhost:3000` and
the backend is ready for the Chrome extension to hit at
`http://localhost:3000/api/transcribe`.

---

## Manual setup (Windows, or if you hate shell scripts)

```bash
# 1. Clone + install
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
npm install

# 2. Copy the env template
cp .env.example .env.local     # macOS / Linux
copy .env.example .env.local   # Windows

# 3. Edit .env.local and paste in your keys (see next section)

# 4. Run the dev server
npm run dev
```

The dev server prints `▲ Next.js 15.x — Ready on http://localhost:3000`
when it's up. Keep this terminal open.

### What's in `.env.local`

| Variable | Required? | What it's for |
|----------|-----------|---------------|
| `DEEPGRAM_API_KEY` | **Yes** | Real-time speech-to-text. Without it, nothing works. |
| `ANTHROPIC_API_KEY` | **Yes** | Powers Producer (fact-checker) + Joker (comedy) on Claude Haiku. |
| `XAI_API_KEY` | **Yes** | Powers Troll + Sound FX on Grok 4.1 Fast (non-reasoning). Also powers Live Search when `SEARCH_ENGINE=xai`. |
| `SEARCH_ENGINE` | Optional | `brave` (default) or `xai`. Picks which backend fact-checks run through. |
| `BRAVE_SEARCH_API_KEY` | Only if `SEARCH_ENGINE=brave` | Lets Producer fact-check claims against the live web via Brave's REST API. Skip it if you're on xAI Live Search. |
| `ENABLE_SMART_DIRECTOR` | Optional (v1.5+) | Set to `true` to opt in to Smart Director v2 — a short Claude Haiku routing call per tick that decides who speaks next, falling back to the rule-based scorer under a 400ms budget. Off by default. Requires `ANTHROPIC_API_KEY`. Costs one extra Haiku call per director tick (roughly every 10–15s of active session). |
| `YT_DLP_COOKIE_BROWSER` | Optional (web app only) | Set to `chrome`, `firefox`, `safari`, `edge`, or `brave` if yt-dlp starts failing on age-gated or login-walled videos. Not used by the Chrome extension path. |

Technically the server can run with `DEEPGRAM_API_KEY` plus **either**
`ANTHROPIC_API_KEY` or `XAI_API_KEY` — you'll still get live transcription
plus whichever two personas that provider covers. Shipping with both is the
full cast.

---

## Get your API keys (90 seconds each)

Three required providers + one optional one for fact-checking. All have free
tiers that are enough to run the app for hours without paying anything.

1. **Deepgram** — <https://console.deepgram.com/signup>
   - Sign up, confirm email, go to **API Keys → Create a New API Key**.
   - New accounts include **$200** in free credit. That's roughly 400 hours
     of Nova-3 streaming — far more than you need.
   - Powers transcription. Required.
2. **Anthropic** — <https://console.anthropic.com/settings/keys>
   - Sign up, verify, click **Create Key**, copy the `sk-ant-...` string.
   - New accounts typically receive starter credit. Haiku is the cheapest
     Claude model — a 2-hour session costs pennies.
   - Powers the Producer + Joker archetype slots (Baba Booey + Jackie in the
     Howard pack; Molly Wood + Alex Wilhelm in the TWiST pack). Required.
3. **xAI** — <https://console.x.ai>
   - Sign up, verify, create an API key, copy the `xai-...` string.
   - Grok 4.1 Fast non-reasoning is cheap and fast; it also powers the
     optional Live Search fact-check pipeline with no separate signup.
   - Powers the Troll + Sound FX archetype slots (The Troll + Fred in Howard;
     Jason Calacanis + Lon Harris in TWiST). Required. Replaces Groq, which
     was removed in v1.4.
4. **Brave Search** (optional, only for `SEARCH_ENGINE=brave`) —
   <https://api-dashboard.search.brave.com/app/keys>
   - Free tier: **2,000 queries per month.** More than enough for personal
     use — each fact-check typically uses 1 query. Skip this if you're
     routing search through xAI.

Paste each key into the matching line in `.env.local`, no quotes, no spaces.
Example:

```bash
DEEPGRAM_API_KEY=68e...real-key-here
ANTHROPIC_API_KEY=sk-ant-api03-...
XAI_API_KEY=xai-...
SEARCH_ENGINE=brave           # or `xai` to route fact-check through Live Search
BRAVE_SEARCH_API_KEY=BSA...   # required only when SEARCH_ENGINE=brave
```

---

## Point the Chrome extension at your local server

1. Install the extension in developer mode (
   [extension/README.md](../extension/README.md)):
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** → select the `extension/` folder
2. Open any YouTube video.
3. Click the 🥜 icon. The side panel opens.
4. Expand the **Backend server** field. Change the URL from
   `https://peanutgallery.live` to `http://localhost:3000`.
5. (Optional) Expand **API keys**. If you've already put keys in
   `.env.local` on the server, leave these blank — the server will use env
   vars. If you want to override on a per-request basis (useful for testing
   a friend's key), paste them here.
6. Click **Start Listening**. You should see "Listening..." in the header
   within 1-2 seconds and persona reactions within 5-10 seconds of speech.

> **Mixed-content warning.** If you deploy the server to HTTPS but try to
> point the extension at plain `http://`, Chrome will block it. Use
> `localhost` (which Chrome treats as secure) or a fully HTTPS hostname.

---

## Deploy to a public host (Railway / Docker / Vercel)

### Railway (recommended)

The repo includes [`railway.toml`](../railway.toml) and a
[`Dockerfile`](../Dockerfile) with yt-dlp + ffmpeg preinstalled.

```bash
npx @railway/cli login
npx @railway/cli init -n my-peanut-gallery
npx @railway/cli up
```

Then in the Railway dashboard set the same four env vars from `.env.local`.
Railway will assign you a `your-app.up.railway.app` URL — put that in the
extension's **Backend server** field.

### Any Docker host

```bash
docker build -t peanut-gallery .
docker run -p 3000:3000 \
  -e DEEPGRAM_API_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -e XAI_API_KEY=... \
  -e SEARCH_ENGINE=brave \
  -e BRAVE_SEARCH_API_KEY=... \
  peanut-gallery
```

Then put your host's public URL in the extension's **Backend server** field.
Make sure the URL is HTTPS; Chrome will reject mixed content from the
extension.

### Vercel — read this before deploying

Vercel works for the landing pages but **the Vercel Edge / Hobby runtime
kills long-running SSE connections after ~10-30s** depending on plan. Peanut
Gallery sessions run for the length of the video (often 1-2 hours). If you
want Vercel:

- Use **Fluid Compute** or a Pro plan with extended runtime.
- Or split: host the static site on Vercel, host `/api/*` on Railway.
- Or just use Railway for everything — it's simpler.

The reference backend at `peanutgallery.live` runs on Railway for exactly
this reason.

### What NOT to ship publicly

- **Don't** put real keys in a public Dockerfile or committed env file.
  `.env.local` is git-ignored for a reason.
- **Don't** expose `/api/transcribe` to the open internet without rate
  limiting if you're paying for the keys. Each session holds a Deepgram
  WebSocket open — a bad actor can drain your credit.
- **Do** put your server behind Cloudflare or another CDN if you plan to
  publish the URL anywhere.

---

## Create your own persona pack

A **pack** is a swappable set of 4 persona voices. Every pack fills the
same 4 archetype slots keyed by fixed ids: `producer`, `troll`, `soundfx`,
`joker`. The slot ids are load-bearing — the Director, side panel cards,
and scoring rules are all keyed off them — so writing a new pack is purely
additive content work. You do NOT touch the Director or UI.

Before you start, skim the two shipping packs as reference:

- [`lib/packs/howard/personas.ts`](../lib/packs/howard/personas.ts) —
  Stern-style lineup. The "loud and prank-y" archetype calibration.
- [`lib/packs/twist/personas.ts`](../lib/packs/twist/personas.ts) —
  startup-podcast lineup. The "numerate and roasting" calibration.

Both packs use the same 4 slots; only the voice, tics, and topical focus
differ. That's the target.

### 1. Create the pack folder

Everything for a pack lives under `lib/packs/<id>/`, where `<id>` is the
lowercase machine name you'll use everywhere (`howard`, `twist`, etc.).

```bash
mkdir -p lib/packs/myshow
touch lib/packs/myshow/personas.ts lib/packs/myshow/index.ts
```

### 2. Write `personas.ts`

This file exports an array of **exactly 4** `Persona` objects, one per
slot, in this order: `producer`, `troll`, `soundfx`, `joker`.

Every `Persona` has these fields (see
[`lib/personas.ts`](../lib/personas.ts) for the full type):

| Field | Required? | Notes |
|-------|-----------|-------|
| `id` | Yes | MUST be one of `producer`, `troll`, `soundfx`, `joker`. Do not invent new slots. |
| `name` | Yes | Human-facing display name. Shown in the side panel. |
| `role` | Yes | One-line role description. Also read by the Director's routing LLM for slot disambiguation. |
| `emoji` | Yes | Single-character emoji shown in the avatar and chat bubble. |
| `color` | Yes | Tailwind-compatible hex (e.g. `#f87171`). Used for the avatar ring + bubble accent. |
| `model` | Yes | `"claude-haiku"` or `"xai-grok-4-fast"`. Convention: `producer` + `joker` on Haiku, `troll` + `soundfx` on Grok. Pick differently only if you know why. |
| `systemPrompt` | Yes | The full character prompt. This is where ~95% of the voice work happens — tics, dos, don'ts, example lines, silence behavior, format gates. Copy a shipping pack's prompt and rewrite rather than starting from scratch. |
| `directorHint` | **Optional (v1.5+)** | One-sentence, ~15-token cheat sheet the Smart Director v2 reads when picking who speaks next. See [Director hints](#about-directorhint) below. |

The convention is to keep each persona's system prompt in-file (template
literal) and export the array as `<packId>Personas`. Example scaffold:

```typescript
// lib/packs/myshow/personas.ts
import type { Persona } from "../../personas";

export const myshowPersonas: Persona[] = [
  {
    id: "producer",
    name: "Ellie",
    role: "Fact-checker / numbers person",
    emoji: "📊",
    color: "#60a5fa",
    model: "claude-haiku",
    systemPrompt: `You are Ellie, the show's fact-checker…`,
    directorHint: "Claims, stats, founding dates — anything verifiable. Lean in on numbers.",
  },
  // …troll, soundfx, joker — same shape, one each.
];
```

#### About `directorHint`

v1.5 added the **Smart Director v2** — an opt-in routing LLM that picks
which persona speaks each tick based on the transcript, recent firings,
and cooldowns. The router sees each persona's `id`, `name`, `role`, and
(if present) `directorHint`. The hint is the **compressed "when to pick
this voice" heuristic** — it lets the router tell your `joker` apart from
Jackie Martling or Alex Wilhelm even though they share the slot id.

Keep hints terse (1–2 sentences, ~15 tokens). They're NOT the full system
prompt — the router doesn't need that. Reference the distinctive trigger
for this voice at this slot. A few working examples from the shipping
packs:

- Howard's Jackie (`joker`) — *"Rapid-fire one-liners and hyena laugh. Lean in on absurd comparisons, confident hype, easy dunks."*
- TWiST's Alex (`joker`) — *"Numerate comedian — jokes about valuations, cap tables, and dashboards. Pick on data-flavored absurdity."*

Hints are optional. Packs that omit them still route correctly (the
router falls back to `role` alone). Add hints when your pack has a voice
whose specialty doesn't land cleanly from the role string.

`directorHint` is only read when `ENABLE_SMART_DIRECTOR=true`. The
default rule-based Director ignores it. Token cost is ~15 tokens × 4
personas = 60 extra tokens on the routing call, which already completes
inside a 400ms budget. Negligible.

### 3. Write `index.ts`

This file wires the personas to the pack metadata:

```typescript
// lib/packs/myshow/index.ts
import type { Pack } from "../types";
import { myshowPersonas } from "./personas";

export const myshowPack: Pack = {
  meta: {
    id: "myshow",
    name: "My Show",
    description: "Ellie, Rex, Dot, Jools — my house lineup.",
    universe: "My Show Universe",
    updatedAt: "2026-04-18",
  },
  personas: myshowPersonas,
};

export { myshowPersonas };
```

The optional `patterns` field on `Pack` lets you override the Director's
default regex scoring table (see
[`lib/packs/types.ts`](../lib/packs/types.ts)). Leave it unset for your
first pack — the default patterns work for most talk-show-style content.

### 4. Register in the pack registry

Edit [`lib/packs/index.ts`](../lib/packs/index.ts) and add your pack to
`PACKS`:

```typescript
import { myshowPack } from "./myshow";

export const PACKS: Record<string, Pack> = {
  howard: howardPack,
  twist: twistPack,
  myshow: myshowPack,   // ← add this
};
```

Do NOT change `DEFAULT_PACK_ID` unless you want your pack to become the
fallback for unknown pack ids.

### 5. Test with the Director harness

The Director is pack-agnostic — it only routes by slot — so the existing
fixture suite already covers your pack's structural behavior. What's
worth testing for a new pack is whether **your transcript vocabulary
lights up the right slots**.

Copy a Howard fixture that matches the vibe you're aiming for, rewrite
the transcript with your show's language, and run:

```bash
npx tsx scripts/test-director.ts --fixture my-new-fixture
```

Each fixture runs 50 times by default (the Director uses RNG for
tiebreaks) and asserts distribution thresholds. If you pasted in a
transcript about startup funding and the `producer` slot only wins 40% of
the time, either your transcript isn't claim-dense enough or your
pack needs a pattern override. See
[`scripts/fixtures/director/`](../scripts/fixtures/director/) for the
shipping fixture shape.

### 6. Use your pack from the extension

Packs are selected per session. The Chrome extension exposes a pack
picker in the side panel; once your pack is registered and the server is
rebuilt (`npm run build` or just a `npm run dev` hot reload), it shows up
there automatically.

If you're building your own frontend, send `"pack": "myshow"` in the
POST body to `/api/transcribe` at session start. Unknown pack ids fall
back to the default pack (never error), so old clients stay compatible.

### Optional: full backend rewrite

If you're rewriting the backend in a non-Node stack rather than adding a
pack to this repo, the persona shape above (including `directorHint`) is
part of the wire contract. See
[`BUILD-YOUR-OWN-BACKEND.md §9`](BUILD-YOUR-OWN-BACKEND.md) for the
per-persona requirements a custom backend must honor.

---

## Verify it works (smoke tests)

Run each of these after starting the server. Each should succeed.

### 1. Health check

```bash
curl -sS http://localhost:3000/api/health | jq
```

Expected: JSON with `status: "healthy"` (or `degraded` if yt-dlp/ffmpeg are
missing — fine for the Chrome extension path).

### 2. Fire one persona manually

```bash
curl -sSN -X POST http://localhost:3000/api/personas \
  -H 'Content-Type: application/json' \
  -d '{"transcript": "Jason just said Uber was founded in 2007.", "persona": "producer"}'
```

Expected: an SSE stream that emits `data: {"type":"chunk", ...}` lines,
then `data: {"type":"done"}`. If you get 401 / 500, check your env vars.

### 3. Open a transcribe session

```bash
curl -sSN -X POST http://localhost:3000/api/transcribe \
  -H 'Content-Type: application/json' \
  -H 'X-Deepgram-Key: <your-key>' \
  -H 'X-Anthropic-Key: <your-key>' \
  -H 'X-XAI-Key: <your-key>' \
  -H 'X-Search-Engine: brave' \
  -d '{"mode": "browser"}' | head -c 4000
```

Expected: the response header includes `X-Session-Id: <uuid>` and the body
starts emitting `event: status\ndata: {"status":"ready",...}`. Kill with
Ctrl-C after you see that — you've proved the SSE path works.

---

## Common problems

**"ECONNREFUSED localhost:3000" in the extension.**
The server isn't running, or it's running on a different port. Check the
terminal where you ran `npm run dev` — it should say "Ready on
`http://localhost:3000`". If it's on 3001 (because 3000 was taken), update
the extension's backend URL.

**"Failed to fetch" but the server is up.**
Almost always a CORS or mixed-content issue. Confirm:
- Extension URL is `http://localhost:3000` (not `127.0.0.1`, not `https://`).
- Or if you deployed publicly, the URL is HTTPS and the server is returning
  the CORS headers listed in
  [`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md#non-negotiables-read-first).

**Transcripts never appear, but no error.**
Deepgram key is missing or invalid. Check the server logs for
`[transcribe] Deepgram WS error` or `401`. Test the key with
<https://developers.deepgram.com/playground>.

**Only the producer + joker slots react** (Baba + Jackie in Howard; Molly + Alex in TWiST). Troll + soundfx stay silent.
No `XAI_API_KEY`. Add it to `.env.local` and restart the server.

**Only the troll + soundfx slots react** (Troll + Fred in Howard; Jason + Lon in TWiST). Producer + joker stay silent.
No `ANTHROPIC_API_KEY`. Add it to `.env.local` and restart the server.

**"yt-dlp: command not found" when pasting a URL at /watch.**
You skipped the web-app prerequisites. Install yt-dlp + ffmpeg (see
[Prerequisites](#prerequisites)) or just use the Chrome extension path
instead — it doesn't need them.

**Audio sounds choppy / personas are half a minute behind.**
Your network can't keep up with 16 kHz PCM uploads (~256 kbps). Uncommon on
home wifi, common on hotel wifi. Close other tabs; try again.

**Server crashes with "EADDRINUSE :3000".**
Another process is on 3000. Kill it (`lsof -ti:3000 | xargs kill`) or run
with a different port: `PORT=3456 npm run dev`.

**I get errors only after ~30 seconds on a hosted deploy.**
Your platform is buffering or terminating the SSE stream. See the Vercel
note in [Deploy](#deploy-to-a-public-host-railway--docker--vercel).

---

## Cost expectations

On the free tiers:

| Provider | Free tier | Real-world 2-hour session |
|----------|-----------|---------------------------|
| Deepgram | $200 credit on signup | ~$0.87 (Nova-3 streaming) |
| Anthropic | Starter credit on signup | ~$0.25 (Haiku is cheap) |
| xAI | Free credits on signup | ~$0.05 (Grok 4.1 Fast non-reasoning) |
| Brave | 2,000 queries/month | ~30 queries (≈1.5% of free tier) |

**Total per 2-hour episode: ~$1.15** once you exhaust free credit.

---

Back to [main README](../README.md) — or, if you want to build your own
backend in a different stack,
[`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md).
