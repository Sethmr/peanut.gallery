# Authors and Credits

Peanut Gallery stands on a lot of shoulders. This is the short ledger.

## Built by

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale. Design, architecture, backend, Chrome extension, persona prompts, character research, everything that broke at 2am.

## The bounty that started it

**[Jason Calacanis](https://x.com/Jason)** and **Lon Harris** — the TWiST AI sidebar bounty on *This Week in Startups* is the reason this project exists. $5,000 plus a guest spot; the spec was tight; the deadline was real. [Original brief](https://www.youtube.com/@ThisWeekInStartups).

The TWiST persona pack in v1.3.0 (Molly Wood / Jason Calacanis / Lon Harris / Alex Wilhelm) is an inside-baseball thank-you, researched from public transcripts and shipped with anti-impersonation guardrails in every prompt. Characterization source: [`docs/packs/twist/RESEARCH.md`](docs/packs/twist/RESEARCH.md).

## Design

The tabloid / newsprint side-panel rebrand that landed in v1.5 ("The Broadsheet") was designed in collaboration with **Claude Design** — Anthropic's design agent — iterating on Anton slab, Special Elite, and Source Serif 4 against the full spec in [`marketing/CLAUDE-DESIGN-BRIEF.md`](marketing/CLAUDE-DESIGN-BRIEF.md). The palette, composition grid, and type hierarchy are Claude Design's. The engineering and behavior are Seth's.

## Inspiration

- The **Howard Stern Show** for the four-seat writers'-room structure that maps cleanly onto "producer / troll / soundfx / joker" — the best radio producers have always known that a show is a group.
- **NotebookLM** for proving that a podcast-adjacent UX with real AI personas can feel like a product, not a demo.
- **Dmooji** and **ai_licia** for showing that overlay-style reactions have an audience, and for sharpening the "Director is the moat" thesis by contrast.

## Stack

No project is possible without the tools it's built on. Peanut Gallery owes:

- **Next.js** (Vercel) — App Router + Edge runtime + SSE streaming.
- **Deepgram** — Nova-3 streaming ASR. Sub-300ms first byte is why the product feels live.
- **Anthropic** — Claude Haiku powers the Fact-Checker, the Joker, and (optionally) the Smart Director v2 router.
- **xAI** — Grok 4.1 Fast powers the Troll and Sound FX and optionally the Fact-Checker's live search.
- **Brave Search** — dedicated search API for fact-check receipts.
- **Chrome Extensions team** — `chrome.tabCapture`, the offscreen documents API, and the native Side Panel are the three primitives the product couldn't exist without.
- **Tailwind** + **shadcn/ui** — the site and admin surfaces.
- **Railway** and **Vercel** — hosting infra for the reference backend.

## Contributors

A full list of contributors will live here as the project grows. PRs are credited in the commit log and in each release's `releases/v*.*.*-release-notes.md`.

Want your name here? [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) has the PR checklist.

## Sponsors

If you've sponsored Seth on GitHub and want to be listed here by name or handle, note it in your sponsorship message — otherwise we respect the default private-by-default setting. [Sponsor page](https://github.com/sponsors/Sethmr).
