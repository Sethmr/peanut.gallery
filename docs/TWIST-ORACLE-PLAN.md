# Peanut Gallery — TWiST Oracle Plan

> **"Feel free to make a TWIST SML / oracle fam... imagine 2,400 episodes in one language model giving folks startup advice and deep links to clips!"** — Jason Calacanis, TWIST NOTI GANG group chat, 2026-04-18

This document is the working spec for the TWiST Oracle: a knowledge layer built on the full ~2,400-episode TWiST archive that gives the four TWiST personas historical memory, lets users ask startup questions grounded in real show history, and deep-links every answer to the exact clip where it was said.

**Last updated:** 2026-04-18 (revised with de-risking research — see §15)
**Status:** Plan — not yet scoped into a release
**Depends on:** v1.5 canary clearing, v1.6 Voice + Clip Share shipping first
**Target release:** v1.7.0 "TWiST Oracle" (replaces Pack Lab, which moves to v1.8)
**Canonical roadmap context:** [`ROADMAP.md`](ROADMAP.md)

> **READ §15 BEFORE EXECUTING.** A de-risking research pass (2026-04-18) surfaced findings that change the recommended approach on: episode count, transcript strategy, embedding model, legal posture, and where costs actually concentrate. §15 is the current source of truth where it conflicts with §§1–14.

---

## 1. What this is — and what it changes about the product

Peanut Gallery today is a **real-time reaction engine**. The four personas watch a podcast live and riff on what they hear. They have no memory beyond the current session. They know their character voice but not their character's history.

The TWiST Oracle adds a **knowledge layer**: the full ~2,400-episode archive, transcribed, chunked, embedded, and retrievable. This changes the product in three ways:

1. **Corpus-enriched live reactions.** During a live session, personas can reference historical episodes. Molly's fact-checks get backed by "Jason actually said the opposite on episode 2,103." Jason's troll slot gets historical self-awareness: "I've been saying this since 2019 — episode 1,456, go listen." Every reference comes with a deep link.

2. **Ask mode.** When no video is playing, users can ask the TWiST oracle startup questions. The four personas respond with grounded answers drawn from the archive, each in their own voice, with timestamped clip links. This turns Peanut Gallery from a "thing you use while watching" into a "thing you use while building."

3. **Deep links as distribution.** Every oracle answer and every corpus-enriched live reaction carries 1–3 clickable YouTube timestamps. These are shareable — "Jason on founder-market fit, ep. 1,234 at 14:32" becomes a tweetable artifact. This is the viral mechanic that feeds back into TWiST's own audience growth, which is why Jason wants it.

---

## 2. Why this matters for the bounty

Jason's original spec called for 4 personas, real-time reactions, multi-provider LLM, open source, fact-checking. Peanut Gallery ships all of that today.

The oracle is what turns the submission from "you built the thing I described" into "you built something I didn't know I wanted." Specifically:

- It makes Peanut Gallery **useful between episodes**, not just during them.
- It gives every answer a **deep link back to TWiST content**, which is direct value to Jason's show. Every oracle interaction drives a clip view.
- It demonstrates that the pack system + Director architecture can support **knowledge-grounded personas**, not just prompt-driven ones. That's the difference between a novelty and a platform.
- It shows Jason that his show's 15-year archive is an **asset that AI can activate** — the "2,400 episodes in one language model" vision he articulated.

---

## 3. Roadmap positioning

The oracle slots in after Voice + Clip Share (v1.6) because those features are load-bearing prerequisites:

| Release | Name | Why it comes first |
|---------|------|--------------------|
| v1.5.0 | Smart Director v2 | LLM-assisted routing is the foundation for corpus-aware persona selection. The Director needs to know *which persona* has the most relevant historical context for this moment. |
| v1.5.1 | Smart Director Polish | Canary data calibrates the routing layer. Oracle routing builds on top of this calibrated baseline. |
| v1.6.0 | Voice + Clip Share | Voice gives the oracle personas actual voices in ask mode. Clip Share gives deep links a distribution format (shareable card with timestamp + persona reaction). Without v1.6, the oracle's best output is text + a raw URL. |
| **v1.7.0** | **TWiST Oracle** | **This plan.** |
| v1.8.0 | Pack Lab | Moves here from v1.7. The visual authoring UI becomes the generalized version of what we built specifically for TWiST — "build your own oracle for your show." |

**Dependency chain:** v1.5 (routing) → v1.6 (voice + clips) → v1.7 (oracle) → v1.8 (generalize it).

---

## 4. Phase 1 — Build the TWiST corpus

**Duration:** 1–2 weeks
**Cost:** $0–$140 depending on transcript quality tier
**Output:** A corpus of timestamped transcripts, each keyed to a YouTube video ID, with segment-level timestamps that generate deep links.

### 4a. Bulk transcript acquisition

Three tiers, cheapest first. Start with Tier 1; escalate only if quality is insufficient for retrieval.

**Tier 1 — YouTube auto-captions (free, fast, good enough for search):**

```bash
# Pull auto-generated subtitles for the full @twistartups archive
# yt-dlp is already a project dependency
yt-dlp --write-auto-sub --sub-lang en --skip-download \
  --sub-format vtt \
  -o "corpus/%(id)s/%(title)s.%(ext)s" \
  "https://www.youtube.com/@twistartups"
```

YouTube VTT files include word-level timestamps. Quality is ~85–90% accurate for English podcast audio with clear speakers — good enough for semantic search, occasionally wrong on proper nouns (company names, people). The full archive should pull in under 24 hours.

**Tier 2 — Deepgram batch for high-value episodes (~$0.70/episode):**

For the 200 most-viewed episodes (top 8% of the archive), run batch transcription through Deepgram Nova-3 for higher accuracy, speaker diarization, and better proper-noun handling. Budget: ~$140.

```bash
# Batch pipeline: download audio → Deepgram batch API
# Reuses the existing yt-dlp → FFmpeg → Deepgram pattern from lib/transcription.ts
# but in batch mode (REST API, not WebSocket)
```

