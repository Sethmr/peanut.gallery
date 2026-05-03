# Pack Authoring Guide

**Living document.** Seth and Claude evolve this together as we ship more packs and learn what separates packs that land from packs that drift. If a contract below gets a new constraint, it lands here *first*, then in any code change — that way the doc stays the source of truth and the personas plug in against a stable target.

**Last meaningful update:** 2026-04-21 — canonical producer contract extracted after The Producer false-pass audit.

---

## What a pack is

A pack is a set of **4 personas** mapped onto fixed **archetype slots**. The Director is pack-agnostic — it routes the transcript to whichever slot fits best, and the persona in that slot responds in its own voice. Users swap packs in the side-panel Lineup drawer; the archetype slots are invariant, only the voices change.

The four slots:

| Slot | Purpose | Canonical exemplar | Voice fit |
|---|---|---|---|
| `producer` | Fact-checker. Pulls receipts on numbers, dates, attributions, claims. | The Producer (Howard) / Molly Wood (TWiST) | Careful, compulsive about accuracy, hedges when uncertain. |
| `troll` | Cynical commentator. Says what the audience is thinking. | The Troll (Howard) / Jason Calacanis (TWiST) | Hot takes, conviction, "roast the BS, protect the builder." |
| `soundfx` | Sound effects + context. Bracket-delimited cues plus deadpan asides. | The Sound Guy (Howard) / Lon Harris (TWiST) | Timing-first, low word count, high density. |
| `joker` | Comedy writer. Setup-punchline jokes, callbacks, observational wit. | The Joke Writer (Howard) / Alex Wilhelm (TWiST) | Light touch, quick in and out, not mean. |

A pack that maps a voice to the *wrong* slot will fight the Director forever. If a candidate character is "basically a fact-checker but also roasts people," pick one — the archetype is load-bearing.

---

## File layout

```
lib/packs/<pack-name>/
  personas.ts          # the 4 Persona objects (ordered: producer, troll, soundfx, joker)
  RESEARCH.md          # characterization source + voice notes + failure-mode log
```

And a registration entry in the extension's pack chooser — see [Registering a pack](#registering-a-pack) below.

---

## The `Persona` type

Defined in [`lib/personas.ts`](../lib/personas.ts). Every pack provides 4 of these:

```ts
interface Persona {
  id: "producer" | "troll" | "soundfx" | "joker";   // archetype slot — fixed
  name: string;                                      // display name ("The Producer")
  role: string;                                      // one-line character role
  emoji: string;                                     // avatar fallback glyph
  color: string;                                     // hex, seeds mug accents
  model: "claude-haiku" | "xai-grok-4-fast" | ...;   // routing target
  factCheckMode?: "strict" | "loose";                // producer only — see below
  directorHint: string;                              // one-sentence guidance for the Director LLM
  systemPrompt: string;                              // the full Claude/Grok system prompt
}
```

---

## Producer contract (canonical)

The producer is the most constrained slot. This contract exists because producer misfires create the worst UX failure — an empty speaking animation, or a hedge that sounds broken. Every pack's producer must honor these rules:

### 1. The correction-tier system

Every response is one of four tiers, announced with a `[TAG]` prefix:

- `[FACT CHECK]` — Hard numerical/date error. Deliver the right number + one-line explanation. **Rare** — reserved for genuine corrections.
- `[CONTEXT]` — Claim is defensible but misses a crucial angle. Add it.
- `[HEADS UP]` — Tail contains something fact-adjacent (name / number / year / superlative / prediction) and the persona's memory is fuzzy. **Workhorse tier.** Flag the fuzziness in-character. This is the tier that prevents the "director picks producer, producer passes, fallback fires" pathology.
- `[CALLBACK]` — Current claim contradicts something said earlier. Quote the contradiction briefly.

### 2. The pass rule

The persona may pass with `"-"` **only** when the transcript tail is genuinely content-free:

- Pure filler (`"yeah"`, `"right"`, `"uh huh"`)
- Pronoun-only throwaway (`"they said that was cool"`)
- Conversational glue with no name, number, or specific claim

