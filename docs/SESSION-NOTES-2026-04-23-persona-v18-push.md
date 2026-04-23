# Session notes — 2026-04-23 persona v1.8 push

Deep-research persona kernels landed for all 8 personas in both packs.
Shipped to `develop` as two commits (`e58e620` + `a562ac3`), pushed to
origin. Pre-commit `npm run check` green on both.

## Scope landed

All 8 personas now run on v1.8 author-delivered deep-research content:

| Pack   | Slot     | Persona       | Archetype change |
|--------|----------|---------------|------------------|
| Howard | producer | Baba Booey    | **fact-checker → trolly heckler** (new `producerMode: "heckler"`) |
| Howard | troll    | The Troll     | **single cynical commentator → 7-sub-voice composite Wack Pack voice board** (Janks / Stuttering John / High Pitch Erik / Beetlejuice / Eric the Actor / Hank / Sal & Richard) |
| Howard | soundfx  | Fred Norris   | five-mode output spec (SFX / zinger / impression / silence / mini-riff) |
| Howard | joker    | Jackie        | grounded in his own "How To Tell A Joke" craft rules + 1986-2001 Stern-note template |
| TWiST  | producer | Molly Wood    | **classical tier-tagged fact-checker → NPR-journalist conversational** (new `producerMode: "journalist"`) |
| TWiST  | troll    | Jason         | TWiST founder-coach mode (NOT All-In panel-provocateur mode) |
| TWiST  | soundfx  | Lon Harris    | **SFX-drop + cultural-analogy → pure considered-reframe sentence** (no more bracketed sound cues from this slot) |
| TWiST  | joker    | Alex Wilhelm  | data-comedian with register-switching (data / incredulous / joke-deflation / earnest-nerd-out / self-deprecation) |

## Architecture additions

Two new optional fields on `Persona` in [`lib/personas.ts`](../lib/personas.ts):

- **`personaReference?: string`** — long-form retrieval material
  (examples, voice detail, craft rules, topic buckets, dynamics, red
  lines, joke banks, identity anchors). `buildPersonaContext`
  inserts this between the system prompt and the live transcript
  so the model reads voice + deployable material in one pass.

- **`producerMode?: "fact-checker" | "heckler" | "journalist"`** —
  producer-slot scaffolding variant. Only meaningful on `id ===
  "producer"`; other slots ignore it. Controls two things in
  `buildPersonaContext`:
    - **Search-results framing** (three-way branch):
        - `"fact-checker"` (default): *"SEARCH RESULTS (use for fact-checking)"*
        - `"heckler"`: *"BACKGROUND FACTS (use as heckle fuel if something jumps out)"*
        - `"journalist"`: *"REPORTING ANCHORS (cite inline if one fits your reaction)"*
    - **EVIDENCE: GREEN/THIN/NONE tier gate** — only fires for
      `"fact-checker"`. `"heckler"` and `"journalist"` skip the
      gate because tier tags contradict their kernels.

UI contracts (pre-animation + `-`-pass safety net) still apply to all
three modes — those are surface contracts, not voice contracts.

Prompt modules live in:
- [`lib/packs/howard/prompts/`](../lib/packs/howard/prompts/) — 4 files
- [`lib/packs/twist/prompts/`](../lib/packs/twist/prompts/) — 4 files

Each module exports a `*_KERNEL` and `*_REFERENCE` string.

## Director untouched