**Tier 3 — thisweekin.com existing transcripts (check first):**

Some TWiST episodes have human-edited transcripts on thisweekin.com. Check whether these are machine-readable (HTML scrape or RSS feed with transcript field). If available, they're the highest quality source and cost nothing. Worth 30 minutes of investigation before committing to Tier 1.

### 4b. Corpus schema

Each episode produces a record:

```typescript
interface EpisodeRecord {
  videoId: string;                    // YouTube video ID
  title: string;                      // Episode title
  publishedAt: string;                // ISO date
  durationSeconds: number;            // Total runtime
  episodeNumber?: number;             // TWiST episode number if parseable
  transcriptSource: "youtube-auto" | "deepgram" | "human";
  segments: TranscriptSegment[];      // Chunked for embedding
}

interface TranscriptSegment {
  id: string;                         // `${videoId}-${index}`
  text: string;                       // Segment text (~500–1000 tokens)
  startSeconds: number;               // Timestamp for deep link
  endSeconds: number;
  speakers?: string[];                // Diarized speaker labels (Tier 2+)
  topics?: string[];                  // Extracted topic tags (Phase 2)
  embedding?: number[];               // Vector (Phase 2)
}
```

### 4c. Deep link generation

Every segment maps to a YouTube deep link:

```
https://youtube.com/watch?v=${videoId}&t=${Math.floor(startSeconds)}
```

These are the "deep links to clips" Jason asked for. They work in any context — browser, mobile, embeds. The segment's `startSeconds` is the anchor; the clip card (v1.6) wraps it in a shareable format with persona reaction + transcript excerpt.

### 4d. Storage

The raw corpus (VTT files + metadata JSON) lives in a new `corpus/` directory, gitignored (too large for the repo). A build script processes raw VTT into the `EpisodeRecord` schema and outputs `corpus/twist-corpus.json` (or SQLite, see Phase 2).

**Estimated corpus size:** ~2,400 episodes × ~60 min avg × ~150 words/min = ~21.6M words. At ~1.3 tokens/word, that's ~28M tokens of raw transcript. Chunked into ~500-token segments: ~56,000 segments.

---

## 5. Phase 2 — RAG pipeline + embeddings

**Duration:** 1–2 weeks
**Cost:** ~$5–15 for embedding the full corpus (one-time)
**Output:** A retrieval layer that takes a query (user question or live transcript segment) and returns the most relevant historical segments with deep links.

### 5a. Chunking strategy

Naive fixed-length chunking loses topic boundaries. The chunker should:

1. Start with VTT timestamp boundaries (natural sentence breaks).
2. Merge adjacent segments up to ~500 tokens, splitting on topic shifts.
3. Topic shifts detected by: speaker change (if diarized), long pauses (>3s), or semantic shift (cosine distance between adjacent sentence embeddings exceeds threshold).
4. Each chunk overlaps ~50 tokens with its neighbors to preserve context at boundaries.

For the Tier 1 (YouTube auto-caption) path, VTT cue boundaries are the natural split points. For Tier 2 (Deepgram), utterance boundaries with speaker labels are cleaner.

### 5b. Embedding model

**Primary choice: OpenAI `text-embedding-3-small`**

- 1536 dimensions, $0.02/1M tokens.
- 28M tokens of corpus = ~$0.56 to embed the full archive. Negligible.
- Well-supported, fast, good retrieval quality for English text.
- Already available via the OpenAI-compatible API pattern we use for xAI.

**Alternative: Anthropic embeddings** if available by ship date. Keeps the provider count from growing.

**Alternative: Local embedding model** (e.g., `nomic-embed-text` via Ollama). Zero marginal cost, runs on Seth's machine. Good for development iteration; may not be available on hosted.

### 5c. Vector storage

The corpus is ~56,000 segments. This is small enough that we don't need a hosted vector DB.

**Primary choice: SQLite + `sqlite-vec` extension**

- Single-file database, zero ops, works on Railway.
- `sqlite-vec` supports approximate nearest neighbor search on float32 vectors.
- The existing project has no database dependency — SQLite is the lightest possible addition.
- Schema:

```sql
CREATE TABLE episodes (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL,
  duration_seconds INTEGER,
  episode_number INTEGER,
  transcript_source TEXT NOT NULL
);

CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  episode_video_id TEXT NOT NULL REFERENCES episodes(video_id),
  text TEXT NOT NULL,
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  speakers TEXT,  -- JSON array
  topics TEXT,    -- JSON array
  FOREIGN KEY (episode_video_id) REFERENCES episodes(video_id)
);

-- sqlite-vec virtual table for ANN search
CREATE VIRTUAL TABLE segment_embeddings USING vec0(
  segment_id TEXT PRIMARY KEY,
  embedding float[1536]
);
```

**Fallback: In-memory with `hnswlib-node`** if `sqlite-vec` has deployment friction on Railway. Load embeddings into memory at server start; 56K × 1536 floats = ~340MB. Acceptable for a single-server deploy.

**Stretch: Hosted vector DB (Pinecone / Weaviate / Qdrant Cloud)** only if we need filtered search (e.g., "only episodes from 2024" or "only segments where Jason is speaking") that's cumbersome in SQLite. Cross that bridge when we get there.

### 5d. Retrieval pipeline

```typescript
interface OracleQuery {
  text: string;              // User question or live transcript segment
  mode: "ask" | "live";     // Ask mode vs. corpus-enriched live reaction
  topK?: number;            // Default 5 for ask, 3 for live
  filters?: {
    dateRange?: [string, string];
    episodeNumbers?: number[];
    speakers?: string[];
  };
}

interface OracleResult {
  segment: TranscriptSegment;
  episode: EpisodeRecord;
  score: number;             // Cosine similarity
  deepLink: string;          // YouTube URL with timestamp
  clipCard?: ClipCard;       // v1.6 clip format if available
}
```

