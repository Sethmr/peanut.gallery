# Peanut Gallery

> **A four-seat AI writers' room that watches YouTube with you and reacts in real time.** A fact-checker keeping the host honest. A sound-effects guy scoring every moment. A comedy writer dropping one-liners. A cynical troll saying what the audience is thinking.

[![Version](https://img.shields.io/badge/version-1.5.0-000000?style=flat-square&label=version&labelColor=444)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.4%20live%20(v1.5%20in%20review)-34a853?style=flat-square&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh)
[![Site](https://img.shields.io/badge/site-peanutgallery.live-000?style=flat-square)](https://www.peanutgallery.live)

Peanut Gallery is a Chrome Manifest-V3 extension. It captures the active tab's audio silently (`chrome.tabCapture` — no permission picker, no playback interference), streams PCM to a local or hosted backend, transcribes with Deepgram Nova-3, and routes each chunk through a rule-based Director that picks which of four personas gets to fire next. Text reactions stream back via SSE and stack in the native Chrome side panel right next to the video.

Built in response to [Jason Calacanis](https://x.com/Jason) and [Lon Harris](https://x.com/Lons)'s $5K open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups). The TWiST pack (v1.3.0) puts Jason, Molly Wood, Lon Harris, and Alex Wilhelm on the panel — inspired by, not impersonating, with anti-impersonation guardrails baked into every prompt.

---

## Quickstart

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut.gallery
./setup.sh          # installs deps + scaffolds .env.local for your API keys
npm run dev         # local backend on http://localhost:3000
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder at the repo root
4. Open any YouTube video → click the 🥜 icon → **Start Listening**

Your keys live in `.env.local` on your machine — git-ignored, never uploaded. Most users don't need to clone anything: [**install v1.4 from the Chrome Web Store**](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh) (v1.5 currently in CWS review).

**Prerequisites:** Node.js 18+. No yt-dlp or ffmpeg required for the extension flow.

---

## The Cast

Every pack ships four archetype slots. The Director is pack-agnostic — same routing, same cascade, same cooldowns — only the voices change.

### Howard Stern Show (default)

Inspired by the Stern staff, per Jason's original spec.

| Slot | Character | Model | Role |
|------|-----------|-------|------|
| **Producer** | Baba Booey (Gary Dell'Abate) | Claude Haiku + Brave Search (or xAI Live Search) | Fact-checker. Pulls receipts mid-show on numbers, dates, attributions. |
| **Troll** | The Cynical Troll | xAI Grok 4.1 Fast | Contrarian. Internet-brain energy. Says what the audience is thinking. |
| **Sound FX** | Fred Norris | xAI Grok 4.1 Fast | Bracket-delimited sound cues plus deadpan one-liners. |
| **Joker** | Jackie Martling | Claude Haiku | Setup-punchline jokes, callbacks, observational comedy. |

Sample fires:

> *Baba Booey:* [FACT CHECK] "Jason just said Uber was founded in 2007. It was 2009. Again."
>
> *Troll:* "Oh cool, another AI wrapper. Very 2024."
>
> *Fred:* [record scratch] Fun fact: that company went bankrupt in 2023. [sad trombone]
>
> *Jackie:* "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

### This Week in Startups (since v1.3.0)

Researched from public TWiST transcripts and episode clips. See [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md) for the characterization source.

| Slot | Character | Model | Role |
|------|-----------|-------|------|
| **Producer** | Molly Wood | Claude Haiku + Brave Search (or xAI Live Search) | Calm journalistic corrections, "according to" framing, receipts-first. |
| **Troll** | Jason Calacanis | xAI Grok 4.1 Fast | Provocateur. Confident takes, founder-market-fit framing, warm-not-mean. |
| **Sound FX** | Lon Harris | xAI Grok 4.1 Fast | The Reframe. Bracket-delimited sound cues plus cultural analogies. |
| **Joker** | Alex Wilhelm | Claude Haiku | Data Comedian. Eight joke techniques built on data plus absurdity. |

Pack choice lives in the side-panel setup dropdown and persists across sessions. Change takes effect on the next Start Listening — no mid-session persona swap.

More packs coming in v1.7 via [Pack Lab](docs/ROADMAP.md#v170-pack-lab). Want one sooner? Open a [pack request](.github/ISSUE_TEMPLATE/pack_request.yml).

---

## How It Works

```
YouTube Tab → chrome.tabCapture → Offscreen Doc → PCM 16kHz (250ms chunks)
           → Backend → Deepgram Nova-3 → Director → AI Personas → SSE → Side Panel
```

The **Director** is the moat. It's a rule-based booth producer that reads each transcript chunk and picks the best persona to respond, then cascades to others with decreasing probability and staggered timing. Some moments get 1 reaction, some 2-3, occasionally all four pile on. As of v1.5 the Director can optionally consult a Claude Haiku routing model within a 400ms budget and fall back to the rule-based scorer on timeout — best of both worlds, no extra latency.

The **Fact-Checker** has an extra step: it scores sentences for factual claims and runs parallel search queries to cross-reference. Pick **Brave Search** (separate key, dedicated search API) or **xAI Live Search** (reuses your xAI key, no extra signup) in the side-panel settings.

Full architecture, SSE event protocol, and cost table: [`docs/CONTEXT.md`](docs/CONTEXT.md).

---

## Running a Backend

The extension speaks to any backend that honors the wire spec. Three paths:

### 1. Hosted (default, easiest)

Point the extension at `https://api.peanutgallery.live` and bring your own API keys via the side-panel settings. Your keys are sent per-request as headers, forwarded to Deepgram / Anthropic / xAI / Brave, and discarded at session end. Never logged, never persisted. [Audit the route](https://github.com/Sethmr/peanut.gallery/blob/main/app/api/transcribe/route.ts).

### 2. Self-host the reference backend

The Next.js backend in this repo ships with a Dockerfile (yt-dlp + ffmpeg pre-installed for the legacy URL-paste endpoint). Railway recommended:

```bash
npx @railway/cli login
npx @railway/cli init -n my-peanut-gallery
npx @railway/cli up
```

Or any Docker host:

```bash
docker build -t peanut-gallery .
docker run -p 3000:3000 peanut-gallery
```

No server-side env vars needed — users provide their own keys through the UI. Full operator's guide: [`docs/SELF-HOST-INSTALL.md`](docs/SELF-HOST-INSTALL.md).

### 3. Build your own backend in any language

Don't want to run Node? Want to swap the persona stack, change providers, or ship a branded fork in Go / Rust / Python? The extension will happily talk to anything that honors the wire spec.

- [`docs/BUILD-YOUR-OWN-BACKEND.md`](docs/BUILD-YOUR-OWN-BACKEND.md) — the canonical contract. Endpoint shapes, SSE event protocol, audio format, director + cascade rules, persona prompts, required CORS headers, 8 acceptance tests you can paste into curl.

**Or let Claude do it for you.** Paste [this prompt](docs/BUILD-YOUR-OWN-BACKEND.md#hand-the-job-to-claude) into Claude Code after cloning — it reads the spec, scaffolds the project, and stops at the acceptance tests so you can verify compatibility before going live.

---

## Stack

Multi-provider by design. No platform trap.

| Layer | Tech | Why |
|-------|------|-----|
| Backend | Next.js 15 App Router + Edge runtime | SSE streaming + free Vercel tier |
| Transcription | Deepgram Nova-3 | Sub-300ms, WebSocket native |
| Fact-Checker + Joker | Anthropic Claude Haiku | Reasoning + nuance |
| Troll + Sound FX | xAI Grok 4.1 Fast (non-reasoning) | Reflexive, punchy output without deliberation |
| Fact-check search | Brave Search API **or** xAI Live Search | User-selectable per-session |
| Smart Director (v1.5) | Claude Haiku, 400ms budget | Optional LLM routing with rule-based fallback |

**Cost per 2-hour episode: ~$1.15** at current API rates (Deepgram + Haiku + Grok Fast + one search call per fact-check candidate). Full breakdown: [`docs/CONTEXT.md#cost-per-episode`](docs/CONTEXT.md#cost-per-episode).

---

## API Keys

All services have free tiers.

| Key | Sign up | Required? |
|-----|---------|-----------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | Yes |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Yes — powers the Fact-Checker + Joker |
| xAI | [console.x.ai](https://console.x.ai) | Yes — powers the Troll + Sound FX, plus optional Live Search |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | Optional — only when `SEARCH_ENGINE=brave`; skip it if you route search through xAI |

---

## Roadmap

Canonical source: [`docs/ROADMAP.md`](docs/ROADMAP.md). The sequence below is the explicit path to v2.0 — "The Gallery."

| Version | Theme | Status |
|---------|-------|--------|
| v1.2.0 | Mise en place — Director debug panel, fixture harness, husky pre-merge gate | ✅ Shipped |
| v1.3.0 | TWiST Pack — selectable packs, Howard + TWiST voices | ✅ Shipped |
| v1.4.0 | Grok & Stability — xAI migration, search toggle, session-firing deadlock fix | ✅ Shipped |
| v1.5.0 | The Broadsheet — Smart Director v2 + tabloid rebrand + Path-2 URL readiness | ✅ Shipped |
| v1.5.1 | Broadsheet Final — settings drawer with six submenus, round persona mugs, ON AIR waveform, episode card, 15-min free-tier status strip, smooth-scrolling transcript ticker, muted-mug + filter-pill strike visuals | ✅ Shipped |
| v1.6.0 | Settings Pane — dedicated settings surface + UI/UX polish pass | Planned |
| v1.7.0 | Smart Director GA — LLM director becomes the only director; static scorer retires | Planned |
| v1.8.0 | Peanut Mascots — illustrated peanut avatars per persona, each with their signature prop | Planned |
| v1.9.0 | Bobbleheads (Stretch) — 2-day attempt at 3D peanut bobbleheads; max-credible visual upgrade if 3D doesn't land | Planned |
| v2.0.0 | The Gallery — audit, refine, session recall + shareable snippet, launch | Horizon |
| v2.x.x | Director + persona model improvements while we wait for user-driven 3.0 direction | Post-launch |
| v3.0.0 | **User-driven** — direction defined by what 2.0 users ask for, not by us | TBD |

Already supported, not yet marketed: non-YouTube sources (Twitch, Kick, any browser tab). `chrome.tabCapture` is tab-agnostic; personas are just tuned for podcast pacing.

---

## Contributing

Read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). The short version: **ship specific, useful PRs.** One logical change per PR. Fixtures for any director-routing change. Screenshots for any UI change. Risk tier on every PR.

- **Bugs:** [report here](.github/ISSUE_TEMPLATE/bug_report.yml) — include version, backend, pack, repro steps, console.
- **Features:** [request here](.github/ISSUE_TEMPLATE/feature_request.yml) — lead with the problem, not the solution.
- **New persona packs:** [pack request](.github/ISSUE_TEMPLATE/pack_request.yml) — the four-archetype mapping forces the right shape early.
- **Security:** don't open a public issue. See [`.github/SECURITY.md`](.github/SECURITY.md).
- **Help:** [`.github/SUPPORT.md`](.github/SUPPORT.md) is the triage guide.
- **Community norms:** [`.github/CODE_OF_CONDUCT.md`](.github/CODE_OF_CONDUCT.md).

---

## Sponsor

Peanut Gallery is built in the open on nights and weekends. If you get value from it, [sponsor Seth on GitHub](https://github.com/sponsors/Sethmr). Sponsors get early builds, pack-request priority, and a real thank-you in release notes.

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale. Built for **[This Week in Startups](https://x.com/twistartups)** — Jason Calacanis and Lon Harris.

Marketing site (separate repo, zero build step, iterates on a copy-and-design cadence):
[**Sethmr/peanut.gallery.site**](https://github.com/Sethmr/peanut.gallery.site) → served at [www.peanutgallery.live](https://www.peanutgallery.live).

---

## License

[MIT](LICENSE). Fact-checking powered by Brave Search and xAI Live Search. Peanut Gallery is not affiliated with YouTube, Google, SiriusXM, or TWiST — personas are inspired by, not impressions of.
