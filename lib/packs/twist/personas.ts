/**
 * Peanut Gallery — TWiST Pack
 *
 * The This Week in Startups lineup. 4 AI personas mapped onto the fixed
 * archetype slots:
 *   producer  → Molly Wood        (veteran tech journalist — fact-checker)
 *   troll     → Jason Calacanis   (host of TWiST; loud, opinionated, warm)
 *   soundfx   → Lon Harris        (writer/producer; dry pop-culture reframes)
 *   joker     → Alex Wilhelm      (data comedian — numbers as punchlines)
 *
 * Characterization notes + source links live in
 * `docs/packs/twist/RESEARCH.md`. When a voice drifts, go there first.
 *
 * This file owns the CONTENT (4 persona system prompts). The Persona type,
 * the shared context builder, and the pack registry live upstream.
 *
 * IMPORTANT: These are AI personas INSPIRED BY the real hosts. The system
 * prompts are written so the model never claims to BE the person — it plays
 * a caricature in the spirit of the show. This framing is load-bearing for
 * impersonation safety and must not be softened.
 *
 * PACK-WIDE TUNING DIRECTION (Seth, 2026-04-23 — persona-refinement push):
 * TWiST viewers are mostly founders and operators. Every persona should
 * LEAN INTO STARTUP ADVICE — close lines with a benchmark to hit, a
 * metric to watch, a caveat to weigh, a playbook note, or a "here's
 * what I'd actually do." The voice stays in-character (Molly's
 * journalism-humility, Jason's host-conviction, Lon's dry reframe,
 * Alex's data-comedy), but the *ending* of each line should more often
 * hand the founder-in-the-audience something they can chase. Dunks are
 * fine when the dunk itself teaches a lesson; pure vibes-roast is off-
 * brief for this pack. This direction applies to every persona in the
 * pack — bake it into directorHint + kernel when each deep-research
 * file lands. (As of 2026-04-23: Alex, Lon, Molly, and Jason all
 * reflect this in their v1.8 kernels. Jason's pack-role IS the
 * founder-coach mode, so the startup-advice lean is native to him
 * rather than tacked on — the kernel is explicitly framed as "TWiST
 * mode, not All-In panel-provocateur mode; substance over snark.")
 */

import type { Persona } from "../../personas";
import { ALEX_KERNEL, ALEX_REFERENCE } from "./prompts/alex-wilhelm";
import { LON_KERNEL, LON_REFERENCE } from "./prompts/lon-harris";
import { MOLLY_KERNEL, MOLLY_REFERENCE } from "./prompts/molly-wood";
import { JASON_KERNEL, JASON_REFERENCE } from "./prompts/jason-calacanis";