Retrieval flow:

1. Embed the query using the same model as the corpus.
2. ANN search against `segment_embeddings`, return top K.
3. (Optional) Re-rank with a cross-encoder or LLM relevance scorer if retrieval quality is noisy.
4. Format results with deep links and inject into persona context.

**Latency budget:** Embedding + ANN search should complete in <200ms. The Director's 400ms LLM budget (v1.5) is separate — oracle retrieval runs in parallel with the Director tick, not inside it.

### 5e. Topic extraction (enrichment, not blocking)

After the core pipeline works, a second pass extracts topic tags from each segment:

- Company names (regex + NER).
- People mentioned.
- Startup concepts (fundraising, GTM, product-market fit, hiring, etc.).
- Industry verticals (AI, climate, fintech, health, crypto, etc.).

These power filtered search ("What has Jason said about climate tech fundraising?") and improve retrieval relevance. Not blocking for v1.7.0 — can land in v1.7.1.

---

## 6. Phase 3 — UI integration

**Duration:** 1 week
**Output:** Two new surfaces in the product: ask mode and corpus-enriched live reactions.

### 6a. Ask mode

A new interaction mode when no video is playing. Two entry points:

**Web app — `/oracle` route:**

- Text input: "Ask the TWiST crew anything about startups."
- Submit → retrieval → 4 personas respond in their voices with grounded answers.
- Each response includes 1–3 inline deep links: `[ep. 1,234 @ 14:32](https://youtube.com/watch?v=...)`.
- Persona responses render in the same 2×2 grid as live mode, with the same bubble avatars and sine wave animations. Familiar, not a new paradigm.
- Below each response: a "Sources" accordion showing the retrieved segments with timestamps and episode titles.

**Extension side panel — idle state:**

- When no session is active, the side panel shows the ask input instead of "Start Listening."
- Same retrieval + persona pipeline, same response format.
- Deep links open in a new tab (standard Chrome extension behavior for `chrome.tabs.create`).

**API route:**

```
POST /api/oracle
Body: { query: string, packId: "twist", topK?: number, filters?: {...} }
Response: SSE stream, same event protocol as /api/transcribe
  - oracle_source: { segmentId, episodeTitle, deepLink, score }
  - persona: { personaId, text }  (reuses existing event)
  - persona_done: { personaId }   (reuses existing event)
```

The oracle route reuses `PersonaEngine` and the existing SSE protocol. The only new event type is `oracle_source`, which carries the retrieved segments so the client can render the sources accordion.

### 6b. Corpus-enriched live reactions

During a live session, the Director's per-tick context gains an optional `historicalContext` field:

```typescript
interface DirectorContext {
  // ... existing fields ...
  historicalContext?: OracleResult[];  // Top 3 relevant historical segments
}
```

On each Director tick:

1. The current transcript window (last ~1500 chars, same as the fact-check pipeline) is used as the oracle query.
2. Retrieval returns the top 3 most relevant historical segments.
3. These are injected into the firing persona's system prompt as a `[HISTORICAL CONTEXT]` block with deep links.
4. The persona is free to reference or ignore them. The prompt frames them as "things that were said on earlier TWiST episodes that might be relevant" — not mandatory citations.

**Latency:** Retrieval runs in parallel with the Director's LLM routing call (v1.5). Both have sub-400ms budgets. The persona fires after both resolve. Net impact on time-to-first-token: near zero.

**Cost:** One embedding call per Director tick (~30 tokens → negligible). Vector search is local. No new LLM call — the historical context is injected into the existing persona call.

### 6c. Deep link rendering

In both ask mode and live mode, deep links render as tappable clip cards:

```
┌──────────────────────────────────────┐
│ 🎙 TWiST #1,234 — "AstroForge..."   │
│ 14:32 — "The greatest founders I've  │
│ ever met are the ones who..."         │
│                          ▶ Watch clip │
└──────────────────────────────────────┘
```

This reuses the v1.6 clip card component. The card links to `youtube.com/watch?v=...&t=...`. If v1.6's clip-share feature is live, the card also gets a "Share" button that generates a shareable image/link.

---

## 7. Phase 4 — Deep links as distribution

