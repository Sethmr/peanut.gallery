# Peanut Gallery

> **A four-seat AI writers' room that watches YouTube with you and reacts in real time.** A fact-checker keeping the host honest. A sound-effects guy scoring every moment. A comedy writer dropping one-liners. A cynical troll saying what the audience is thinking.

[![Version](https://img.shields.io/badge/version-1.6.0-000000?style=flat-square&label=version&labelColor=444)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.6.0%20"The%20Canary"-34a853?style=flat-square&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh)
[![Site](https://img.shields.io/badge/site-peanutgallery.live-000?style=flat-square)](https://www.peanutgallery.live)

Peanut Gallery is a Chrome Manifest-V3 extension. It captures the active tab's audio silently (`chrome.tabCapture` — no permission picker, no playback interference), streams PCM to a local or hosted backend, transcribes with Deepgram Nova-3, and routes each chunk through the **Smart Director** — a Claude-powered routing brain that picks which of four personas gets to fire next (with a rule-based safety net). Text reactions stream back via SSE and stack in the native Chrome side panel right next to the video.

Built in response to [Jason Calacanis](https://x.com/Jason) and [Lon Harris](https://x.com/Lons)'s $5K open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups). The TWiST pack puts Jason, Molly Wood, Lon Harris, and Alex Wilhelm on the panel — inspired by, not impersonating, with anti-impersonation guardrails baked into every prompt. Each persona ships with an illustrated peanut mascot (v1.5.3) with Phong-shaded lighting and animated reactions (v1.6.0).

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

Your keys live in `.env.local` on your machine — git-ignored, never uploaded. Most users don't need to clone anything: [**install the latest build from the Chrome Web Store**](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh).

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

Want another pack? Open a [pack request](.github/ISSUE_TEMPLATE/pack_request.yml) — or author one yourself per [`docs/PACK-AUTHORING-GUIDE.md`](docs/PACK-AUTHORING-GUIDE.md) (living doc: archetype slots, producer contract, `factCheckMode` dial, registration, refinement loop). A visual Pack Lab authoring surface is deferred to post-v2.0; until then the guide plus the two reference packs in [`lib/packs/`](lib/packs/) are the template.

---

## How It Works

```
YouTube Tab → chrome.tabCapture → Offscreen Doc → PCM 16kHz (250ms chunks)
           → Backend → Deepgram Nova-3 → Director → AI Personas → SSE → Side Panel
```

The **Director** is the moat. It reads each transcript chunk and picks the best persona to respond, then cascades to others with decreasing probability and staggered timing. Some moments get 1 reaction, some 2-3, occasionally all four pile on. As of v1.6.0 ("The Canary") the primary router is a Claude Haiku `tool_use` call with verbalized confidence, sticky-agent penalty, unstable-tail heuristic, a live-callback ring buffer, and SILENT as a first-class choice — all behind a 400 ms budget with the rule-based scorer as the safety net. A fast-model shadow (Cerebras Llama 3.1 8B; Groq also wired) logs its pick alongside so we can verify agreement + latency before swapping primaries. The canary is flag-gated: `ENABLE_SMART_DIRECTOR_V2=true` on the backend turns the LLM router on; off keeps everything rule-based.

The **Fact-Checker** has an extra step: it scores sentences for factual claims and runs parallel search queries to cross-reference. Sensitivity is per-pack design: Howard's Baba Booey is `loose` (fires on speculation + name-drops + predictions), TWiST's Molly Wood is `strict` (hard claims only). Pick **Brave Search** (separate key, dedicated search API) or **xAI Live Search** (reuses your xAI key, no extra signup) in the side-panel settings.

If no audio is detected for 60 s, the extension auto-stops the session so it doesn't keep burning backend tokens on a paused tab. Press Start Listening again to resume.

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
| Smart Director (v1.6 canary) | Claude Haiku `tool_use`, 400 ms budget | Primary LLM router; rule-based scorer is the safety net. Cerebras Llama 3.1 8B runs as read-only shadow for agreement + latency validation. |

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

Canonical source: [`docs/ROADMAP.md`](docs/ROADMAP.md). This table is what actually shipped; version numbers reflect reality, not earlier plans.

### Shipped

| Version | Theme | Date |
|---------|-------|------|
| v1.2.0 | **Mise en place** — Director debug panel + structured routing logs + fixture harness + pre-merge gate | 2026-04-17 |
| v1.3.0 | **TWiST Pack** — selectable packs, Howard + TWiST voices, pack swap in side panel | 2026-04-14 |
| v1.4.0 | **Grok & Stability** — xAI migration for troll + sound FX, search-engine toggle, session deadlock fix | 2026-04-17 |
| v1.5.0 | **The Broadsheet** — tabloid side-panel rebuild, mute-a-critic, night theme, Markdown export | 2026-04-19 |
| v1.5.1 | **Broadsheet Final** — 6-submenu settings drawer (absorbs old v1.6 "Settings Pane"), free-tier status strip, ON AIR, per-mug waveforms, round mugs | 2026-04-20 |
| v1.5.2 | **First Run** — four-step Editor's Note onboarding tour, empty-state visibility fix | 2026-04-20 |
| v1.5.3 | **The Cast** — illustrated peanut mascots for all 8 personas (absorbs old v1.8 "Peanut Mascots"), war-defense guardrail on fact-checkers | 2026-04-20 |
| v1.5.4 | **The Sweep** — SEO refresh, legacy `/watch` deletion, a11y pass, ops logging, orphan-dep cleanup | 2026-04-20 |
| v1.5.5 | Dev-infra — Linear ticket → Claude Code kickoff pipeline, framework + dev-dep refresh, release-model rewrite | 2026-04-20 |
| v1.5.6 | Dev-infra — local Linear daemon on Seth's Mac (replaces GH-Actions kickoff, uses Claude Max subscription) | 2026-04-20 |
| **v1.6.0** | **The Canary** — Smart Director v3 flag-gated canary (Haiku `tool_use`, 5-slot with SILENT, Cerebras/Groq shadow), fact-check gate with per-pack sensitivity, fallback telemetry + self-correcting penalty loop, peanut avatar stage 1 (Phong lighting + unclipped bottoms), empty-state companions, director debug panel, 60s silence auto-stop | 2026-04-21 |

### Next

| Version | Theme | Status |
|---------|-------|--------|
| v1.7.x | **Smart Director GA** — once the v1.6 canary clears agreement + latency bands, promote the LLM router to primary and retire the rule-based scorer. Per-pack `directorHint` calibration from canary telemetry. Kill-switch flag stays. | Blocked on v1.6 canary data (~48 h of hosted sessions) |
| v1.8.x | **Persona refinement sprint** — re-run system prompts against 100+ transcripts per pack, tune anything the canary says is under-firing. See [`docs/PERSONA-REFINEMENT-PLAN.md`](docs/PERSONA-REFINEMENT-PLAN.md). | Blocked on v1.7 canary |
| v1.9.x | **Subscription tier (alt to BYOK)** — in-app toggle between "use my keys" and "use subscription"; weekly-hours cap targeted above top-10% user usage; self-hosters and source-builders keep BYOK unchanged. See [`docs/ROADMAP.md § Subscription`](docs/ROADMAP.md#subscription-tier-pre-v20). | Planning — see planning doc |
| v1.10.x | **Avatar stage 2** — bobbleheads / 2.5D parallax / Lottie / MP4 fallback, whichever reads best in a 2-day spike. Contingent on Seth's Day-1 eval. | Planned |
| **v2.0.0** | **The Gallery** — session recall + shareable snippet (local, PNG-to-clipboard), full audit, marketing-site refresh, launch day | Horizon |
| v2.x.x | Continuous Director + persona improvements while we wait for user-driven v3 direction | Post-launch |
| v3.0.0 | **User-driven** — direction defined by what v2.0 users ask for, not by us | TBD |

Already supported, not yet marketed: non-YouTube sources (Twitch, Kick, any browser tab). `chrome.tabCapture` is tab-agnostic; personas are tuned for podcast pacing so it's "works, not pitched" until a pack tunes for a different format.

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
