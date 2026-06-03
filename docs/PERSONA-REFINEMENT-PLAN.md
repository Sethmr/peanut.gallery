# Persona Refinement Plan — 100+ transcripts

**Goal.** Update the 8 shipping personas (4 slots × 2 packs) so they feel *truly* inspired by the morning show and Startup Roundtable — not just labeled as such. Today's `systemPrompt` blocks are hand-crafted from memory + light research. This plan grounds every voice-pattern decision in ≥100 real transcripts of source material.

Owner: Seth. Executor: Claude (Opus for research passes; Sonnet for mechanical work). Timeline: ~2 weeks, phased below. Budget: ~$60 in Anthropic + Deepgram API costs.

---

## Why now

- [`docs/DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) rule #3 says fact-check sensitivity is *per-pack character design*. We've been declaring that ("The Producer = loose, The Correspondent = strict") without auditing whether the rest of each persona's voice is as character-accurate as the sensitivity knob.
- User-visible quality lift: the Director gets a better pick, the persona delivers a better line, the gallery feels alive. Persona fidelity is the moat the brief identified vs. Neuro-sama-class single-persona reactors.
- Pre-launch window: v2.0 ships session-recall + clip-share — the persona text IS what gets screenshotted and shared. Character fidelity converts directly to organic growth.
- Existing ground-truth exists but is thin. `docs/packs/twist/RESEARCH.md` is a single author's memory-based character study. the morning-radio host side has nothing equivalent. Grounding both in real transcripts closes the gap.

---

## Scope — 8 personas, 2 packs

| Pack    | Slot    | Persona           | Current mode   | Source material bias |
|---------|---------|-------------------|----------------|---------------------|
| the morning-radio host  | producer| The Producer        | loose          | the morning-radio host Show 1990–2024 |
| the morning-radio host  | troll   | The Troll         | n/a            | Artie Lange era + caller archetypes |
| the morning-radio host  | soundfx | The Sound Guy       | n/a            | the morning-radio host Show The Sound Guy moments |
| the morning-radio host  | joker   | The Joke Writer   | n/a            | The Joke Writer-era the morning-radio host Show (1986–2001) |
| Startup Roundtable   | producer| The Correspondent        | strict         | Startup Roundtable The Correspondent-era + Marketplace Tech |
| Startup Roundtable   | troll   | The Host   | n/a            | Startup Roundtable 2009–2026 + All-In appearances |
| Startup Roundtable   | soundfx | The Reframer        | n/a            | Startup Roundtable writer segments |
| Startup Roundtable   | joker   | The Quant      | n/a            | Equity Podcast + Startup Roundtable guest spots |

---

## Phase 1 — Data collection (target ≥100 transcripts)

**Deliverable.** `docs/persona-research/transcripts/` with one `.txt` per transcript + a cover `INDEX.md` listing source, date, duration, speakers, and any notes.

### Sources (legal + ethical)

- **Startup Roundtable:** every episode is on YouTube + RSS with free audio. Transcribe ourselves via the extension's existing Deepgram Nova-3 pipeline. **Target: 60 episodes × ~75 min each.** ~75 hours of transcript. Mix of recent (2024–2026), The Correspondent-era (2021–2023), and legacy (2015–2018) so we catch voice evolution.
- **the morning show:** SiriusXM is paywalled; we can't transcribe the source. Strategy: use **publicly-posted YouTube clips** (official the morning-radio host show channel, authorized interview compilations, podcast appearances by staff members — The Producer's own podcast "The Producer's Book Report," The Joke Writer's podcast "the Joke Writer Joke Hunt," Artie's "Artie Lange's Halfway House"). **Target: 40 clips × ~5–15 min** = ~8 hours of transcript. Fewer total hours than Startup Roundtable, but voices are high-signal because these are the staff speaking outside the show in extended form.
- **Fair-use posture:** we're using transcripts to *study* voice patterns, not to reproduce content. Outputs are *inspired-by* systemPrompts that don't contain verbatim quotes > 20 words. This is the standard fair-use posture for voice-modeling research.

### Collection tool

```
scripts/persona-research/collect.ts
  --source <twist|howard>
  --url <youtube-url>
  --out docs/persona-research/transcripts/<slug>.txt
```

Reuses `lib/transcription.ts` (Deepgram Nova-3, diarization enabled). Writes transcript with `[Speaker 1]`/`[Speaker 2]` tags + timestamps every ~30s.

### Estimated cost

- Deepgram Nova-3: $0.43/hour with diarization
- ~83 hours total → **~$35 in Deepgram**.

---

## Phase 2 — Voice-pattern extraction

**Deliverable.** Per persona: a structured voice-pattern report (`docs/persona-research/voice-<slot>-<pack>.md`) extracted from transcripts, citing source + timestamp per pattern.

### Extraction tool

```
scripts/persona-research/extract-voice.ts
  --persona baba-booey
  --inputs docs/persona-research/transcripts/*.txt
  --out docs/persona-research/voice-producer-howard.md
```

Runs Claude Opus with a structured system prompt asking for:

1. **Catchphrases** — verbatim recurring phrases (e.g. "BABAAAA BOOEY!", "Hey now!", "The math ain't mathing"). Min frequency: 3+ occurrences across transcripts.
2. **Sentence-structure tics** — how the persona opens a thought, how they transition, how they land a point. The Host's "Alright alright alright…" stall. The Correspondent's "So the thing about that is…" reframe.
3. **Topic reflexes** — what makes this voice *fire*. The Producer lights up on dates / founding years / salary figures. The Quant lights up on cap-table math. The Sound Guy fires on awkward silences. The Joke Writer fires on setups with a "rule of three" shape.
4. **Off-ramps** — what makes this voice PASS or step back. Robin pulling the morning-radio host back when a bit's too hot. The Quant stepping out when the joke's already been made.
5. **Cross-persona dynamics** — Robin's "dance partner" anchoring of the morning-radio host; Artie's darker-turn vs. The Joke Writer's lighter-energy; The Producer's compulsion to correct the morning-radio host specifically.
6. **Timing notes** — turns per hour, typical turn length, do they tend to respond to the prior turn or initiate?

Extraction cost per persona: ~$3 Opus (one pass over the persona's portion of transcripts, roughly 10–30k input tokens per persona).

**Total: 8 personas × $3 ≈ $24 in Opus.**

### Human review loop

Seth (20-min pass) + Claude (verification pass) cross-check each voice report. Patterns supported by fewer than 3 distinct transcripts are flagged as weak and dropped unless Seth overrides.

---

## Phase 3 — Prompt rewrite + A/B

**Deliverable.** Updated `systemPrompt` + `directorHint` for each of the 8 personas, backed by A/B comparison data.

### Rewrite methodology

For each persona:

1. Start with the Phase-2 voice-pattern report as raw material.
2. Rewrite the systemPrompt with 3-5 **concrete voice anchors** (e.g. "The Producer reflexively corrects the morning-radio host on specific years and dollar figures; when he's wrong, he doubles down for three turns before admitting it — keep that cadence"). No verbatim > 20 words.
3. Add 3-5 **few-shot examples** (real transcript snippet + the persona's characteristic reaction, paraphrased to avoid reproduction).
4. Tighten `directorHint` so it names the concrete trigger, not a vague category.

### A/B comparison tool

```
scripts/persona-research/ab-compare.ts
  --persona baba-booey
  --transcript fixture-1.txt
  --a lib/packs/howard/personas-old.ts
  --b lib/packs/howard/personas.ts
```

Runs the Director + both prompt versions against 10 held-out real session transcripts. Emits side-by-side markdown.

### Seth rating panel

Seth rates each pair on three 1–5 scales:
- **Voice fidelity** — does this sound like the actual person?
- **Right-thing-at-the-right-time** — did the persona fire when it should have?
- **Copyright-safety** — any verbatim material sneak in?

Ship when all 8 personas score ≥ 4.0 on voice fidelity AND ≥ 4.0 on right-thing timing, with 0 copyright-safety flags.

---

## Phase 4 — Ship

**Deliverable.** Pack-version bumps on both packs; CHANGELOG entries; updated RESEARCH docs.

Steps:

1. Update `lib/packs/howard/personas.ts` + `lib/packs/twist/personas.ts` with new prompts + hints.
2. Version-bump each pack's `meta.version` (packs are currently unversioned — introducing `meta.version: "2.0"` is a semver signal that prompt text changed materially).
3. Update `docs/packs/howard/RESEARCH.md` (create it fresh) + `docs/packs/twist/RESEARCH.md` (overhaul with transcript-grounded patterns).
4. Re-baseline the Director fixture suite — the updated prompts may shift the "who fires when" distribution. Run `npm run test:director` and update assertions that drift legitimately.
5. CHANGELOG entry grouping the pack rewrites under a single `v1.7.x` or `v1.8.0` release.
6. Short internal note in [`docs/DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) rule #3 linking out to the updated RESEARCH docs.

---

## Success criteria

- ≥100 transcripts collected + indexed under `docs/persona-research/`.
- 8 voice-pattern reports under `docs/persona-research/voice-*.md`, each citing ≥3 distinct transcript sources per pattern.
- 8 rewritten personas with version-bumped packs.
- All 24 Director fixtures still green (possibly with re-calibrated assertion ratios, not structural changes).
- Seth-rated ≥ 4.0/5.0 voice fidelity + ≥ 4.0/5.0 timing on every persona, 0 copyright flags.
- Qualitative: Seth says *"yeah, that's The Producer"* / *"that's The Host"* on blind A/B.

---

## Risks + opt-outs

- **Copyright.** Low risk when outputs are inspired-by voice models rather than verbatim, but we keep quotes ≤ 20 words and cite sources in RESEARCH docs. If any specific source turns out restricted (e.g. SiriusXM tries to C&D a The Producer clip we transcribed), we pull that source — the corpus is wide enough to absorb the hit.
- **Scope creep.** 100 transcripts is a lot to read. Phase 2 leans hard on Opus extraction — if Opus costs exceed $100 total, pause and ask Seth.
- **Director fixture drift.** Updated prompts will change the "who fires when" distribution. We may need to re-baseline fixture `mustFireRatio` values. If more than 4 fixtures require structural changes (not just ratio tuning), pause — the direction of drift may be wrong.
- **Quality regression.** Some current prompts may be hitting local optima that aren't easy to re-derive from transcripts alone (The Producer's self-deprecating humor arc, for instance, reads well even though it's from memory not source). Keep old versions in Git — reverting a persona to its hand-crafted prompt is a one-line PR if the transcript-grounded version under-performs.

---

## Deliverables summary

- `docs/persona-research/transcripts/` — 100+ `.txt` files + `INDEX.md`
- `docs/persona-research/voice-*.md` — 8 voice-pattern reports
- `scripts/persona-research/collect.ts` — new Deepgram-based transcript collector
- `scripts/persona-research/extract-voice.ts` — new Opus-based voice extractor
- `scripts/persona-research/ab-compare.ts` — new old-vs-new comparator
- Rewritten `lib/packs/*/personas.ts` × 2
- Overhauled `docs/packs/*/RESEARCH.md` × 2
- CHANGELOG entry + pack version bumps

---

## Linear ticket

Will file as **SET-19** (backlog) when this plan lands. Blocks on: finishing the Director v3 canary (SET-14) so we're not refactoring personas while the routing layer is unstable. Target kickoff: after SET-14's 48-hour canary clears bands.