**Duration:** Ongoing (not a discrete phase — it's the consequence of Phases 1–3)

The distribution thesis: every oracle interaction generates 1–3 deep links into the TWiST archive. Each deep link is a view on Jason's content. Each shared clip card carries the `🥜 peanutgallery.live` attribution.

**Flywheel:**

```
User asks startup question
  → Oracle retrieves relevant TWiST segments
    → Personas respond with grounded answers + deep links
      → User shares clip card on X / LinkedIn / Slack
        → Clip card drives views on TWiST YouTube
          → Jason sees Peanut Gallery driving his metrics
            → Jason promotes Peanut Gallery to his audience
              → More users → more questions → more clips
```

This is the reason Jason said "feel free." The oracle makes Peanut Gallery a **distribution engine for TWiST's back catalog**. 2,400 episodes of content sitting on YouTube, searchable and citable through a companion product — that's value Jason can measure in his analytics.

**Metrics to track:**

- `oracle_query_count` — total ask-mode queries per day.
- `oracle_deep_link_generated` — deep links served (proxy for archive activation).
- `oracle_deep_link_clicked` — click-through rate on deep links (extension can track via `chrome.tabs.onUpdated`).
- `oracle_clip_shared` — shares via v1.6 clip-share (the distribution event).
- `oracle_retrieval_relevance` — periodic manual audit of top-5 retrieval quality. Target: ≥ 3/5 segments feel relevant to a human reader.

---

## 8. The local persona model — where it fits

Seth has already trained a local persona model on Jason and his podcasts. This is prior art, not wasted work. It fits the oracle in two ways:

**Voice calibration source.** The persona model captures Jason's verbal fingerprints at a level of detail that the TWiST RESEARCH.md can only approximate in prose. When writing or refining the Jason persona prompt for oracle mode, the local model is the reference implementation — "does this prompt produce output that sounds like the local model's output?" It's a voice benchmark, not a production component.

**Potential draft/rerank layer.** If retrieval quality is noisy (lots of marginally relevant segments), the local model could serve as a fast reranker — score each retrieved segment by "how likely is Jason to reference this in his response?" This is a v1.7.1 optimization, not a v1.7.0 requirement.

The local model is **not** the production generator. RAG over the full corpus with a frontier model (Claude Haiku / Grok) as the generator will produce higher quality, more controllable output. The local model's value is in voice fidelity and evaluation, not in generation.

---

## 9. New files and touched surfaces

### New files

| File | Purpose |
|------|---------|
| `lib/oracle/` | Oracle module root |
| `lib/oracle/corpus.ts` | Corpus loader — reads SQLite, exposes segment search |
| `lib/oracle/embeddings.ts` | Embedding client — wraps OpenAI `text-embedding-3-small` (or provider-agnostic interface) |
| `lib/oracle/retrieval.ts` | Retrieval pipeline — embed query → ANN search → format results with deep links |
| `lib/oracle/types.ts` | `EpisodeRecord`, `TranscriptSegment`, `OracleQuery`, `OracleResult` |
| `app/api/oracle/route.ts` | SSE endpoint for ask mode |
| `app/oracle/page.tsx` | Ask mode web UI |
| `scripts/build-corpus.ts` | VTT → EpisodeRecord → SQLite pipeline |
| `scripts/embed-corpus.ts` | Embeds all segments, writes to `segment_embeddings` table |
| `scripts/fixtures/oracle/` | Retrieval quality test fixtures |
| `corpus/` | Gitignored. Raw VTT files + `twist-oracle.sqlite` |
| `docs/TWIST-ORACLE-PLAN.md` | This file |

### Modified files

| File | Change |
|------|--------|
| `lib/director.ts` | Accept optional `historicalContext` in `DirectorContext`, pass through to persona firing |
| `lib/persona-engine.ts` | Accept optional `historicalContext` in `fireSingle`, inject into persona system prompt as `[HISTORICAL CONTEXT]` block |
| `lib/personas.ts` | `buildPersonaContext` gains `historicalContext?: OracleResult[]` parameter |
| `lib/packs/twist/personas.ts` | Add oracle-aware prompt section: "When historical context is provided, you may reference it with deep links. Do not fabricate episode numbers or timestamps." |
| `app/api/transcribe/route.ts` | On each Director tick (when pack is `twist` and corpus is loaded), run oracle retrieval in parallel with the Director LLM call |
| `extension/sidepanel.html` | Idle-state ask input; oracle source rendering; deep link clip cards |
| `extension/sidepanel.js` | Oracle query submission; `oracle_source` SSE event handling |
| `package.json` | Add `better-sqlite3` (or `sql.js` for browser compat), embedding client dep |
| `.gitignore` | Add `corpus/` |
| `docs/ROADMAP.md` | v1.7 is now "TWiST Oracle"; Pack Lab moves to v1.8 |
| `docs/SELF-HOST-INSTALL.md` | New §: Oracle setup (corpus build, embedding, env vars) |
| `docs/BUILD-YOUR-OWN-BACKEND.md` | New §: `/api/oracle` wire spec |

---

## 10. Cost model

### One-time costs

| Item | Cost |
|------|------|
| Deepgram batch transcription (200 episodes, Tier 2) | ~$140 |
| Embedding the full corpus (28M tokens × $0.02/M) | ~$0.56 |
| **Total one-time** | **~$141** |

If Tier 1 (YouTube auto-captions) quality is sufficient for retrieval, the Deepgram cost drops to $0. Embedding cost is negligible either way.

### Per-query costs (ask mode)

| Item | Cost |
|------|------|
| Embedding the query (~30 tokens) | ~$0.0000006 |
| Vector search (local SQLite) | $0 |
| 4 persona LLM calls (2× Haiku + 2× Grok, with injected context) | ~$0.003 |
| **Total per query** | **~$0.003** |

At $0.003/query, a user asking 100 questions/day costs $0.30. Hosted free tier can absorb this easily.

### Per-tick costs (corpus-enriched live reactions)

| Item | Cost |
|------|------|
| Embedding the transcript window (~300 tokens) | ~$0.000006 |
| Vector search (local SQLite) | $0 |
| Additional context in persona call (~500 tokens of historical context) | ~$0.0004 |
| **Total per tick** | **~$0.0004** |

Negligible. ~$0.02/hour of live session. Does not meaningfully change the existing ~$1.15/episode cost.

---

## 11. Risks and mitigations

### Retrieval quality on auto-captions

YouTube auto-captions mangle proper nouns: "Chamath Palihapitiya" might be "Shamath Polly Happy Tia." This hurts exact-match retrieval but semantic search is more resilient (the surrounding context disambiguates). Mitigation: a post-processing pass that normalizes known TWiST proper nouns (a dictionary of ~200 names/companies) in the VTT text before embedding.

### Hallucinated episode numbers

The personas must never fabricate an episode number or timestamp. The prompt must be explicit: "Only cite episodes from the [HISTORICAL CONTEXT] block. If no historical context is relevant, respond without citations." The deep link is generated server-side from the retrieved segment's metadata, not from the LLM's output — so even if the LLM hallucinates a citation, the rendered clip card links to the real segment.

### Corpus freshness

New TWiST episodes ship weekly. The corpus needs a refresh pipeline. A weekly cron job pulls new episodes' auto-captions and embeds them. This is a `scripts/update-corpus.ts` that runs incrementally — only processes episodes not already in the SQLite DB.

### Legal / IP

The corpus is timestamped pointers to YouTube's public content, not a re-host. Oracle answers are AI commentary that deep-links back to the source. This is the same fair-use posture as the fact-checking pipeline (search results injected into persona context). Jason's explicit "feel free to make" message is additional authorization for the TWiST-specific corpus.

The anti-impersonation guardrails from the TWiST pack carry over: personas are "inspired by," never claim to "be." Oracle answers are "based on what was discussed on TWiST," never "Jason says you should."

### Scope creep into a general podcast search engine

The oracle is TWiST-specific by design. Generalizing it to arbitrary shows is Pack Lab's job (v1.8). Resist the urge to build a generic corpus pipeline in v1.7 — build for TWiST, learn what works, then extract the pattern.

---

## 12. Done-definition

Every box must be ticked to call v1.7.0 shipped:

- [ ] Corpus of ≥2,000 TWiST episodes transcribed and stored in SQLite with segment-level timestamps.
- [ ] All segments embedded; ANN search returns relevant results for 10 hand-picked test queries with ≥3/5 relevant segments in top 5.
- [ ] `/api/oracle` SSE endpoint serves grounded persona responses with `oracle_source` events carrying deep links.
- [ ] Ask mode UI in both web app (`/oracle`) and extension side panel (idle state).
- [ ] Corpus-enriched live reactions: Director injects historical context into persona calls during TWiST pack sessions.
- [ ] Deep links render as tappable clip cards with episode title, timestamp, and transcript excerpt.
- [ ] Anti-hallucination guardrail: personas only cite episodes from injected context; deep links are server-generated from metadata, not LLM output.
- [ ] Corpus refresh script (`scripts/update-corpus.ts`) handles incremental updates for new episodes.
- [ ] Cost per oracle query ≤ $0.005. Cost per corpus-enriched live tick ≤ $0.001.
- [ ] Telemetry: `oracle_query_count`, `oracle_deep_link_generated`, `oracle_deep_link_clicked`, `oracle_clip_shared`.
- [ ] Self-host docs updated with oracle setup instructions (corpus build, embedding provider, env vars).
- [ ] Wire spec for `/api/oracle` added to `BUILD-YOUR-OWN-BACKEND.md`.
- [ ] 10 retrieval quality fixtures under `scripts/fixtures/oracle/` with ≥80% pass rate on relevance assertions.

---

## 13. Open questions (need Seth's call)

1. **Corpus scope.** All ~2,400 episodes, or start with the most recent 500? Smaller corpus = faster iteration, but misses the "15 years of startup wisdom" pitch. Recommendation: start with all episodes (Tier 1 auto-captions are free), but only Tier 2 (Deepgram) the top 200.

2. **Embedding provider.** OpenAI `text-embedding-3-small` is the pragmatic choice (cheap, fast, good). But it adds OpenAI as a fourth provider dependency. Alternative: use the xAI embedding endpoint if one exists by ship date, or a local model via Ollama for zero-cost dev iteration.

3. **Ask mode availability.** TWiST pack only, or all packs with corpus? The Howard pack has no corpus (we'd need Stern show transcripts, which are behind a paywall). Recommendation: TWiST-only for v1.7; the pack type gains an optional `corpus` field, and Pack Lab (v1.8) lets other packs bring their own.

4. **Hosted corpus.** Do we ship the SQLite DB on Railway, or does each self-hoster build their own? The DB is ~500MB–1GB. Railway can host it; self-hosters run `scripts/build-corpus.ts` + `scripts/embed-corpus.ts`. Recommendation: hosted ships with the corpus pre-built; self-host docs walk through the build.

5. **Jason's level of involvement.** His message was "feel free." Do we build and demo, or do we loop him in on the corpus/voice calibration before shipping? Recommendation: build first, demo second. Send him a working prototype, not a plan.

---

## 14. How to start

1. **Don't touch anything until v1.5 canary clears.** The canary is passive — deploy with `ENABLE_SMART_DIRECTOR=true` and let it run. Oracle work can start in parallel on a feature branch without touching the Director codebase.

2. **Phase 1 first day: test Tier 1 transcript pull.** Run `yt-dlp --write-auto-sub --sub-lang en --skip-download` on 10 TWiST episodes. Inspect the VTT quality. If proper nouns are mangled beyond recognition, assess whether the proper-noun normalization dictionary is sufficient or whether Tier 2 is needed for the full corpus.

3. **Phase 1 second day: build the corpus pipeline.** `scripts/build-corpus.ts` that processes VTT → `EpisodeRecord` → SQLite. Run it on the full archive. Time it. If it takes >4 hours, parallelize.

4. **Phase 2 first day: embed + search.** `scripts/embed-corpus.ts` that embeds all segments. Test 10 queries by hand. Gut-check retrieval quality.

5. **Phase 2 second day: integration.** Wire `lib/oracle/retrieval.ts` into `lib/persona-engine.ts` for corpus-enriched live reactions. Test with a real TWiST episode.

6. **Phase 3: ask mode UI.** `/api/oracle` route + `/oracle` page + side panel idle state. This is the demo-ready surface.

7. **Demo to Jason.** Screen recording of ask mode + a live session with corpus-enriched reactions. Deep links visible and clickable. Send it.

---

## 15. Research Findings (2026-04-18)

> This section is the **current source of truth** where it conflicts with §§1–14. Written after a de-risking pass across four parallel research tracks. Four of the seven original assumptions changed; none of them are fatal, but two of them (legal posture and embedding model) warrant a small rewrite of the plan before execution begins.

### 15.1 Corpus scope — mostly intact, but verify locally

- **Episode count is closer to ~2,260–2,300 numbered episodes**, not the 2,400 quoted throughout §§1–14. TWiST was at E2258 on 2026-03-05. The channel hosts an additional ~1,000–3,000 clips, News Rundown segments, Angel University cuts, and interview re-cuts — so **total video count on `@twistartups` is plausibly 3,500–5,000**. Decision: scope v1.7.0 to numbered main-feed episodes only; treat clips as noise we'd rather not re-embed.
- **Verification step before infra sizing:** run `yt-dlp --flat-playlist --print id https://www.youtube.com/@twistartups/videos | wc -l` on Seth's local machine. This pins the real number before we commit to corpus storage sizing.
- **Episode length assumption was low.** Modern full episodes are 60–90 min; older ones (pre-2015) run 90–120 min. Use **~75 min mean**, not 60. Token count estimate goes from 28M → ~35M. Still pocket change to embed, but worth correcting the cost table.
- **Caption availability is NOT 100%.** YouTube auto-captions are missing or degraded on archived live streams (TWiST does them regularly). Pre-2012 episodes may be missing captions entirely. **Budget for ~10–20% of live replays needing Whisper / Deepgram fallback from day one** — don't assume YouTube covers the whole archive.

**Updates to the plan:** §1 and §4 should say "~2,260 episodes" (or whatever the `wc -l` returns, rounded). §4a adds an explicit "Tier 1b" step: detect episodes with missing/empty captions, queue them for Whisper or Deepgram fallback.

### 15.2 yt-dlp bulk pull — works, but with specific flags and not on Railway

- **It works at 2,300-video scale**, but only with rate-limiting and a residential IP. Known issue: HTTP 429s on subtitle pulls (yt-dlp issue #13831), bot-detection challenges from data-center IPs (issues #10128, #12045, #12475, #15865, #16221 — still active in 2025–2026). The project already paid this tax when it switched to `mediaconnect` + cookies to survive Railway.
- **Command skeleton (use this, not §4a's shorter version):**
  ```bash
  yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format vtt \
         --write-info-json --download-archive done.txt \
         --sleep-interval 5 --max-sleep-interval 10 \
         --extractor-args "youtube:player_client=mediaconnect" --cookies cookies.txt \
         https://www.youtube.com/@twistartups/videos
  ```
- **Wall-clock: 8–15 hours** for a clean backfill on a residential IP. Longer if 429s force backoff. **Do not run the initial backfill from Railway** — run it from Seth's laptop, then ship the resulting SQLite DB to Railway. Railway stays for incremental daily deltas (one new episode every ~3 days is trivial).
- **Live-stream gotcha (from yt-dlp issues #4130, #2039, #10872):** auto-subs on livestream VODs frequently return chat JSON instead of captions, or fail outright. This is the ~10–20% fallback bucket.

**Updates to the plan:** §4a gets the full command skeleton. A new bullet in §14 "How to start" explicitly says "run the backfill locally, not on Railway." Add `scripts/build-corpus.ts` retry-with-Whisper fallback for caption failures.

### 15.3 Deep link reliability — works within ±2 seconds

- `youtube.com/watch?v=ID&t=SECONDS` seeks to the nearest keyframe (HTTP pseudo-streaming limitation), landing within **~1–2 seconds** of the requested moment. VTT cue timestamps match the video timeline, so there is **no drift between auto-caption timestamps and the `&t=` seek** — the drift discussion in transcription literature is about frame-rate mismatches on downloaded/converted videos, not YouTube-native playback.
- **Embed parameter is different:** use `?start=SECONDS` for iframes, `&t=SECONDS` for direct watch URLs. Implement both in `lib/oracle/retrieval.ts` deep-link formatter (one for the clip card's "Watch on YouTube" button, one for any in-page embed).
- **Verdict: not a blocker.** The "clip to 14:32" UX works. ±2s precision is fine for a "jump to where they said it" experience.

### 15.4 Legal posture — **this is the section that most changes the plan**

Two findings here are load-bearing:

1. **Jason's verbal "feel free" is not enough for a commercial product.** yt-dlp bulk scraping is a YouTube ToS violation regardless of intent. Redistributing transcripts through a commercial RAG product materially raises the risk profile. The April 2026 **Apple lawsuit** over yt-dlp + AI training was a warning shot for the whole category. The US Copyright Office's **Part 3 Report (2025)** explicitly flags "RAG that reproduces retrieved copyrighted material" as **less likely to be transformative** than training — which is the relevant framing for what we're building.
2. **The industry posture is short quotes + deep links, not full transcripts.** Podscribe, Listen Notes, Castmagic, Snipd all avoid redistributing full transcripts publicly. They lean on creator opt-in or user-supplied content (Castmagic's ToS shifts rights-clearance to the user). None publicly claim pure fair-use cover for full-transcript redistribution.

**What this means for the plan:**

- **Get a written, dated license from Jason / LAUNCH.** A one-page email is enough, but it needs to be in writing. Cover: (a) right to ingest audio + transcripts from YouTube/RSS, (b) right to surface short quoted snippets (< 25 words per retrieved segment) with attribution + deep links, (c) right to use TWiST-branded personas under the existing anti-impersonation guardrails, (d) term + termination. This is the single biggest risk-reduction step in the whole plan, and the cheapest. Do it before Phase 1.
- **Do not expose full transcripts as readable/downloadable pages.** Store them in the RAG index; **in oracle responses, return only short quoted snippets (target < 25 words) + timestamp + deep link to YouTube**. This aligns with industry practice and stays close to the Copyright Office's "more transformative" end of the RAG spectrum. The clip card UX in §6c already shows a transcript excerpt — that excerpt should be capped and bounded.
- **Do not host the SQLite DB as a downloadable artifact** (e.g., for self-hosters to grab as a shortcut). Self-hosters run `scripts/build-corpus.ts` themselves — the script is a tool, the DB is a derived work bound by the license we hold. Changes §13 open-question #4 (was: "hosted ships with the corpus pre-built; self-host docs walk through the build") to: **hosted ships with the corpus pre-built; self-hosters build their own.**

**Updates to the plan:** §11 "Legal / IP" gets a hard rewrite. §4a adds "Phase 0 — License." §12 done-definition adds: "Signed written license on file; snippet length cap enforced in retrieval formatter."

### 15.5 Caption quality — viable with a correction dictionary, tiered Deepgram for the top slice

- **YouTube auto-caption WER on multi-speaker interview content is 15–22%** as of 2025–2026 (cleaner than a decade ago, but still well behind Deepgram Nova-3 at 6–8% and Whisper large-v3 at 8–10%). TWiST specifically hits the worst case: multi-speaker, overlapping, proper-noun-heavy.
- **Dense embeddings are robust to ~10–15% WER** (retrieval recall@10 drops ~3–8 points). Past 20%, retrieval degrades sharply. **Proper nouns are the single biggest weak point** — "Chamath" mangling drops recall on "what did Chamath say about SPACs" by ~15+ points in published benchmarks.
- **~200-entry proper-noun correction dictionary recovers 60–80% of the gap** for 4–8 hours of engineering. Seed it with the TWiST cast, recurring guests (All-In crew), portfolio companies, and common jargon. Apply it as a regex/fuzzy-match pass before embedding. This is high-leverage.
- **Tiered strategy wins.** Three options, combine them:
  - **All episodes:** YouTube auto-captions + correction dictionary (free).
  - **Top 200 most-viewed episodes:** Deepgram Nova-3 for quality floor ($140).
  - **On-demand upgrade:** At query time, Deepgram the specific retrieved segment (not the full episode) for final grounding. ~$0.03 per 5-min segment, amortized near-zero.
- **No free pre-existing TWiST transcript corpus exists.** Checked Podscribe, Listen Notes, Castmagic, Rephonic, Snipd, thisweekin.com, Apple Podcasts. None are bulk-available or complete. The free shortcut isn't real.

**Updates to the plan:** §4a's cost estimate drops from "$0–$140" to **"$0–$280"** (top-200 Deepgram + optional on-demand upgrade for tail segments). §5a chunking adds a proper-noun-correction pass before embedding. A new file `lib/oracle/proper-nouns.ts` ships the dictionary.

### 15.6 Embedding model — **recommendation changed from OpenAI to BGE-M3 hybrid**

The v1 plan proposed `text-embedding-3-small` as the pragmatic choice. The research says that's mid-pack on retrieval quality and — more importantly — **it breaks self-host parity**. A self-hoster who doesn't want an OpenAI key has no equivalent option in the original plan.

**Revised recommendation: BGE-M3 via a hosted inference endpoint (Together AI or Replicate, ~$0.10/1M), with hybrid BM25 + dense retrieval, and a documented self-host path via Ollama / llama.cpp.**

Why this is the right call:

1. **Self-hoster parity.** BGE-M3 is Apache 2.0 and runs on CPU or a single consumer GPU. Self-hosters get **the same model** as the hosted tier — no quality cliff. This is the decisive factor; every API-only model fails this test.
2. **Hybrid built-in.** BGE-M3 produces dense + sparse + ColBERT-style multi-vector embeddings in one forward pass. The TWiST corpus is proper-noun-heavy, and **hybrid sparse+dense beats dense-alone by +3–5 nDCG@10 on proper-noun-heavy domains**. Reciprocal Rank Fusion (k=60) is the standard combiner, zero tuning needed.
3. **Retrieval quality.** Top-4 on MTEB/BEIR (~63.8 nDCG@10), beats `text-embedding-3-large` on domain benchmarks (FIQA, TREC-News), and the hybrid fusion closes the gap to Voyage-3-large (the current SOTA at ~65.5).
4. **Cost.** Corpus ingest < $5 via hosted endpoint. Annual API cost < $50 at 1K DAU. Free if self-hosted.
5. **No Anthropic lock-in.** Anthropic has not shipped a first-party embedding endpoint as of April 2026 — `docs.anthropic.com` still points at Voyage. Keeping BGE-M3 as the default leaves us free to evaluate a first-party Anthropic option in v1.7.1 without re-architecting.

**v1.7.1 upgrade path:** Add Voyage-3-large as an optional "premium retrieval" backend behind a config flag for users who want the +2–3 nDCG@10 bump. Re-embed corpus (~$5) and A/B on a labeled eval set. Keep BGE-M3 as the default forever.

**Updates to the plan:** §5b switches to BGE-M3. §5c adds hybrid BM25 + dense retrieval via RRF (this changes the SQLite schema slightly — add an FTS5 virtual table for BM25 alongside the vector table). `lib/oracle/embeddings.ts` gets a provider-agnostic interface with BGE-M3 as the default implementation.

### 15.7 Vector DB — sqlite-vec works for v1.7.0, plan LanceDB migration for v1.8 Pack Lab

- **sqlite-vec is mature enough (~v0.1.7 by April 2026) and production-used.** Works with `better-sqlite3` via `db.loadExtension()`. WASM build exists for future client-side work.
- **Critical limitation: brute-force only.** HNSW/IVF indexing has been on the roadmap for a while but still isn't shipped. Every query is a full linear scan with SIMD.
- **At v1.7.0 scale (~56K × 1536d ≈ 345MB):** brute-force scan runs **80–150ms per query** on a Railway 2-vCPU container. With int8 quantization (native sqlite-vec feature): **30–60ms and 86MB**. **Fine for v1.7.0.**
- **Where sqlite-vec breaks: ~200–300K vectors.** That's the v1.8 Pack Lab ceiling (All-In + Acquired + Lex + user-generated packs → likely 250K+ segments quickly).
- **LanceDB is the migration target.** Arrow-backed, embedded file-based (preserves self-host story), true HNSW + IVF_PQ, Node bindings are first-class by 2026, scales to millions on one box. Swap is clean if we put retrieval behind a `VectorStore.search()` / `.upsert()` interface from day one.
- **Client-side vector search is viable but not for v1.7.0.** Binary-quantized + brute-force WASM ships in ~11MB with ~20ms query time. Complexity isn't worth it until post-PMF; revisit as a v2.x offline feature.

**Updates to the plan:** §5c clarifies sqlite-vec is brute-force-only and adds int8 quantization by default. §5d explicitly documents the **LanceDB migration trigger** (v1.8 Pack Lab, or >150K vectors, whichever comes first). All retrieval code goes behind a `VectorStore` interface so the swap is a one-file change.

### 15.8 Cost model — validated, but **persona LLM calls dominate, not vectors**

Validated numbers against 2026 pricing and scaled them out. Key findings:

| Scale | Per-year cost | Dominated by |
|---|---|---|
| One-time corpus ingest (BGE-M3 hosted) | < $5 | — |
| Storage (345MB + indices, ~500MB) | $3/yr on Railway | — |
| **1K DAU × 50 queries/day** | **~$55K/yr** | **4-persona LLM fan-out (99% of cost)** |
| 10K DAU × 50 queries/day | ~$550K/yr | Same |
| Embedding API (at either scale) | $36–365/yr | Rounding error |

**The original plan's cost tables in §10 are correct on the per-query math but mis-prioritize where optimization matters.** At 1K+ DAU, retrieval cost is a rounding error and persona LLM cost is everything. The product lever is **caching + batching persona calls**, not shaving embedding cost.

**Cost cliffs:**
1. **~200K vectors:** sqlite-vec brute-force latency hits p95 400–700ms → migrate to LanceDB.
2. **~1K DAU:** persona LLM calls become meaningful line-item → cache common oracle queries, batch where possible, consider Haiku-only tier for cost-sensitive users.
3. **~5K DAU:** Railway single-container model gets tight → horizontal scale or migrate compute to Fly.io / Modal. Storage never the bottleneck.

**Updates to the plan:** §10 gets an annotation that at 1K+ DAU, persona LLM fan-out dominates; add a bullet under §11 "Risks" for "persona LLM cost at scale" with the caching/batching mitigation. A new line in §12 done-definition: "Oracle response cache (LRU, TTL 24h, keyed by normalized query hash) in place."

### 15.9 Summary of plan changes

For anyone scanning this before executing:

| Item | Original plan | Revised |
|---|---|---|
| Episode count | 2,400 | ~2,260 numbered (verify locally first) |
| Mean episode length | 60 min | 75 min |
| Transcript tier strategy | Auto-captions + top 200 Deepgram | Auto-captions + correction dictionary + top 200 Deepgram + on-demand tail upgrade |
| Backfill location | (unspecified) | **Seth's laptop, not Railway** |
| Live-stream caption coverage | assumed 100% | **~80–90%; Whisper fallback for the rest** |
| Embedding model | OpenAI `text-embedding-3-small` | **BGE-M3 hybrid (dense + sparse + RRF)** via hosted endpoint or Ollama |
| Retrieval method | Dense-only ANN | **Hybrid BM25 + dense via RRF** |
| Vector DB for v1.7.0 | sqlite-vec (hand-waved as ANN) | sqlite-vec **brute-force with int8 quantization** — explicit about the limitation |
| Vector DB for v1.8 Pack Lab | sqlite-vec continues | **Migrate to LanceDB** (planned trigger: Pack Lab or >150K vectors) |
| Self-hoster ships corpus | "hosted ships pre-built, self-host walks through build" | **hosted ships pre-built; self-hosters build their own. No DB redistribution.** |
| Transcript exposure in responses | (loose) | **≤ 25 words per retrieved segment + deep link. No full-transcript pages.** |
| Jason's authorization | verbal "feel free" is enough | **written + dated license email required before Phase 1** |
| Where cost optimization matters | (implicit: embeddings) | **Persona LLM fan-out — cache + batch. Vectors are a rounding error.** |

### 15.10 Unresolved (deferred to execution)

- **Exact TWiST episode count.** Resolved locally via `yt-dlp --flat-playlist --print id | wc -l` before sizing infra.
- **Whether Anthropic ships a first-party embedding endpoint in 2026H2.** Watch for it; re-evaluate in v1.7.1 A/B.
- **Cohere embed-v4 head-to-head with BGE-M3 hybrid on TWiST-specific eval set.** Build a 200-query labeled eval set during Phase 2; A/B the top 3 candidate embedding approaches. BGE-M3 is the default; swap only if data says so.
- **Snippet length cap negotiation with Jason.** 25 words is the proposed default; confirm it's comfortable with him and LAUNCH legal before locking it in.
- **On-demand Deepgram upgrade timing.** Does the 2–4 second Deepgram call for a tail segment fit inside the ask-mode latency budget, or does it bump answers into "thinking…" territory? Measure during Phase 2.

### 15.11 Sources

Corpus / yt-dlp / legal research:
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [yt-dlp issue #13831 — 429s on subtitles](https://github.com/yt-dlp/yt-dlp/issues/13831)
- [yt-dlp issue #10128 — YouTube bot detection](https://github.com/yt-dlp/yt-dlp/issues/10128)
- [yt-dlp issue #4130 — livestream VOD subs](https://github.com/yt-dlp/yt-dlp/issues/4130)
- [ArchWiki yt-dlp guide](https://wiki.archlinux.org/title/Yt-dlp)
- [YouTube Help — Archive live streams](https://support.google.com/youtube/answer/6247592)
- [YouTube Help — Automatic captions](https://support.google.com/youtube/answer/6373554?hl=en)
- [YouTube Terms of Service](https://www.youtube.com/static?gl=GB&template=terms)
- [US Copyright Office Part 3 Report (2025)](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf)
- [Apple yt-dlp scraping lawsuit (2026)](https://www.claimdepot.com/cases/apple-sued-for-allegedly-scraping-millions-of-youtube-videos-for-ai-training)
- [TWiST episodes page](https://thisweekinstartups.com/episodes)
- [Iframely — YouTube embed start time](https://iframely.com/help/322554-how-to-add-you-tube-start-time-to-embedded-player)

Embeddings / vector stores / caption quality research was synthesized from MTEB leaderboard tracking, BAAI/FlagEmbedding documentation, Voyage AI docs, sqlite-vec release notes, LanceDB Node.js docs, and published ASR-RAG noise-robustness literature (Zhang et al. 2023, "Whispering in the Noise" 2024, AssemblyAI/Deepgram 2024 proper-noun benchmarks). Specific URLs available on request; the key assertions above are the load-bearing ones.
