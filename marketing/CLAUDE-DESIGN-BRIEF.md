# Claude Design — Peanut Gallery setup brief

A paste-ready project brief for Claude Design (Opus 4.7, launched 2026‑04‑17). The goal: one shared project that generates every SEO asset — CWS screenshots, promo tiles, OG images, persona pack covers, blog header art, and X/LinkedIn cards — without redrawing the brand each time.

Open Claude Design, create a new project titled **Peanut Gallery — brand kit + SEO asset factory**, and paste the sections below into the fields Claude Design surfaces (description, tokens, references, voice, output library). If Claude Design doesn't have a field that matches a section, paste it into the project's `README` / brief area.

---

## Project description (paste verbatim)

> Peanut Gallery is a free, open‑source Chrome extension that adds a live AI writers' room to any YouTube video. Four personas — a fact‑checker, a comedy writer, a sound effects guy, and a cynical troll — react in real time from Chrome's native side panel. It was built to win Jason Calacanis's $5k "live AI sidebar" bounty on *This Week in Startups*. Stack: Deepgram Nova‑3 → Claude Haiku + xAI Grok 4.1 Fast → Chrome side panel. Dark, late‑night-TV aesthetic. Voice is confident, dry, a little irreverent — more *Letterman writers' room* than *SaaS landing page*.
>
> This project is the asset factory for every public surface: Chrome Web Store listing, peanutgallery.live landing page, GitHub social card, YouTube thumbnails, X/LinkedIn cards, and blog headers. Every asset must pass two tests: (1) recognizable as Peanut Gallery at 128×128 px, (2) stops the scroll on a feed dominated by SaaS gradient slop.

---

## Design tokens (paste into the project's tokens / variables panel)

### Brand colors
| Token | Hex | Use |
|---|---|---|
| `bg.primary` | `#0a0a0a` | Full-bleed backgrounds. The base of every asset. |
| `bg.secondary` | `#141414` | Panels, cards, layered surfaces. |
| `bg.tertiary` | `#1a1a1a` | Inner panels, form fields, code blocks. |
| `text.primary` | `#e5e5e5` | Body copy on dark. |
| `text.dim` | `#9a9a9a` | Captions, metadata, "as seen on". |
| `text.bright` | `#ffffff` | Headlines, hero text, logo. |
| `accent.blue` | `#3b82f6` | Fact‑checker persona. Primary CTA on light variants. |
| `accent.red` | `#ef4444` | Troll persona. Live/recording indicators. |
| `accent.purple` | `#a855f7` | Comedy writer persona. |
| `accent.amber` | `#f59e0b` | Sound effects guy persona. Highlighted quotes. |

### Persona palette rule
Each persona owns exactly one accent. Never swap. Never blend. If an asset needs a single "hero" accent and no persona is named, use `accent.blue`.

### Type
| Token | Font | Use |
|---|---|---|
| `font.display` | Space Grotesk 600/700 | H1, hero, short punch copy. |
| `font.body` | Inter 400/500/600 | Everything else. |
| `font.mono` | JetBrains Mono (or system mono) | Code, keyboard shortcuts, API responses. |

### Radii + spacing
- Corner radii: `4px` (inputs), `8px` (cards), `12px` (panels), `9999px` (pills, avatars).
- Base grid: 4px. Copy never sits tighter than 16px from a card edge.

### Shadow + glow rules
- No heavy drop shadows. The brand lives in matte black.
- Persona avatars may have a 2px accent ring when "speaking" — fade, not glow.
- Live indicators: 1.5s pulse on `accent.red`, same ease as `livePulse` in `globals.css`.

---

## Reference images (upload these into the project's reference library)

Upload, in order, so Claude Design anchors on them:

1. `/sessions/practical-busy-pasteur/mnt/peanut.gallery/marketing/promo/` — every existing promo tile & screenshot currently in CWS. These are the "must look like this family" anchors.
2. `/sessions/practical-busy-pasteur/mnt/peanut.gallery/public/og-image.png` — the current OG/Twitter card. Use its composition as the default for new social cards.
3. `/sessions/practical-busy-pasteur/mnt/peanut.gallery/public/icons/icon128.png` — the product icon, sacred. Never regenerate without approval.
4. **Howard Stern writers' room photo reference** (Seth to drop in) — the emotional North Star. Cluttered desk, shared mic, late-night energy.
5. **Letterman / Conan late-night stage references** — for hero compositions where we want the "four chairs, one host" energy.

Tell Claude Design: *"Every asset should feel like one of the reference late-night sets redrawn in our palette. If a generation looks like a SaaS landing page, reject it and try again."*

---

## Brand voice (paste into the project's voice/tone field)