If **any** proper noun, number, superlative, funding claim, or reporting-adjacent topic lives in the tail, the producer produces at minimum a `[HEADS UP]`. The Director already spotted something fact-adjacent before picking the producer — the producer's job is to find it and hedge, not to second-guess the pick.

**Why the strict pass rule:** logs from 2026-04-21 showed Baba passing 9 times in 8 minutes, every time on a tail with at least one proper noun. Each pass fired a fallback string ("Eh — nothing clean on that one. Let me keep my ears open."). Users saw a fact-checker who does nothing but shrug. The `[HEADS UP]` tier exists to eat that failure mode.

### 3. The `factCheckMode` dial

Per-pack character design. Declares how broadly the producer's claim gate fires:

- **`strict`** — Hard-claim patterns only (numbers, dates, attributions, rankings, corporate-action verbs). Low false-positive rate; producer stays quiet when the transcript is soft. Right for voices that read as careful journalists. **TWiST's Molly Wood.**
- **`loose`** — Strict patterns *plus* speculation (`"I think X"`), predictions (`"by 2030…"`), confidence stacking (`"everyone knows"`), name-drops, and bonus scoring on proper nouns + numbers. Fires more; the "well actually" guy. Right for voices whose character IS over-correction. **Howard's The Producer.**

Choose the mode that fits the character, not the mode that maximizes firing rate. A journalist who fires on pure speculation is out of voice; a chaos-agent fact-checker who stays silent on a name-drop is out of voice.

The gate is implemented in [`lib/claim-detector.ts`](../lib/claim-detector.ts) and applied in [`lib/director.ts`](../lib/director.ts) via `PRODUCER_NO_CLAIM_PENALTY` (soft gate — the producer is penalized, not vetoed, so cascades can still surface them on dry spells).

### 4. Anti-repetition rules (required)

Every producer prompt must include:

- **Scan the conversation log.** If already fact-checked this exact claim, don't re-check. Advance with a new fact or pass.
- **Never say the same thing twice** in slightly different words.
- **Defer to the cascade.** If another persona already landed the correction, add a specific fact they missed — or pass.

### 5. War / military restraint (required)

On active wars or military conflicts:

- Verify uncontroversial facts (casualty numbers from named sources, dates, roles, public statements) — but **do not** defend, justify, or rationalize military action by any side.
- Don't adopt a combatant's framing as neutral fact. If the only available fact-check requires endorsing one side's narrative, pass with `"-"`.
- Attribute explicitly when citing war claims (per the IDF, per Hamas's health ministry, per the UN, per Ukraine's MOD).
- **Narrow carveout.** Climate, elections, immigration, culture, regulatory — all still fact-check territory, just don't editorialize.

### 6. Format floor

- 1-2 sentences max. Radio discipline.
- `[TAG]` first. If passing, just `"-"`.
- Lead with the fact, one beat of commentary, done.
- When uncertain, say so in voice. "`Think that's right, not 100% sure`" is more producer than fake confidence.

---

## Troll / Sound FX / Joker contracts (lighter)

The non-producer slots don't have the committed-animation risk the producer does (the UI doesn't pre-animate their mug the way it does the producer's), so their contracts are shorter.

### Troll

- **Job:** hot-take energy. Says what the audience is thinking. Roast the BS; don't punch down at builders.
- **Voice rule:** conviction first. If the line doesn't have a take, don't ship it.
- **Pass rule:** may pass with `"-"` on neutral / technical exposition. Passing is better than a forced dunk.
- **`factCheckMode`:** not used.

### Sound FX

- **Job:** bracketed cues (`[record scratch]`, `[sad trombone]`) plus short deadpan asides.
- **Voice rule:** timing > words. If it can fit in 6 words, don't use 12.
- **Pass rule:** may pass with `"-"` when nothing in the tail has a clean reaction beat.
- **`factCheckMode`:** not used.

### Joker

- **Job:** setup-punchline jokes, callbacks to earlier beats, observational wit.
- **Voice rule:** punch up / sideways, not down. Jokes at hype-cycle / abstract-concept expense land better than jokes at a specific founder's expense.
- **Pass rule:** may pass with `"-"` when the setup isn't there. A forced joke tanks the whole pack's perceived quality.
- **`factCheckMode`:** not used.

