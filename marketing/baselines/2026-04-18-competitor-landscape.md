# Chrome Web Store competitive landscape — 2026-04-18

Pulled live from chrome-stats.com via Chrome MCP. Supplements the qualitative landscape in `docs/COMPETITIVE-LANDSCAPE-2026-04-18.md` with hard install numbers, category placements, and keyword ranks.

## Top-of-category snapshot

| Extension | Users | Rating | Category | Overall rank | Created | Closest positioning |
|---|---|---|---|---|---|---|
| **Glasp — YouTube Summary with ChatGPT & Claude** | **2,000,000** | 4.32 (3,680) | — | — | — | Summarizer (market leader) |
| **NoteGPT — YouTube Summary, Chat with AI** | 400,000 | 4.91 (6,438) | Tools | #756 | 2023-02 | Summarizer + note-taker + AI chat |
| **Eightify — AI YouTube Summarizer** | 200,000 | 4.03 (834) | — | — | — | Summarizer |
| **Clarify AI — YouTube Summaries** | 20,000 | 4.37 (1,291) | — | — | — | Summarizer |
| **Dmooji — YouTube Danmaku** | 20,000 | 4.78 (1,732) | Entertainment | #5,372 | 2019-09 | Overlay comments + AI chat ("danmaku") |
| **Peanut Gallery** (us) | ~TBD (need CWS Dashboard check) | — | Productivity | — | 2026-04 | Live AI reactions, 4 personas |

## 🚨 The big finding: there is no "live AI reactions" category

Every major "YouTube AI" extension is a **summarizer**. The YouTube-AI category is dominated by:

1. **Post-watch summarization** (Glasp, NoteGPT, Eightify, Clarify AI, Mapify, ReelText, Summario) — most of the top 30.
2. **Transcription / translation** (AI Speak Subtitles, YouTube Transcript AI, VidSummize).
3. **Mind maps / notes** (Mapify, Wisdom Eye, NoteGPT).
4. **Overlay comments / danmaku** (Dmooji, DanMage).

**Nobody is doing live AI reactions.** Peanut Gallery is in a **blue ocean**. That's both the opportunity and the SEO problem:

- ✅ Zero direct-keyword competition for "live AI reactions YouTube".
- ❌ Zero existing search demand for "live AI reactions YouTube".
- ⚠️ Users searching the big existing queries (`youtube ai`, `youtube summary`) are looking for a summarizer, not us.

This changes the SEO strategy materially — see §"Strategic implications" below.

## Category-choice evidence

Where top YouTube-AI extensions sit:

| Extension | Category |
|---|---|
| NoteGPT | **Tools** |
| Dmooji | **Entertainment** |
| Glasp | — (not surfaced) |
| Eightify | — (not surfaced) |

Our current category is **Productivity**. **None of the observed leaders are in Productivity.** The two biggest data points (NoteGPT in Tools, Dmooji in Entertainment) suggest we should seriously test Tools as an alternative.

## Keyword rank benchmarks (from NoteGPT's rankings)

NoteGPT, at 400K users, ranks:
- #8 in "ai youtube summary" (keyword demand score 51)
- #8 in "youtube summary" (keyword demand score 50)
- #13 in "summary" (keyword demand score 47)

**Implication:** even the category-leading extension only ranks #8 on its own core query. The top 3 spots are held by extensions not in our data (probably Glasp + 2 others). Cracking top-10 for a new keyword is a realistic 3–6 month target; cracking top-3 requires either massive install count or very niche keywords.

## Our unique differentiators (validated against this landscape)

| Feature | Our claim | Supported by landscape? |
|---|---|---|
| Live (streaming, not post-hoc) | "react in real time" | ✅ Nobody else does this |
| 4 distinct personas | "fact-checker, troll, comedy writer, sound guy" | ✅ Nobody else does this |
| Chrome Side Panel native | "no tab switching" | ⚠️ NoteGPT used sidePanel, removed it in July 2025 — we need to understand why |
| No sign-up required | "bring your own keys" | ✅ Every major competitor requires login/account |
| Open source | "MIT, self-hostable" | ✅ Nobody in the top 5 is open source |
| Multiple AI providers | "Deepgram + Claude + Grok" | ✅ Others use one vendor |

**Red flag:** NoteGPT **removed** the `sidePanel` permission in July 2025. Possible reasons: (a) Chrome's side panel had bugs that users complained about, (b) it cannibalized their in-tab overlay UX, (c) they hit a platform limitation we haven't. **I should investigate this.** It could be a signal that side panel has rough edges we haven't hit yet, OR that our "native side panel" marketing claim is stronger than we realized.

## Dmooji review-mining — competitor pain points

Dmooji's 1-star reviews highlight our opportunities:
- "Login is required and many users cannot login" → we have **no login**.
- "Danmaku stops showing after updates" → we have persona-level fault isolation (one persona failing doesn't break the others).
- "Privacy concerns about server-side posting" → we have **MIT-licensed, self-hostable**.
- "Browser compatibility issues (Brave blocks account access)" → we require no account.

**Copy angle for CWS listing + landing page:** "No login. No servers you have to trust. No updates that break the core feature." That's a direct response to the top 3 pain points in our closest-adjacent competitor's review base.

## Strategic implications for the SEO plan

1. **Category test is now urgent.** We're in Productivity; leaders are in Tools and Entertainment. P1 (category audit) should explicitly run a rank test with us in Tools — that's where NoteGPT ranks well, and our use case is closer to Tools than Entertainment.
2. **Keyword strategy should split into two tracks:**
   - **Defensive (existing demand):** target `youtube ai`, `youtube summary`, `youtube chrome extension`. Low conversion rate (users want a summarizer, not reactions) but real impression volume.
   - **Demand-creation (new category):** target `ai reactions youtube`, `live ai youtube`, `ai writers room`. Zero competition but also near-zero volume. Needs content marketing + YouTube videos + podcast mentions to seed the query.
3. **The competitor-pain-points copy angle deserves its own landing-page section.** "Why Peanut Gallery isn't Dmooji / NoteGPT / Glasp — a feature comparison table" would rank for branded compare queries and convert well.
4. **Consider adding a "post-watch summary" secondary feature** at some point. Every major competitor offers this; if we added a 5th persona that produces a summary at the end of a video, we'd capture defensive queries without losing our core positioning.

## Action items surfaced by this pull

1. **[P1 extension]** Add "rank in Tools category" to the P1 worksheet tests.
2. **[P2 extension]** Add `youtube summary` and `youtube ai` as defensive-track keyword slots if we have space — low conversion but real impression volume.
3. **[Content]** Write a "Peanut Gallery vs. NoteGPT vs. Glasp" comparison post for Week 3 content (per SEO‑PLAN §3 Part C).
4. **[Product]** Investigate why NoteGPT removed the `sidePanel` permission in July 2025. Check changelog, Chrome docs for any 2025 side panel gotchas.
5. **[Wikidata]** When submitting, include `P2283: uses (software)` statements for `sidePanel API`, `tabCapture API`, `Deepgram`, `Claude`, `xAI Grok` — helps entity graph linkage across competitor pages.

## Next pulls (deferred — not in this session)

- Glasp extension detail page (the 2M-user leader — full keyword ranks).
- Questie AI, ai_licia searches (mentioned in docs/COMPETITIVE-LANDSCAPE-2026-04-18.md but not yet pulled).
- Top 10 in "chrome side panel" search — direct competition for our differentiator.