export const twistPersonas: Persona[] = [
  // ─────────────────────────────────────────────────────────
  // 1. THE JOURNALIST — Molly Wood (producer slot)
  //
  // v1.8 persona-refinement push: Molly is the sixth persona landed
  // from the deep-research plan. The kernel + reference live in
  // `./prompts/molly-wood.ts`. The prose is treated as truth — do
  // not rewrite voice rules, the "exit not escalation" Calacanis-
  // silence discipline, the inline full-disclosure pattern, the
  // Twist-pack tuning (sage over snark), or red lines without
  // Seth's explicit ask.
  //
  // ARCHETYPE SHIFT (v1.8 — producer journalist variant).
  // The pre-v1.8 Molly was a classical tier-tagged fact-checker
  // with [FACT CHECK] / [CONTEXT] / [HEADS UP] / [CALLBACK] output
  // and EVIDENCE gate in buildPersonaContext. The v1.8 kernel
  // keeps the fact-checker DNA but drops the tier-tag output:
  // Molly now reacts conversationally, with inline source anchors
  // ("Heatmap's reporting has them ducking Scope 3...") rather
  // than bracketed verdict tags. This is NPR-reporter register,
  // not classical fact-checker register.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Output contract: "Exactly 1-2 sentences. A fact-check-
  //     shaped reaction with a source anchor (named outlet,
  //     analyst, study, or Scope-3-style metric)." No tier tags.
  //   - Voice: concession opener ("To be fair…", "I mean…",
  //     "Steelmanning that…") → hard "but" pivot → question or
  //     low-key call to action close.
  //   - Tuning dial: "Sage over snark." If the claim is sloppy,
  //     be precise, not mean. If greenwashy, get quieter and
  //     name the Scope 3. If real progress, "magic is happening"
  //     + ask for engineering detail.
  //   - Inline "full disclosure" pattern when talking about
  //     Amasia portfolio companies or long relationships.
  //   - Hard rule: refuse to characterize Jason Calacanis or the
  //     2023 TWiST exit — redirect forward.
  //   - Critical platform-accuracy anchor: she's NOT active on X
  //     in 2024-2026. Don't let the persona simulate tweeting.
  //   - Grounded in 20+ years of voice history (CNET 2000-2013,
  //     NYT 2014-15, Marketplace Tech 2015-2021, LAUNCH Managing
  //     Director 2022, Molly Wood Media / Amasia VP 2023-present).
  //   - Startup-advice lean at line-end per pack-wide direction.
  //
  // SCAFFOLDING CHANGE — persona.producerMode = "layered-fact-checker".
  // 2026-04-23 evening: Molly is the second persona to land the
  // fact-check-layer methodology (Baba was first). The voice contract
  // (NPR-journalist, concession-then-pivot, inline source anchors,
  // sage-over-snark) is UNCHANGED from v1.8; the kernel now also
  // embeds the CONFIRMS / CONTRADICTS / COMPLICATES / THIN tier
  // taxonomy with canonical lines rewritten in her reporter-desk
  // register. Methodology doc: `docs/FACT-CHECK-LAYER.md`.
  //
  // `buildPersonaContext` reads this flag and:
  //   - uses the default `SEARCH RESULTS (use for fact-checking)`
  //     framing (CHANGED from the prior `REPORTING ANCHORS` framing)
  //     so the kernel patch's "Read SEARCH RESULTS before speaking"
  //     rule matches the header. She still cites named sources
  //     inline; the header label doesn't change her voice, just
  //     aligns labels with the tier-taxonomy instruction.
  //   - **skips** the legacy EVIDENCE: GREEN / THIN / NONE gate
  //     (obsolete [FACT CHECK] / [HEADS UP] tags would contradict
  //     the new four-tier taxonomy).
  //   - leaves pre-animation + "-" safety net intact.
  // See `lib/personas.ts` for the gate and producerMode docs.
  //
  // factCheckMode stays "strict" — she's a veteran journalist,
  // the Director's claim-detector sensitivity should stay tight
  // (fires on hard sourceable claims, not speculation).
  // Orthogonal to producerMode.
  //
  // Integration with Director + ensemble is unchanged: directorHint
  // (rewritten for journalist triggers) feeds the v3 routing call,
  // cascades still inject other personas' last lines, Director
  // still owns WHEN Molly speaks. Kernel + reference shape HOW
  // she reacts once picked — per DESIGN-PRINCIPLES rule 3a.
  //
  // Model: Claude Haiku (same as pre-v1.8 — Molly's register
  // needs nuance for the concession-then-pivot cadence; Haiku's
  // nuance-on-budget voice is the right fit).
  // ─────────────────────────────────────────────────────────
  {
    id: "producer",
    name: "Molly",
    role: "The Fact-Checker",
    emoji: "📓",
    color: "#3b82f6",
    model: "claude-haiku",
    // Strict — she's a veteran journalist; claim-detector sensitivity
    // should stay anchored to hard sourceable claims (numbers, dates,
    // attributions, corporate actions). Orthogonal to producerMode.
    factCheckMode: "strict",
    // 2026-04-23 fact-check-layer: NPR-journalist register plus the
    // CONFIRMS / CONTRADICTS / COMPLICATES / THIN tier taxonomy,
    // canonical lines written in her voice. See
    // `docs/FACT-CHECK-LAYER.md` for the full methodology.
    producerMode: "layered-fact-checker",
    directorHint:
      "NPR-trained reporter turned climate-tech VC who fact-checks from the reporter-desk posture — concedes the frame, cites a named source ('Heatmap's reporting…', 'the GridLab study…'), lands the unit-economics question. Pick on hard sourceable claims (funding, timelines, gross margin, Scope 3, cap table, corporate actions, numbers, dates, attributions), greenwashing tells, or 'move fast and break things' applied to infrastructure/biotech. Per TWiST pack-wide startup-advice lean: sage over snark; closes with a question or actionable unit-economics reframe. Refuses to characterize Jason Calacanis or the 2023 exit — redirects forward.",
    systemPrompt: MOLLY_KERNEL,
    personaReference: MOLLY_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 2. THE HOST — Jason Calacanis (troll slot)
  //
  // v1.8 persona-refinement push: Jason is the seventh persona
  // landed from the deep-research plan. Two author-delivered
  // artifacts landed together: a SKILL.md persona card (kernel)
  // and a 23-section Reference Corpus (reference). Both merged
  // in `./prompts/jason-calacanis.ts`. The prose is treated as
  // truth — do not rewrite voice rules, the TWiST-pack framing
  // ("substance over snark, founder-coach mode, NOT All-In
  // panel-provocateur mode"), pitch-coaching lexicon, red lines,
  // or the do-not-fabricate corrections list without Seth's
  // explicit ask.
  //
  // SPECIAL-LOVE DISCIPLINE (Seth, 2026-04-23). Jason is the
  // load-bearing persona for this pack — the TWiST host, the
  // LAUNCH founder, the voice the whole TWiST pack orbits
  // around. If a line wouldn't feel good for him to read, it's
  // the wrong line. The kernel + reference privilege his
  // founder-coach register (warm loud, not mean loud), preserve
  // his own self-deprecation cards as bits he owns, and codify
  // the "no public bad blood" discipline on the 2023 Molly Wood
  // co-host departure (mirroring her kernel's reciprocal
  // discipline — neither persona re-litigates the split).
  //
  // Two editorial edits to the author-delivered SKILL.md
  // (documented in the prompts module header for full
  // provenance): (1) replaced the one internal-contradiction
  // example that used "vitamin not a painkiller" framing (the
  // SKILL's own rules + the corpus Section 23 corrections
  // explicitly forbid this framing) with a feature-not-a-
  // company variant; (2) added a "no characterization of the
  // 2023 TWiST co-host departure" bullet under What to Avoid
  // to codify the documented "no public bad blood" posture and
  // mirror Molly's kernel discipline.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Voice is now grounded in the full corpus: Bay Ridge →
  //     Fordham bio, 2001 dot-com bust + 2011 Google Panda as
  //     formative ate-shit moments, $25K Uber check at $5M post
  //     as the founding anecdote, 2,200+ TWiST episodes, Author
  //     of *Angel*, Sequoia Scout, LAUNCH Fund IV.
  //   - 5-mode pace model: rant / advice / pitch / earnest /
  //     breaking-news. Each mode has its own cadence.
  //   - Explicit do-not-fabricate list (pulled from corpus §22-
  //     23): no "vitamin/painkiller", no "pour one out" sympathy
  //     register, no explicit "I was wrong about X" mea culpas
  //     ("the facts changed" is his register), DataStax NOT
  //     Datadog, no "why you/why this/why now" attribution, no
  //     "idea maze" attribution, no "hair on fire customer"
  //     attribution, no "startup graveyard wall" set piece.
  //   - Verified catchphrases tagged by mode (47+ signature
  //     phrases tracked).
  //   - 2024-2026 current takes anchored: OpenAI/Altman critical
  //     turn (Nov 2025), OpenClaw/Replicants obsession (Feb 2026),
  //     LAUNCH Fund IV pitch, Sacks talk-time blowup, Trump-Musk
  //     "donnybrook" neutral posture.
  //   - Pack-wide startup-advice lean is native to Jason — his
  //     whole pack-role IS the founder-coach mode.
  //
  // ARCHETYPE NOTE (slot assignment unchanged): Jason fills the
  // TWiST pack's "troll" archetype slot as a STYLIZED fit —
  // provocateur / host / founder-advocate. Slot id is load-
  // bearing for Director routing; voice contract is what the
  // SKILL.md + corpus describe (substance over snark). No
  // scaffolding change needed (unlike Baba's producerMode flip
  // — troll slot has no evidence-gate wiring to suppress).
  //
  // Integration with Director + ensemble is unchanged: directorHint
  // (rewritten for TWiST-pack founder-coach register, not All-In
  // provocateur) feeds the v3 routing call, cascades still inject
  // other personas' last lines, Director still owns WHEN Jason
  // speaks. Kernel + reference shape HOW he reacts once picked —
  // per DESIGN-PRINCIPLES rule 3a.
  //
  // Model: xAI Grok 4.1 Fast (non-reasoning). Jason is the load-
  // bearing persona for this pack — the voice quality HAS to land,
  // and rate-limit silence on the host is not an acceptable failure
  // mode. Grok's native provocateur lean suits the "warm loud, not
  // mean loud" brief well when the system prompt anchors it to
  // Jason's actual TWiST-pack principles (founders first, metrics
  // battery, feature-not-a-company pitch-kill vein). Non-reasoning
  // variant preserves the interrupt energy — deliberation would
  // make him sound off.
  // ─────────────────────────────────────────────────────────
  {
    id: "troll",
    name: "Jason",
    role: "The Host",
    emoji: "🎙️",
    color: "#ef4444",
    model: "xai-grok-4-fast",
    directorHint:
      "TWiST founder-coach mode — not All-In panel-provocateur mode. Substance over snark. Pick on founder/startup/VC/tech/pitch/macro-to-runway moments where a Brooklyn hustler-turned-angel would have a take a founder could act on Monday. Signature lanes: the metrics battery (CAC, payback, cohort retention, burn multiple), the pitch-kill vein ('feature, not a company' / 'laser, not a grenade' / 'who's desperate for this'), breaking-news magnitude markers ('DEFCON 1', 'unprecedented'), AI-era moat challenge ('what's your moat when OpenAI ships this next Tuesday?'). Defaults to 1-2 sentences, flexes to 3-4 only when real founder advice is warranted. Warm loud, not mean loud. Never characterizes the 2023 Molly Wood co-host exit — redirects forward.",
    systemPrompt: JASON_KERNEL,
    personaReference: JASON_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 3. THE REFRAME — Lon Harris (soundfx slot)
  //
  // v1.8 persona-refinement push: Lon is the fifth persona landed
  // from the deep-research plan. The kernel + reference now live in
  // `./prompts/lon-harris.ts`. The prose is treated as truth — do
  // not rewrite voice rules, the "considered reframe" core move,
  // the Twist-pack tuning direction (less snark, more useful
  // counsel), or the red lines without Seth's explicit ask.
  //
  // ARCHETYPE SHIFT (v1.8). The pre-v1.8 Lon was a SFX-drop +
  // cultural-analogy persona ([record scratch], [Jeopardy think
  // music], "This is WeWork energy") — a TWiST-flavored cousin of
  // Fred. The v1.8 kernel repositions him as a pure considered-
  // reframe persona: ONE measured sentence that recasts the prior
  // claim through a narrative / structural / pop-culture lens. No
  // more bracketed sound cues. Slot stays "soundfx" — load-bearing
  // for Director routing — but the voice contract is now "one
  // considered sentence," not "editorial sound cue."
  //
  // What changed from the pre-v1.8 prompt:
  //   - Output contract: one considered sentence (optional second)
  //     rather than a bracketed SFX + cultural-analogy hybrid.
  //   - Core move: "concessive opener → specific contrast → landed
  //     observation" (writer's-syntax-in-speech), grounded in
  //     transcript mining across Business Breakdowns + TWiST
  //     Flashback + dot.LA / Inside Streaming prose.
  //   - Startup-advice lean (pack-wide direction per Seth 2026-04-23):
  //     "Source Lon deflates with a sting; Twist-pack Lon deflates
  //     and hands back something useful." Reframes close on a
  //     benchmark / next question / actionable read where possible.
  //   - Lane discipline: defers to Alex on pure numbers (SPVs,
  //     valuations, seed-state); lands on narratively-shaped claims
  //     (bold predictions, founder mythologies, Hollywood-SV
  //     crossovers, "X is dead" framings).
  //   - Tuning dial: snark volume reduced ~30%; mock-filmmaker-
  //     monologue move (where his blog-era trolliness lives)
  //     dialed way down for Twist-pack.
  //
  // Output-format note: this kernel does NOT emit bracketed SFX
  // ([record scratch], [crickets], etc.). The "soundfx" slot id
  // remains — Director routing patterns, cooldowns, and cascade
  // rolls don't care about output format — but the UI will render
  // Lon's output as plain one-sentence text now rather than
  // bracketed stage directions. Pre-v1.8 TWiST fixtures that
  // assume bracketed output from this slot would need re-baselining
  // if/when they exist; current Director fixtures (SFX-independent)
  // pass unchanged.
  //
  // Integration with Director + ensemble is unchanged: directorHint
  // (rewritten for narrative-reframe triggers) feeds the v3 routing
  // call, cascades still inject other personas' last lines via
  // buildPersonaContext, Director still owns WHEN Lon speaks.
  // Kernel + reference shape HOW he reframes once picked — per
  // DESIGN-PRINCIPLES rule 3a ("Persona prompts are the lever, not
  // the Director").
  //
  // Model: xAI Grok 4.1 Fast non-reasoning. Lon's measured pace +
  // one-sentence discipline doesn't require reasoning mode; non-
  // reasoning keeps latency tight for the sidebar rhythm. If voice
  // quality drifts into shallow territory in practice, a future
  // swap to Claude Haiku is a one-line change.
  // ─────────────────────────────────────────────────────────
  {
    id: "soundfx",
    name: "Lon",
    role: "The Reframe",
    emoji: "🥚",
    color: "#a855f7",
    model: "xai-grok-4-fast",
    directorHint:
      "Considered reframe — one measured sentence that recasts the prior claim through a narrative, structural, or pop-culture lens. Pick on bold predictions, founder mythologies, 'X is dead / X is inevitable' framings, Hollywood-SV crossovers, media-business hot takes, or moments where a film/TV parallel would compress a paragraph of analysis into a clause. Defers on pure numbers (Alex's lane). Per TWiST pack-wide startup-advice lean: closes with a useful next question, benchmark, or actionable read when stakes are real. Dry, specific, secretly generous — no hot-take volume, no performative outrage.",
    systemPrompt: LON_KERNEL,
    personaReference: LON_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 4. THE DATA COMEDIAN — Alex Wilhelm (joker slot)
  //
  // v1.8 persona-refinement push: Alex is the second persona landed from
  // the deep-research plan (after Jackie). The kernel + reference now
  // live in `./prompts/alex-wilhelm.ts` and follow the author-delivered
  // persona-file schema (one-line essence + output contract + 18-section
  // reference at top, "system prompt for the AI director" kernel at
  // bottom). The prose is treated as truth — do not rewrite voice rules,
  // the "less troll, more constructive" tuning, the topic-to-reflex
  // table, or red lines without Seth's explicit ask.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Voice is now grounded in a decade of "one daily markets column
  //     under four names" (Editor's Morning Note → Morning Markets →
  //     The Exchange → Cautious Optimism), the Equity podcast corpus,
  //     and TWiST co-host appearances — not a hand-crafted shape.
  //   - Explicit "DIAL UP / DIAL DOWN" Peanut-Gallery tuning: specific
  //     numbers, acknowledgments-before-pivots, self-deprecating
  //     admissions of ignorance, concrete thing-to-do tag at line-end.
  //   - Topic-to-reflex table keyed for AI-era conversations (OpenAI,
  //     Anthropic, Claude Code, Nvidia/Jensen, hyperscaler capex,
  //     WeWork-on-the-bell hedge) — the prior prompt leaned heavier on
  //     cap-table-only material.
  //   - Register-switch guidance: excitable default → earnest-analyst
  //     on real money / layoffs → warm self-deprecation when called out.
  //   - Startup-advice lean at line-end (pack-wide direction — see
  //     file-level comment): closes with a benchmark to hit, metric to
  //     watch, or caveat to weigh rather than vibes-only deflation.
  //
  // Integration with Director + ensemble is unchanged: directorHint still
  // feeds the v3 routing call, cascades still inject "other personas'
  // last line" via buildPersonaContext, Director still owns WHEN Alex
  // speaks. The kernel + reference shape HOW he speaks once picked — per
  // DESIGN-PRINCIPLES rule 3a ("Persona prompts are the lever, not the
  // Director").
  //
  // Model: Claude Haiku (data jokes need timing + number precision).
  // ─────────────────────────────────────────────────────────
  {
    id: "joker",
    name: "Alex",
    role: "The Data Comedian",
    emoji: "🥔",
    color: "#f59e0b",
    model: "claude-haiku",
    directorHint:
      "Data comedian — specific numbers, metrics, comps, or named callbacks as punchlines (never pure vibes). Pick on valuations, funding rounds, Rule-of-40 math, cap-table burns, AI-round hype (OpenAI/Anthropic/Nvidia), or hype-cycle comps. Peanut-Gallery-tuned: less troll, more constructive — closes with a benchmark to hit, metric to watch, or caveat to weigh (startup-advice lean). Italicizes one word per turn.",
    systemPrompt: ALEX_KERNEL,
    personaReference: ALEX_REFERENCE,
  },
];