- **Confident, dry, a little irreverent.** We don't over-explain. We don't say "empowering" or "delightful."
- **Writers' room, not product team.** We talk about jokes, bits, running gags, hot takes — not "user flows" or "value props."
- **Receipts over claims.** If a persona claims a fact, we show the fact. If we claim speed, we show the latency.
- **Never cute about the bounty.** $5k from Jason is the origin, not a punchline. Acknowledge once, move on.
- **Never hedge.** No "helps you," "try to," "can allow." Either it does it or it doesn't.
- **Anti-patterns to reject:** gradient blobs, abstract 3D shapes, AI brain icons, rocket emojis, "next-gen", "revolutionary", em-dash overload in copy (the product uses `—` on purpose in the UI; marketing copy can breathe).

---

## Asset priority list — Week 1 to Week 4

Generate in this order. Each line is a Claude Design prompt seed.

### Week 1 (SEO-PLAN §4 — ship this week)
1. **CWS screenshot 01 — "The hero shot"** (1280×800, PNG). Chrome side panel open on a YouTube video of a TWiST episode. Four persona avatars stacked vertically, one mid-typing. Amber highlighted quote from the sound effects guy. Caption row beneath: "Four AI personas react live. No tab switching."
2. **CWS screenshot 02 — "The fact-checker moment"** (1280×800). Side panel zoomed on a fact-checker message with a citation link + source favicon. Blue accent. Caption: "Every claim gets a receipt."
3. **CWS screenshot 03 — "The troll"** (1280×800). Red accent. Troll message mid-roast. Caption: "Your loudest friend, on tap."
4. **CWS screenshot 04 — "The comedy writer"** (1280×800). Purple accent. Comedy writer serving a callback to an earlier moment. Caption: "Running gags. Actual ones."
5. **CWS screenshot 05 — "The side panel, explained"** (1280×800). Chrome UI diagram showing the side panel opening from Chrome's native button — no overlay, no picker. Caption: "Native Chrome side panel. YouTube can't detect it."
6. **CWS promo tile — small** (440×280, PNG). Product icon + wordmark + "AI writers' room for YouTube." Amber accent on the pull quote.
7. **CWS promo tile — marquee** (1400×560, PNG). Wide cinematic. Four persona avatars across the frame, each in their own accent. Tagline: "Four AIs. One YouTube video. Live."
8. **OG / Twitter card v2** (1200×630, PNG). Replaces `public/og-image.png`. Must survive Twitter's card compression — no text smaller than 28px.

### Week 2 (persona pack landing pages — SEO‑PLAN §3 Part B)
9. **Howard pack cover** (1200×630). Stern's writers' room aesthetic without using his likeness — shared-mic silhouette, cluttered desk, one lamp.
10. **TWiST pack cover** (1200×630). Four chairs, one round table, laptop open on the "live" dot.
11. **"/packs" index hero** (1600×600). Both packs side-by-side in a mosaic.

### Week 3 (content marketing — SEO‑PLAN §3 Part C)
12. Blog header template (1600×800, with a `{{title}}` slot Claude Design can refill). Amber accent strip along the bottom third.
13. YouTube thumbnail template (1280×720, with a `{{face}}` + `{{title}}` slot). Used for the v1.5 walkthrough and every future demo.

### Week 4 (ongoing + social)
14. X post card (1200×675) for "what we shipped this week" posts.
15. LinkedIn card (1200×627) for longer-form launch announcements.
16. GitHub social preview card (1280×640) — replaces default repo card.

---

## Frontier‑design play (do this once, then bank the outputs)

In the same project, run **three** separate generations of the OG card with Claude Design's "push the frontier" mode. One that looks like a Criterion Collection cover. One that looks like a *Rolling Stone* music feature. One that looks like the back cover of an O'Reilly book. Keep whichever one Jason would screenshot. Bank the other two for future launches (v1.6, v2.0).

---

## Boundary clause — what Claude Design does NOT do

Claude Design is the **asset factory**, not the **brand authority**. The source of truth for brand tokens lives in `tailwind.config.ts` and `app/globals.css`. If a Claude Design generation disagrees with those files, the files win. Update the files first, then regenerate the assets — never the reverse.

If Claude Design produces something we love that we can't reproduce with current tokens, treat that as a **token proposal**. Open a PR that adds the token to `tailwind.config.ts`, land it, then bank the asset.

---

## Outputs directory

Every asset Claude Design produces lands in:

```
marketing/promo/claude-design/{{yyyy-mm}}/{{asset-name}}.png
```

With a sibling `.json` file containing the generation prompt, seed (if exposed), and Seth's accept/reject note. This lets v2.0 re-run the factory from scratch if the brand drifts.
