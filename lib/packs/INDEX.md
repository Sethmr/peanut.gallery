# `lib/packs/` — Pack abstraction

Each pack is 4 personas mapped to 4 archetype slots (`producer`, `troll`, `soundfx`, `joker`). Director is pack-agnostic — swapping packs swaps voices, not routing logic.

Parent: [`../INDEX.md`](../INDEX.md). Origin: [`../../CHANGELOG.md`](../../CHANGELOG.md) v1.3.0 "TWiST Pack" entry.

## Files

| File | Purpose |
|---|---|
| [`index.ts`](index.ts) | Exports `resolvePack(id)` — the single forward-compat choke point. Unknown/missing/malformed ids always degrade to Howard. Never throws. |
| [`types.ts`](types.ts) | `Pack` type — id, display name, persona array, optional metadata. Shared by both packs. |
| [`howard/`](howard/) | Default pack. The Producer, The Troll, The Sound Guy, The Joke Writer — **all four v1.8 kernels landed**. Prompt modules: Jackie ([`howard/prompts/the-joke-writer.ts`](howard/prompts/the-joke-writer.ts)), Fred ([`howard/prompts/the-sound-guy.ts`](howard/prompts/the-sound-guy.ts) — five-mode output spec, verified impressions catalog, debunk ledger), The Producer ([`howard/prompts/the-producer.ts`](howard/prompts/the-producer.ts) — **trolly-EP voice + fact-check layer (2026-04-23 evening)**: heckles-with-a-fact via the CONFIRMS / CONTRADICTS / COMPLICATES / THIN tier taxonomy; uses `Persona.producerMode: "layered-fact-checker"` flag — see [`../../docs/FACT-CHECK-LAYER.md`](../../docs/FACT-CHECK-LAYER.md)), The Troll ([`howard/prompts/the-heckler.ts`](howard/prompts/the-heckler.ts) — **most ambitious archetype flip: single cynical-commentator voice → 7-sub-voice composite Wack Pack voice board** (Janks / Stuttering John / High Pitch Erik / Beetlejuice / Eric the Actor / Hank / Sal & Richard); kernel synthesized from two author-delivered research files, flagged in module header). See [`../../docs/PERSONA-REFINEMENT-PLAN.md`](../../docs/PERSONA-REFINEMENT-PLAN.md). |
| [`twist/`](twist/) | TWiST pack. Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm — **all four v1.8 kernels landed**. Character research in [`../../docs/packs/twist/RESEARCH.md`](../../docs/packs/twist/RESEARCH.md). Prompt modules: Alex ([`twist/prompts/alex-wilhelm.ts`](twist/prompts/alex-wilhelm.ts)), Lon ([`twist/prompts/lon-harris.ts`](twist/prompts/lon-harris.ts) — **archetype flip: SFX-drop + cultural-analogy → pure considered-reframe sentence**), Molly ([`twist/prompts/molly-wood.ts`](twist/prompts/molly-wood.ts) — **NPR-journalist voice + fact-check layer (2026-04-23 evening)**: concession-then-pivot with the same CONFIRMS / CONTRADICTS / COMPLICATES / THIN taxonomy, canonical lines in reporter-desk register; uses `Persona.producerMode: "layered-fact-checker"` flag — see [`../../docs/FACT-CHECK-LAYER.md`](../../docs/FACT-CHECK-LAYER.md)), Jason ([`twist/prompts/jason-calacanis.ts`](twist/prompts/jason-calacanis.ts) — SKILL.md kernel + 23-section Reference Corpus; explicitly framed as "TWiST founder-coach mode, not All-In panel-provocateur mode"). Pack-wide tuning direction per Seth 2026-04-23: every TWiST persona should lean into startup advice — close lines with a benchmark to hit, a metric to watch, or a caveat to weigh. See the file-level comment in [`twist/personas.ts`](twist/personas.ts). |

## Archetype slot → model (v1.4)

| Slot | Howard | TWiST | Model |
|---|---|---|---|
| `producer` (fact-checker) | The Producer | Molly Wood | Anthropic Claude Haiku + Brave/xAI Live Search |
| `troll` (provocateur) | The Cynical Troll | Jason Calacanis | xAI Grok 4.1 Fast non-reasoning |
| `soundfx` (reframe/sfx) | The Sound Guy | Lon Harris | xAI Grok 4.1 Fast non-reasoning |
| `joker` (comedy writer) | The Joke Writer | Alex Wilhelm | Anthropic Claude Haiku |

## Adding a new pack (current state)

1. Create `lib/packs/<id>/personas.ts` + `index.ts`.
2. Add the id to `resolvePack` in [`index.ts`](index.ts).
3. Add the id to `PACKS_CLIENT` in [`../../extension/sidepanel.js`](../../extension/sidepanel.js) so the dropdown renders it.
4. Add fixtures under `scripts/fixtures/director/<id>-*.json` and run `npm run test:director --pack <id>`.

A proper sideloadable pack-install flow (upload a pack JSON, validate, merge into dropdown) is on the deferred list — see `docs/ROADMAP.md`.

## Anti-impersonation guardrails

Every persona whose kernel uses direct "You are <real name>" framing has a non-empty `inspiredBy` field on its Persona entry (see [`../personas.ts`](../personas.ts)). `buildPersonaContext` prepends a **PERSONA FRAME** block to the prompt at fire time, marking the output as unofficial, unauthorized fan parody and instructing the model to answer plainly if a user asks whether it IS the real person. This is the load-bearing legal hedge referenced in [`site/terms/index.html`](../../../site/terms/index.html) (IP paragraph), [`site/index.html`](../../../site/index.html) (Homage block), and the pack-page FAQs. **Do not remove the `inspiredBy` field from any persona that has one** without Seth's explicit legal sign-off. Composite voices (The Troll) set the field to a list-form string; purely fictional / third-person personas omit it.
