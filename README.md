# Peanut Gallery

**A Chrome extension that puts an AI writers' room next to any YouTube video.**

4 AI personas — pick your lineup — watch the show with you through a native Chrome side panel and react in real-time. A fact-checker keeping the host honest. A sound effects guy scoring every moment. A comedy writer dropping one-liners. A cynical troll saying what the audience is thinking.

As of **v1.3.0**, you choose which cast shows up via a dropdown at the top of the side panel: the Howard Stern crew (default) or the **TWiST lineup** — Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm. Same four archetype slots, same Director, entirely different voices.

**[peanutgallery.live](https://peanutgallery.live)** | MIT Licensed | Open Source

---

> $5,000 + a guest spot on the show. Here's what you have to build...
>
> — [@twistartups](https://x.com/twistartups)

Built in response to Jason Calacanis and Lon Harris's open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups).

---

## The Chrome Extension (primary product)

The main way to use Peanut Gallery. Silent tab audio capture via `chrome.tabCapture` — no permission picker, no interference with playback — and a gallery that lives in Chrome's native Side Panel right next to the video.

### Install

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh          # deps + API keys in .env.local
npm run dev         # starts local server on :3000
```

Then load the unpacked extension:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Open any YouTube video → click the 🥜 icon → **Start Listening**

That's it. Your keys live in `.env.local` on your machine — git-ignored, never uploaded.

**Prerequisites:** Node.js 18+. The extension flow doesn't need yt-dlp or ffmpeg (those are only for the reference web app below).

---

## The Web App (reference implementation)

Before the extension, Peanut Gallery was a Next.js web app where you pasted a YouTube URL. It's preserved in `app/` as a reference implementation — it proved out the persona engine, director, SSE stream, and UI that now powers the side panel. Kept around for prototyping the next iteration of the sidebar.

**Run the web app locally:** `npm run dev`, open `localhost:3000`, paste a URL.

**Hosted:** [peanutgallery.live](https://peanutgallery.live) — your keys get sent to the server via headers, forwarded to Deepgram/Anthropic/xAI/Brave, and discarded at session end. Never logged, never persisted. [Audit the route](https://github.com/Sethmr/peanut.gallery/blob/main/app/api/transcribe/route.ts) if you want zero trust required.

The web app uses `yt-dlp` + `ffmpeg` to pull audio server-side:

```bash
brew install yt-dlp ffmpeg          # macOS
sudo apt install yt-dlp ffmpeg      # Ubuntu/Debian
```

---

## The Cast

Every pack ships four archetype slots. The Director is pack-agnostic — same routing, same cascade, same cooldowns — only the voices change.

### Howard Stern Show (default)

Inspired by the Stern staff, per Jason's original spec.

| Slot | Character | Model | Role |
|------|-----------|-------|------|
| **Producer** | Baba Booey (Gary Dell'Abate) | Claude Haiku + Brave Search (or xAI Live Search) | Fact-Checker. Pulls receipts mid-show on numbers, dates, attributions. |
| **Troll** | The Cynical Troll | xAI Grok 4.1 Fast | Contrarian. Internet-brain energy. Says what the audience is thinking. |
| **Sound FX** | Fred Norris | xAI Grok 4.1 Fast | Bracket-delimited sound cues + deadpan one-liners. |
| **Joker** | Jackie Martling | Claude Haiku | Setup-punchline jokes, callbacks, observational comedy. |

Sample fires:

> *Baba Booey:* [FACT CHECK] "Jason just said Uber was founded in 2007. It was 2009. Again."
>
> *Troll:* "Oh cool, another AI wrapper. Very 2024."
>
> *Fred:* [record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]
>
> *Jackie:* "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

### This Week in Startups (new in v1.3.0)

Researched from public TWiST transcripts and episode clips. Anti-impersonation guardrails are baked into every prompt — these are personas **inspired by** their namesakes, not impressions of them. See `docs/packs/twist/RESEARCH.md` for the characterization source.

| Slot | Character | Model | Role |
|------|-----------|-------|------|
| **Producer** | Molly Wood | Claude Haiku + Brave Search (or xAI Live Search) | Fact-Checker. Calm journalistic corrections, "according to" framing, receipts-first. |
| **Troll** | Jason Calacanis | xAI Grok 4.1 Fast | Provocateur. Confident takes, founder-market-fit framing, warm-not-mean. |
| **Sound FX** | Lon Harris | xAI Grok 4.1 Fast | The Reframe. Bracket-delimited sound cues + cultural analogies. |
| **Joker** | Alex Wilhelm | Claude Haiku | Data Comedian. Eight joke techniques built on data + absurdity. |

Pack choice lives in the side-panel setup dropdown and persists across sessions. Change takes effect on the next Start Listening — no mid-session persona swap.

---

## How It Works

**Chrome Extension (primary):**
```
YouTube Tab → chrome.tabCapture → Offscreen Doc → PCM 16kHz (250ms chunks)
           → Local Server → Deepgram Nova-3 → Director → AI Personas → SSE → Side Panel
```

**Reference Web App:**
```
YouTube URL → yt-dlp → FFmpeg → Deepgram Nova-3 → Director → AI Personas → SSE → UI
```

In both, the **Director** (a rule-based booth producer) reads each transcript chunk and picks the best persona to respond — then cascades to others with decreasing probability and staggered timing. Some moments get 1 response, some get 2-3, and occasionally all 4 pile on.

The **Fact-Checker** has an extra step: it scores sentences for factual claims and runs parallel search queries to cross-reference — pick **Brave Search** (separate key, dedicated search API) or **xAI Live Search** (reuses your xAI key, no extra signup) in the side-panel settings.

---

## Stack

Multi-provider by design. No platform trap.

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 15, Tailwind | App Router + SSE streaming |
| Transcription | Deepgram Nova-3 | Sub-300ms, WebSocket native |
| Fact-Checker + Comedy Writer | Claude Haiku (Anthropic) | Reasoning + nuance |
| Troll + Sound Effects Guy | xAI Grok 4.1 Fast (non-reasoning) | Reflexive, punchy output without deliberation |
| Fact-Checking | Brave Search API **or** xAI Live Search | User-selectable per-session |

**Cost per 2-hour episode: ~$1.15**

---

## API Keys

All services have free tiers:

| Key | Sign up | Required? |
|-----|---------|-----------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | Yes |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Yes (Baba Booey + Jackie) |
| xAI | [console.x.ai](https://console.x.ai) | Yes (Troll + Fred, plus optional Live Search) |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | Optional (only when `SEARCH_ENGINE=brave`; skip it if you're routing search through xAI) |

---

## Deploy Your Own

Want to host your own instance? The app includes a Dockerfile with yt-dlp and ffmpeg pre-installed.

```bash
# Railway (recommended)
npx @railway/cli login
npx @railway/cli init -n my-peanut-gallery
npx @railway/cli up

# Or any Docker host
docker build -t peanut-gallery .
docker run -p 3000:3000 peanut-gallery
```

No server-side env vars needed — users provide their own keys through the UI. The full operator's guide is in **[docs/SELF-HOST-INSTALL.md](docs/SELF-HOST-INSTALL.md)** — prerequisites, env vars, smoke tests, Railway / Docker / Vercel trade-offs, and the common-failure checklist.

---

## Build Your Own Backend

Don't want to run Node? Want to swap the persona stack, change providers, or ship a branded fork in Go / Rust / Python? The extension will happily talk to any backend that honors the wire spec.

- **[docs/BUILD-YOUR-OWN-BACKEND.md](docs/BUILD-YOUR-OWN-BACKEND.md)** — the canonical contract. Endpoint shapes, SSE event protocol, audio format, director + cascade rules, persona prompts, required CORS headers, 8 acceptance tests you can paste into curl.
- **[docs/SELF-HOST-INSTALL.md](docs/SELF-HOST-INSTALL.md)** — if you just want to run the reference backend as-is.

### Let Claude do it for you

Paste this into Claude (or any coding AI) after cloning the repo. It's self-contained — the AI reads the build spec, scaffolds the project, and stops at the acceptance tests so you can verify compatibility before going live.

````text
You are building a drop-in replacement backend for the Peanut Gallery
Chrome extension. Read docs/BUILD-YOUR-OWN-BACKEND.md in this repo
FIRST — that's the canonical wire spec and it is non-negotiable.

Your job:
1. Pick a stack (ask me which language/framework if it matters).
2. Implement the 6 endpoints under the exact contracts in that doc:
   POST /api/transcribe, PATCH /api/transcribe, DELETE /api/transcribe,
   POST /api/personas, GET /api/health, GET /api/config.
3. Wire Deepgram Nova-3 (WebSocket), xAI Grok 4.1 Fast (non-reasoning),
   Anthropic (Claude Haiku), and your search engine (Brave Search REST
   or xAI Live Search) exactly as the spec describes.
4. Honor every "Non-negotiable" in the spec, especially:
   - CORS for chrome-extension:// origins
   - SSE content-type, X-Session-Id header, no buffering
   - PCM 16-bit mono 16 kHz little-endian audio, base64, ~250 ms chunks
   - Persona IDs: producer, troll, soundfx, joker (hardcoded, don't rename)
   - API keys accepted via both env vars AND X-*-Key request headers
5. Implement the Director + cascade rules with the exact scoring
   formula and persona prompts in sections 7 and 8 of the spec.
6. Stop before marking yourself done and run the 8 acceptance tests
   in section 11. Fix anything that fails. Only declare victory when
   every test passes.

Do not deviate from the wire protocol. The official Chrome extension
lives at https://github.com/Sethmr/peanut.gallery/tree/main/extension
and WILL break if any field name, event name, or content-type is wrong.
If something in the spec is ambiguous, stop and ask me — don't guess.
````

Once your server is running, point the extension's **Backend server** field at your URL and the four AI personas will react exactly the same way they do against the official hosted backend.

---

## Roadmap

Canonical source: **[docs/ROADMAP.md](docs/ROADMAP.md)**. Version-staged plan:

| Version | Theme | Headline |
|---------|-------|----------|
| ✅ **v1.2.0** | Mise en place | Director debug panel + structured routing logs, real director test coverage (50 runs × 10 fixtures), husky pre-merge gate. **Shipped.** |
| ✅ **v1.3.0** | TWiST Pack (flagship) | Selectable persona packs. Howard + TWiST (Molly / Jason / Lon / Alex). Pack-swap dropdown. Pack label in the debug trace. **Shipped.** |
| ✅ **v1.4.0** | Grok & Stability | Troll + Sound FX migrated from Groq to xAI Grok 4.1 Fast. Search-engine toggle (Brave ↔ xAI Live Search). Session-firing deadlock fixed so one stalled upstream can't strand the rest of the session. **Shipped.** |
| 🧪 **v1.5.0** | Smart Director v2 | LLM-assisted routing (Claude Haiku) with rule-based fallback under a 400ms budget; `Persona.directorHint` lets the router read each voice's specialty up front. **Feature-complete; 48h canary pending before tag.** [Narrated walkthrough →](https://youtu.be/WPyknI7-N5U) |
| **v1.5.1** | Smart Director Polish | Codify canary disagreements into fixtures, per-pack hint weighting, usage counter, default-on decision. |
| **v1.6.0** | Voice + Clip Share | TTS per persona (opt-in, ducked, barge-in). Client-side highlight / clip export as shareable video. |
| **v1.7.0** | Pack Lab | Visual `/pack-lab` pack authoring UI with director sanity-check + gallery (All-In, Acquired, Lex Fridman, user packs — no PRs required). |
| **v1.8.0** | Live Moments | Floating danmaku overlay, event-driven triggers (chapter / ad-break / chat spike / manual bookmarks), personal "About me" context. |
| **v2.0.0** | Bobbleheads | 3D persona avatars on screen, procedural animation tied to fire events and sentiment. |

**Already supported, not yet marketed:** non-YouTube sources (Twitch, Kick, any tab) — `chrome.tabCapture` is tab-agnostic, personas are just tuned for podcast pacing.

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale.

Built for **[This Week in Startups](https://x.com/twistartups)** | Jason Calacanis & Lon Harris

---

## Marketing site

The public landing pages at **[peanutgallery.live](https://peanutgallery.live)** are served from a separate repo — plain static HTML on GitHub Pages, no build step:

**[Sethmr/peanut.gallery.site](https://github.com/Sethmr/peanut.gallery.site)**

Kept out of this repo on purpose: the extension ships on a code-review cadence, the site iterates on a copy-and-design cadence, and separating them means marketing changes never sit behind a CWS review queue.

---

## Contributing

**Always commit after finishing a workload worth pushing to test.** Don't let changes pile up across multiple features — commit after each logical unit of work so it can be tested, reviewed, and reverted independently if needed.

Commit message format: `type: short description — the witty why`

Types: `feat`, `fix`, `chore`, `debug`, `test`, `docs`

Examples:
```
feat: Chrome extension for tab audio capture — YouTube can't block what it can't see
fix: stall detector now handles browser audio mode correctly
chore: clean repo for open-source release
```

---

MIT License | Fact-checking powered by Brave Search