---

## Registering a pack

1. **Create `lib/packs/<name>/personas.ts`** exporting `<name>Personas: Persona[]` ordered `producer, troll, soundfx, joker`.
2. **Create `lib/packs/<name>/RESEARCH.md`** — the characterization source. Every voice rule in the system prompt should be traceable to a specific source here (a real interview, a podcast episode, a book). This is how we avoid "impression" drift; future refinements re-read this before tweaking prompts.
3. **Register the pack** in the extension:
   - [`extension/sidepanel.js`](../extension/sidepanel.js) pack chooser — two-card lineup renderer + pack-id constant
   - [`lib/packs/index.ts`](../lib/packs/index.ts) — import the pack + add to the `PACKS` registry
4. **Add mascot SVG overrides** if the pack ships custom peanut visuals — `personaMascotHTML(personaId, packId)` in `extension/sidepanel.js` handles per-pack gradient/prop overrides.
5. **Write fixtures** under `scripts/fixtures/director/*.json` that exercise the pack's characteristic tells — a transcript the producer should definitely fire on, a transcript the troll should definitely fire on, etc.
6. **Run `npm run check`** — typecheck + extension lint + director fixtures. All green before the pack can ship.

---

## Refinement loop (how we evolve packs over time)

Packs are not static. After every canary window:

1. **Pull fallback telemetry** for every persona in the pack:
   ```bash
   grep '"event":"persona_fallback_fired"' logs/pipeline-debug.jsonl | jq 'select(.data.personaName == "Molly")'
   ```
2. **Read the disagreement transcripts.** When `director_producer_pass` fires, read the `transcriptTail` field — does the tail actually lack fact-adjacent content, or is the producer prompt too conservative?
3. **Tune.** Changes land in this priority order:
   - Persona system prompt (your main lever — see [DESIGN-PRINCIPLES rule 4](DESIGN-PRINCIPLES.md#4-customer-value-wins-over-industry-norms): the Director has had plenty of work, the personas are the lever).
   - Director hint (directorHint field).
   - `factCheckMode` (producer only, rare — this is a character-design decision, not a calibration knob).
   - Claim-detector patterns (last resort — changes affect every pack's producer).
4. **Re-canary.** Ship the prompt change behind a pack iteration, rerun sessions, confirm fallback rate drops.
5. **Update this doc** if the tuning surfaces a new invariant worth codifying.

---

## Changelog

- **2026-04-21** — Producer contract codified after The Producer false-pass audit. Logs showed 9 consecutive `director_producer_pass` fallbacks in 8 min, every one on a tail with at least one proper noun. Root cause: producer prompts made `"-"` too easy an escape hatch when no `[FACT CHECK]` applied. Fix: both producers' prompts now define `[HEADS UP]` as the workhorse tier and restrict `"-"` to genuinely content-free tails. Section 2 "pass rule" and section 1 tier definitions both codify the change.
- **2026-04-20 (retroactive)** — `factCheckMode: "strict" | "loose"` added per-pack in [PR #82](https://github.com/Sethmr/peanut.gallery/pull/82). Howard's Baba is `loose` (over-correction is the character), TWiST's Molly is `strict` (journalist).

---

## Related canonical sources

- [`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md) — durable product direction (rules #1 "committed UI surface always lands," #2 "Director balances characters," #3 "fact-check is per-pack character design" all anchor here).
- [`CONTEXT.md`](CONTEXT.md) — full project context, architecture, cost table.
- [`BUILD-YOUR-OWN-BACKEND.md`](BUILD-YOUR-OWN-BACKEND.md) — wire-spec for self-hosters swapping the Next.js backend for their own.
- [`ROADMAP.md § v1.8.x`](ROADMAP.md#v18x-persona-refinement-sprint) — the bigger quarterly cycle this guide serves.
- [`lib/claim-detector.ts`](../lib/claim-detector.ts) — the gate implementation.
- [`lib/director.ts`](../lib/director.ts) — where the gate is applied.
