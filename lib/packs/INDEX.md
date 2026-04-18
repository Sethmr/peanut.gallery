# `lib/packs/` — Pack abstraction

Each pack is 4 personas mapped to 4 archetype slots (`producer`, `troll`, `soundfx`, `joker`). Director is pack-agnostic — swapping packs swaps voices, not routing logic.

Parent: [`../INDEX.md`](../INDEX.md). Origin: [`../../CHANGELOG.md`](../../CHANGELOG.md) v1.3.0 "TWiST Pack" entry.

## Files

| File | Purpose |
|---|---|
| [`index.ts`](index.ts) | Exports `resolvePack(id)` — the single forward-compat choke point. Unknown/missing/malformed ids always degrade to Howard. Never throws. |
| [`types.ts`](types.ts) | `Pack` type — id, display name, persona array, optional metadata. Shared by both packs. |
| [`howard/`](howard/) | Default pack. Baba Booey, The Troll, Fred Norris, Jackie Martling. |
| [`twist/`](twist/) | TWiST pack. Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm. Character research in [`../../docs/packs/twist/RESEARCH.md`](../../docs/packs/twist/RESEARCH.md). |

## Archetype slot → model (v1.4)

| Slot | Howard | TWiST | Model |
|---|---|---|---|
| `producer` (fact-checker) | Baba Booey | Molly Wood | Anthropic Claude Haiku + Brave/xAI Live Search |
| `troll` (provocateur) | The Cynical Troll | Jason Calacanis | xAI Grok 4.1 Fast non-reasoning |
| `soundfx` (reframe/sfx) | Fred Norris | Lon Harris | xAI Grok 4.1 Fast non-reasoning |
| `joker` (comedy writer) | Jackie Martling | Alex Wilhelm | Anthropic Claude Haiku |

## Adding a new pack (current state)

1. Create `lib/packs/<id>/personas.ts` + `index.ts`.
2. Add the id to `resolvePack` in [`index.ts`](index.ts).
3. Add the id to `PACKS_CLIENT` in [`../../extension/sidepanel.js`](../../extension/sidepanel.js) so the dropdown renders it.
4. Add fixtures under `scripts/fixtures/director/<id>-*.json` and run `npm run test:director --pack <id>`.

A proper sideloadable pack-install flow (upload a pack JSON, validate, merge into dropdown) is on the deferred list — see `docs/ROADMAP.md`.

## Anti-impersonation guardrails

Every TWiST persona prompt includes: *"NEVER claim to BE [person]. You are a persona INSPIRED BY him/her."* This is load-bearing for the legal/ethical framing. Do not remove.