Zero edits to `director.ts`, `director-llm-v2.ts`, cascade
probabilities, claim-detector, or fallback machinery. Per
DESIGN-PRINCIPLES rule 3a ("Persona prompts are the lever, not the
Director"), all v1.8 changes are persona-layer / content-layer /
scaffolding-flag. 26/26 director fixtures × 50 runs green after
every landing.

## Pack-wide TWiST startup-advice lean

Seth's 2026-04-23 directive: every TWiST persona should lean into
startup advice — close lines with a benchmark to hit, a metric to
watch, or a caveat to weigh. Baked into all four TWiST kernels
(native to Jason; explicit "DIAL UP" in Alex; encoded in Molly's
"LEAN: Sage over snark"; explicit in Lon's "Twist-pack tuning"
section). See file-level comment in [`lib/packs/twist/personas.ts`](../lib/packs/twist/personas.ts).

## Load-bearing behavioral disciplines

Preserve these exactly as shipped — they encode real-world record:

- **Molly ↔ Jason 2023 TWiST exit discipline (mirror rule).** Both
  kernels have a "no characterization of the 2023 TWiST co-host
  departure — redirect forward" rule. Molly has had zero public
  statement on the split since March 2023 (documented in her corpus
  §15). Jason's documented posture is "no public bad blood." The
  two kernels now mirror each other — neither persona re-litigates
  the split in public. Removing either side breaks the symmetry.

- **The Troll's "inability to understand why they're funny" rule.**
  Stern-doctrine single most leveraged guardrail — the Troll
  breaks the moment he winks. NO meta-commentary, NO "just kidding"
  de-escalation, NO explaining the joke. Hard-coded in the kernel.

- **Stern-doctrine red-line framework** (The Troll). Anchored to
  Stern's OWN public regrets — 1993 blackface, Feb 24 2015 r-word
  vote, Robin Williams sledgehammer interview, Aurora-Janks 2012
  false-death-toll precedent, Artie Lange arc. The kernel's test
  is verbatim from the meta-doc: *"Would Stern today defend this
  bit on-air in a Rolling Stone interview? If no, don't ship it."*

- **Fred's verification ledger.** Explicit "claims you will never
  make" list: NO 2012 stroke, NO "Howard Pack" alter-ego label
  (it's Kurt Waldheim Jr.), NO "Hey Now Fred Norris" Bandcamp
  authorship (fan project), NO "Silver Nickels" authorship (Howard
  1966 composition, Fred covered), only the impressions in the
  confirmed-canonical list (21 entries) — unverified fan-lore
  impressions can be attempted if the director explicitly asks
  but never volunteered.

- **Molly's social-platform accuracy.** She LEFT X in April 2023.
  Active surfaces are Bluesky (@mollywood.co), LinkedIn, Substack,
  Threads. **Simulating active X posting in 2024-2026 is the single
  biggest inaccuracy risk for her persona** (her own corpus flags
  this).

## Open / known debts

### Pre-launch blocker: "inspired by" audit (Seth's task)

The v1.8 kernels use **direct "You are X" framing** (per author-
delivered prose — "You are Jackie Martling…", "You are Jason
Calacanis…", etc.) — a **departure** from the pre-v1.8 "You are
an AI persona inspired by X" hedge.

[`lib/packs/INDEX.md`](../lib/packs/INDEX.md) has a standing
"Anti-impersonation guardrails" note that says *"Every TWiST
persona prompt includes: 'NEVER claim to BE [person]. You are a
persona INSPIRED BY him/her.' This is load-bearing for the
legal/ethical framing. Do not remove."*

**The note was NOT removed**, but the v1.8 kernels don't honor it
— they were author-delivered with direct-voice framing, and Seth
directed me to "treat these as truth." Seth committed to
doing the **"inspired by" audit before launch** — this is still
his task. Three possible reconciliations:

1. Reinstate the "inspired by" hedge on all 8 kernels (one-line
   edit each — prefix their identity sentence).
2. Remove the guardrail note and accept direct-voice framing as
   the new policy, documenting the legal/ethical rationale.
3. Case-by-case per persona.

Blocker for CWS ship per the INDEX note.

### The Troll research gap (~15% fidelity)

Per the Troll meta-doc's own assessment, the persona is at ~85%
of achievable fidelity. Two files were shared (the consolidated
meta-summary + the gap-fill addendum on Stuttering John catalog
+ tier-2 Wack Pack bench) — the **~11K-word encyclopedia + the
300-word production kernel referenced in the meta-doc were NOT
directly shared**. I synthesized the kernel from the two delivered
files using author-delivered language verbatim wherever possible
(every rule traceable to source), and flagged the synthesis in
the [prompt module header](../lib/packs/howard/prompts/the-troll.ts).
If voice drifts to generic LLM-comedy mush in practice, that's
the signal the encyclopedia is needed. **If Seth eventually hands
over the real 300-word kernel, swapping in is a one-line change
(replace `THE_TROLL_KERNEL` export).**

### Jason kernel: two editorial edits I made

Both documented in the [module header](../lib/packs/twist/prompts/jason-calacanis.ts)
for full provenance:

1. **Fixed a vitamin/painkiller self-contradiction in Example 2.**
   The SKILL.md's own "What to avoid" rule says *"No 'vitamin vs.
   painkiller.' Not your lexicon. Use 'feature, not a company'
   instead"*, but its own Example 2 used the vitamin-painkiller
   framing. Replaced with *"Feature, not a company — show me the
   customer who'd cry if you shut down tomorrow"*, preserving the
   customer-pain test (documented as his actual line in the corpus)
   while respecting his own rule.

2. **Added a mirror-discipline bullet to "What to avoid."** Molly's
   v1.8 kernel has a hard "refuse to characterize Jason or the 2023
   exit — redirect forward" rule. Asymmetry felt wrong, and the
   Reference Corpus §7 confirms Jason's public posture as *"no
   public bad blood."* Added *"No characterization of the 2023
   TWiST co-host departure"* with matching redirect-forward
   instruction.

If Seth disagrees with either edit, both are localized in the
kernel string and easy to revert.

### The Troll future-director hook (documented, not built)

The meta-doc recommends the AI director pass a **register hint**
(e.g., `(janks)` / `(beetle)` / `(hank)`) per Troll invocation to
bias the sub-voice selection rather than leaving it random. The
kernel includes graceful-degradation: if no hint is present, it
picks based on the moment. **Extending the Director's invocation
payload to carry an optional per-invocation register string is
app-architecture work, not persona-landing work.** No Linear
ticket yet. Worth one if you want to pursue.

### Sound-effects toggle — open task

Seth asked for "a setting to turn off sound effects" late in the
session, then said "sorry, wrong context" and asked for these
handoff notes instead. **Request is still unfulfilled.** Implementation
path:
- Per-persona earcons play via `playPersonaCue()` in
  [`extension/sidepanel.js`](../extension/sidepanel.js) around
  line 2639, triggered by `updatePersonaSpeaking()` on speaker
  transitions (line ~2665).
- Settings drawer UI already exists (standard Peanut Gallery
  pattern — see `#settingsDrawer` etc. in sidepanel.js).
- Add a `soundEffectsEnabled` checkbox to the drawer, persist to
  `chrome.storage.local`, gate `playPersonaCue()` on the flag.
- Pair with the memory rule "drawer-triggered errors need modals,
  not showError" — not relevant here since it's a toggle, not an
  error, but keep in mind for settings UX.

Pick this up when Seth gives the green light.

### `.DS_Store` clutter

Two `.DS_Store` files remain as unstaged modifications in the
working tree. Intentional — per CLAUDE.md rule, don't amend-and-
force-push to strip them; just leave uncommitted.

## Files touched this session

**New (16 files total):**
- `lib/packs/howard/prompts/{jackie-martling,fred-norris,baba-booey,the-troll}.ts`
- `lib/packs/twist/prompts/{alex-wilhelm,lon-harris,molly-wood,jason-calacanis}.ts`
- `docs/persona-research/{howard-baba-booey,howard-fred,howard-jackie,howard-troll}.md`
  (research briefs — were untracked, now committed)
- `docs/persona-research/{twist-alex,twist-jason,twist-lon,twist-molly}.md`
- `docs/persona-sfx-prompts/*.md` (8 files — Seth's earcon-generation prompts)

**Modified:**
- `lib/personas.ts` — added `personaReference` + `producerMode` fields,
  three-way branch in `buildPersonaContext` for producer search-results
  framing, evidence-gate suppression for non-fact-checker modes.
- `lib/packs/howard/personas.ts` — all 4 Howard personas wired to new
  prompt modules. Role renames: Jackie "The Joke Man", Baba Booey
  "The Heckler".
- `lib/packs/twist/personas.ts` — all 4 TWiST personas wired. Role
  rename: Molly "The Journalist". File-level comment encodes the
  TWiST pack-wide startup-advice lean.
- `lib/packs/howard/index.ts` + `lib/packs/twist/index.ts` — both
  `updatedAt: "2026-04-23"`.
- `lib/packs/INDEX.md` — all landed personas pointed at.
- `extension/sidepanel.html` + `.js` — Seth's work: Molly + Jason hair,
  potato silhouette refinement, TWiST-pack cue/bit backdrop CSS.
- `extension/sounds/personas/*.wav` — Seth's refreshed earcons.
- `scripts/synth-persona-cues.ts` — Seth's updated synthesis script.

## Commits on origin/develop (this session's push)

- `a562ac3` feat(sidepanel): Molly + Jason hair, potato silhouette, TWiST-pack cue/bit backdrops
- `e58e620` feat(packs): v1.8 persona-refinement — 8/8 deep-research kernels landed

Pushed on top of Seth's 5 prior local commits (`727a428` → `da1c0db`).

## Testing the full product

- **Backend**: Railway should have auto-deployed from develop push
  2-3 min after the push. Probe `/api/*`, not `/` — middleware 308s
  non-API traffic to www and masks routing failures (memory
  `feedback_api_path_probe_not_root.md`).
- **Extension**: reload unpacked in `chrome://extensions/` to pick
  up sidepanel polish (Molly/Jason hair, potato silhouette, TWiST
  cue/bit backdrops, earcon cues). Persona voice changes ship
  server-side — no extension reload needed for those.
- **Happy path**: YouTube video → pick pack → watch 4 personas
  fire. Each voice should land visibly distinct from pre-v1.8:
  - Baba: tier-tagged → exasperated "oh come ON" heckles
  - Molly: `[HEADS UP]` tags → inline "Heatmap's reporting…" citations
  - Lon: `[record scratch]` drops → one-sentence reframes
  - Troll: single cynical voice → rotating Wack Pack sub-voices

## Pointers for next session

- Start with `lib/packs/*/prompts/*.ts` to see the new kernel +
  reference content. Each module has a load-bearing header comment
  explaining provenance, archetype shifts, and editorial edits.
- `lib/personas.ts` has the scaffolding gate logic + new field
  definitions. Worth reading the `producerMode` doc comment before
  touching the gate.
- The pre-launch "inspired by" audit is Seth's blocker — don't
  reflexively reinstate the hedge; wait for his call.
- The sound-effects toggle is an open task — see "Open debts"
  section above for implementation path.
