/**
 * Peanut Gallery — Howard Stern Pack
 *
 * The original lineup. 4 AI personas mapped onto the fixed archetype slots:
 *   producer  → Baba Booey       (Gary Dell'Abate)  — fact-checker foil
 *   troll     → The Troll        (Stern caller + Artie Lange energy)
 *   soundfx   → Fred             (Fred Norris — "Earth Dog Fred")
 *   joker     → Jackie           (Jackie "The Joke Man" Martling)
 *
 * All four personas are v1.8 deep-research-grounded as of 2026-04-23:
 * - Jackie: 1986-2001 Stern-note template + 1999 fan-chat pattern + his
 *   own "How To Tell A Joke" craft rules. Prompts in `./prompts/jackie-martling.ts`.
 * - Fred: five-mode output spec (A SFX drop / B one-clause zinger /
 *   C impression / D silence / E music-mini-riff), verified impressions
 *   catalog, debunk ledger (no 2012 stroke, Echo is a friend's parrot, etc.).
 *   Prompts in `./prompts/fred-norris.ts`.
 * - Baba Booey: **archetype flip** — fact-checker → trolly-heckler. Uses
 *   `Persona.producerMode: "heckler"` to suppress the tier-gate scaffolding
 *   in `buildPersonaContext` and reframe search as background facts.
 *   Prompts in `./prompts/baba-booey.ts`.
 * - The Troll: **most ambitious archetype flip** — single "Cynical
 *   Commentator" voice → 7-sub-voice composite Wack Pack voice board
 *   (Janks / Stuttering John / High Pitch Erik / Beetlejuice / Eric the
 *   Actor / Hank / Sal & Richard). Kernel was synthesized from two
 *   author-delivered research files (meta-summary + gap-fill addendum);
 *   the author's explicit "300-word production kernel" was referenced
 *   but not directly shared. Prompts in `./prompts/the-troll.ts`.
 *
 * This file owns the CONTENT (4 persona system prompts). The Persona type and
 * the shared context builder live in `lib/personas.ts` so packs stay purely
 * content-first.
 */

import type { Persona } from "../../personas";
import { JACKIE_KERNEL, JACKIE_REFERENCE } from "./prompts/jackie-martling";
import { FRED_KERNEL, FRED_REFERENCE } from "./prompts/fred-norris";
import { BABA_KERNEL, BABA_REFERENCE } from "./prompts/baba-booey";
import { THE_TROLL_KERNEL, THE_TROLL_REFERENCE } from "./prompts/the-troll";

export const howardPersonas: Persona[] = [
  // ─────────────────────────────────────────────────────────
  // 1. THE HECKLER — Gary Dell'Abate ("Baba Booey")
  //
  // v1.8 persona-refinement push: Baba is the fourth persona landed
  // from the deep-research plan, and the first with an ARCHETYPE
  // shift inside its pack slot. The pre-v1.8 Baba was a classical
  // fact-checker with [FACT CHECK] / [CONTEXT] / [HEADS UP] /
  // [CALLBACK] tier output. The v1.8 kernel repositions him as a
  // TROLLY HECKLER — 1-2 sentence Mets-fan-at-the-TV reactions
  // ("Oh come ON", "heh heh heh… unbelievable", "no no no, that
  // peaked at number THREE"). He's still the producer slot — the UI
  // pre-animation + "-" safety net + pack routing are all load-
  // bearing on that — but his voice output is no longer tier-tagged.
  // The kernel + reference live in `./prompts/baba-booey.ts`. The
  // prose is treated as truth — do not rewrite voice rules, the
  // trolly-heckler framing, the red-lines block, or the relational-
  // dynamics tables without Seth's explicit ask.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Archetype flipped from fact-checker to trolly-heckler. No
  //     more [FACT CHECK] / [HEADS UP] tiers; output is 1-2 sentence
  //     exasperated heckles in Gary's voice.
  //   - Grounded in 41+ years of Stern history (hiring 1984, nickname
  //     coined July 26, 1990, Love Tape 1999, 2009 first pitch, Baba
  //     Bigshot 2017, 2018 Bawf, 2025 new-teeth shoot) with a
  //     verification ledger — persona won't fabricate.
  //   - Sacred-ground table explicit: brother Steven (AIDS 1991),
  //     father Salvatore (2006), mother Ellen (depression, non-
  //     blaming), Ralph Cirella (Dec 2023), Robin's ongoing cancer,
  //     Artie's November 2025 death.
  //   - Eye-roll-pivot register (vs. Artie-style escalation):
  //     observation → dismissive tic ("listen…", "hold on…") →
  //     redirect to logistics, charity, or a career data point.
  //   - No profanity (clean straight-man producer of a filthy show).
  //   - Recent 2020-2026 canon wired in: NYSE bell curse, Don Lemon
  //     mix-up, Tom Brady Roast afterparty, bagel alerts, 2025 new-
  //     teeth shoot.
  //
  // SCAFFOLDING CHANGE — persona.producerMode = "trolly-fact-checker".
  // 2026-04-23 fact-check-layer methodology — Baba keeps the v1.8
  // trolly-heckler voice contract but re-acquires fact-checking as
  // his core deliverable via the CONFIRMS / CONTRADICTS / COMPLICATES
  // / THIN tier taxonomy baked into BABA_KERNEL. The methodology is
  // persona-agnostic and documented in `docs/FACT-CHECK-LAYER.md`
  // for future reuse (Molly, a future pack's fact-checker, etc.).
  //
  // `buildPersonaContext` reads this flag and:
  //   - uses the default `SEARCH RESULTS (use for fact-checking)`
  //     framing — the kernel patch explicitly tells Baba to read
  //     SEARCH RESULTS before speaking, so label match matters.
  //   - **skips** the legacy EVIDENCE: GREEN / THIN / NONE tier-gate
  //     injection (which prescribes obsolete [FACT CHECK] / [HEADS UP]
  //     tags; the kernel's four-tier taxonomy supersedes them, and
  //     leaving the gate active would inject contradictory tag
  //     prescriptions).
  //   - leaves the pre-animation + "-" safety net intact (UI
  //     contract, not voice contract).
  // See `lib/personas.ts` for the full producerMode docs and
  // `docs/FACT-CHECK-LAYER.md` for the methodology.
  //
  // factCheckMode stays "loose" — vestigial from pre-v1.8 but still
  // consumed by the Director's rule-scorer to tune claim-detector
  // sensitivity. Dense claims + name-drops + predictions still
  // correctly correlate with heckle triggers (chart corrections,
  // Baba-Bigshot moments), so the existing math applies.
  //
  // Integration with Director + ensemble is unchanged: directorHint
  // (rewritten for heckle triggers) feeds the v3 routing call,
  // cascades still inject other personas' last lines, Director still
  // owns WHEN Baba speaks. Kernel + reference shape HOW he heckles
  // once picked — per DESIGN-PRINCIPLES rule 3a ("Persona prompts
  // are the lever, not the Director").
  //
  // Model: Claude Haiku (Gary's voice needs nuance + timing on the
  // eye-roll pivot; Haiku's comedic register is the right fit).
  // ─────────────────────────────────────────────────────────
  {
    id: "producer",
    name: "Baba Booey",
    role: "The Fact-Checker",
    emoji: "🎯",
    color: "#3b82f6",
    model: "claude-haiku",
    // Retained for Director's claim-detector sensitivity — dense
    // claims / name-drops / predictions are high-value fact-check
    // triggers AND heckle triggers, so "loose" stays semantically
    // correct under the trolly-fact-checker archetype.
    factCheckMode: "loose",
    // 2026-04-23 fact-check-layer: Baba is the voice of fact-check
    // in the Howard pack again, but in trolly-EP register. See
    // `docs/FACT-CHECK-LAYER.md` for the full methodology. Scaffolding
    // contract is: default SEARCH RESULTS framing, NO legacy
    // EVIDENCE-gate tag prescriptions (the kernel's tier taxonomy
    // owns that now).
    producerMode: "trolly-fact-checker",
    directorHint:
      "Trolly EP who fact-checks like a producer at the booth, not an anchor at the desk — 'no no no, Gross sold that in 2019, not 2021' / 'yeah technically, he's leaving out the part where…' / 'alright, broken clock, he got one right.' Pick when the transcript tail contains a checkable claim: a specific number, date, named entity, valuation, acquisition, chart position, quote, stat, or prediction. Also fair game: dumb takes, absurd news, sports plays, pop-culture corrections, mispronunciations, or name-drops worth Baba-Bigshot-ing. Not the subject — the reactor. Never screams or insults directly; eye-roll-pivot register.",
    systemPrompt: BABA_KERNEL,
    personaReference: BABA_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 2. THE CYNICAL COMMENTATOR — The Troll (composite Wack Pack voice)
  //
  // v1.8 persona-refinement push: The Troll is the eighth (final)
  // persona landed from the deep-research plan. TWO author-delivered
  // research files landed together: a consolidated-learnings meta-
  // document establishing the operational framework, and a targeted
  // gap-fill addendum with the 80-question Stuttering John catalog +
  // 14-character tier-2 Wack Pack bench. Both merged into
  // `./prompts/the-troll.ts`.
  //
  // SYNTHESIS DISCLOSURE. Unlike the other seven v1.8 landings,
  // The Troll's production kernel was NOT delivered as a single
  // paste-ready artifact — the meta-doc references "the 300-word
  // kernel" as existing elsewhere in a prior research corpus that
  // was not shared. The kernel in the prompts module was
  // synthesized from the two delivered files' operational
  // recommendations and voice profiles, using author-delivered
  // language verbatim wherever possible. Every rule in the kernel
  // is traceable to one of the two source files. If the author-
  // delivered 300-word kernel eventually arrives, swapping in is
  // a one-line change (replace THE_TROLL_KERNEL export).
  //
  // ARCHETYPE SHIFT (v1.8) — MOST AMBITIOUS FLIP IN THE PUSH.
  // The pre-v1.8 Troll was a SINGLE voice ("Cynical Commentator"
  // — brutal honesty of Stern callers meets Artie Lange's cynical
  // observations). The v1.8 kernel is a VOICE BOARD WITH SLIDERS
  // — seven composite Wack Pack sub-voices the model rotates
  // through, one per turn:
  //   1. Captain Janks — bureaucratic PIO deadpan, hijack register
  //   2. Stuttering John — weaponized stammer + landmine question
  //      (from 8-template taxonomy)
  //   3. High Pitch Erik — falsetto screech gimmick
  //   4. Beetlejuice — slurred confident nonsense, repetition-of-3
  //   5. Eric the Actor — nasal grievance spiral, "Bye for now"
  //   6. Hank — Boston-slur brutal-simile one-liner
  //   7. Sal & Richard — earnest-caller prank dyad
  //
  // Per the meta-doc: "The Troll is not a character, he's a
  // rotating cast." This is a more ambitious shift than Lon's
  // (SFX → considered sentence), Baba's (fact-checker → heckler),
  // or Molly's (tier-tagged → journalist) — single voice →
  // rotating-cast composite.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Single Artie-Lange-inspired cynical voice → 7-sub-voice
  //     composite drawn from the full Wack Pack roster (1988-2026).
  //   - Output gains 8 named tactical moves (janks_kicker,
  //     sj_landmine, beetle_non_sequitur, hank_simile,
  //     baba_booey_payload, stern_anatomy_formula,
  //     eric_grievance_spiral, erik_screech) — the director can
  //     theoretically reference these by name (future app work).
  //   - 80-question Stuttering John catalog with 8-template
  //     writers'-room taxonomy (body-function / sexual-innuendo /
  //     mortality-death / money-greed / hypocrisy / insecurity /
  //     family-relationship / failure).
  //   - Howard Stern Anatomy formula as a named generator slot
  //     (highest-ROI single template across 25 years of Janks calls).
  //   - 5-beat prank anatomy compressed for 1-2 sentence Peanut
  //     Gallery turns.
  //   - Stern-doctrine red lines anchored in Stern's OWN public
  //     regrets (1993 blackface, Feb 24 2015 r-word vote, Robin
  //     Williams sledgehammer interview, Aurora-Janks 2012 false-
  //     death-toll precedent, Artie Lange arc). Principled
  //     guardrail stack, not a brittle safety list.
  //   - Target selection as structural heuristic: willing public
  //     performers of power/authority/virtue/glamour, on-camera
  //     voluntarily, capable of retaliating. Never active grief,
  //     minors, cognitively vulnerable people as butts.
  //   - Hard-coded "inability to understand why they're funny"
  //     rule (Stern-doctrine single most leveraged guardrail) —
  //     NO meta, NO wink, NO "just kidding" de-escalation.
  //
  // FUTURE-DIRECTOR HOOK (documented, not built). The meta-doc
  // recommends extending the Director to pass a "register hint"
  // (e.g., `(janks)`, `(beetle)`, `(hank)`) per Troll invocation
  // to bias the voice slider. Kernel degrades gracefully when no
  // hint is present (picks register based on the moment). App-
  // architecture ticket, not a persona-landing blocker.
  //
  // RESEARCH-GAP FLAG. Per the meta-doc's own assessment, this
  // persona is at ~85% of achievable fidelity. The remaining 15%
  // lives in the unshared ~11K-word encyclopedia (full SJ
  // catalog, Stern's 2024-26 material, modern-descendant verbatim,
  // rigorous comedic-craft theory frame, blowback inventory). If
  // voice drifts into generic LLM-comedy mush in practice, that's
  // the signal the encyclopedia is needed. For launch, the kernel
  // + reference carries the composite voices recognizably.
  //
  // SCAFFOLDING UNCHANGED. Troll slot has no producer-specific
  // scaffolding (no evidence gate, no search pipeline). No
  // `producerMode` flag, no gate suppression. Slot id stays
  // "troll" for Director routing; content-only archetype shift.
  //
  // Integration with Director + ensemble is unchanged: directorHint
  // feeds the v3 routing call (rewritten for composite-voice
  // triggers), cascades still inject other personas' last lines,
  // Director still owns WHEN The Troll speaks. Kernel + reference
  // shape HOW he speaks once picked — per DESIGN-PRINCIPLES rule 3a.
  //
  // Model: xAI Grok 4.1 Fast (non-reasoning). The composite-voice
  // archetype demands fast, reflexive, unselfconscious output —
  // reasoning mode would second-guess the sub-voice selection and
  // collapse the Stern-doctrine "inability to understand why
  // they're funny" rule. Grok's native sarcastic lean suits the
  // cynical register. Non-reasoning variant preserves the caller-
  // on-hold-for-20-minutes-with-one-shot energy. Also keeps latency
  // tight on a pack with four voices already firing.
  // ─────────────────────────────────────────────────────────
  {
    id: "troll",
    name: "The Troll",
    role: "Cynical Commentator",
    emoji: "🔥",
    color: "#ef4444",
    model: "xai-grok-4-fast",
    directorHint:
      "Composite Wack Pack voice — 7 sub-voices (Janks bureaucratic deadpan / Stuttering John landmine / High Pitch Erik screech / Beetlejuice confident nonsense / Eric grievance spiral / Hank Boston-slur simile / Sal & Richard earnest-prank). Pick when the transcript has a target from the selection heuristic (willing public performer of power/authority/virtue/glamour, on-camera voluntarily, capable of retaliating) — pundits, politicians in pageantry, tech-CEO visionary talk, apology videos, sports-broadcaster oversell, buzzword soup, name-drops as social collateral. Named tactical moves: janks_kicker, sj_landmine, beetle_non_sequitur, hank_simile, baba_booey_payload, stern_anatomy_formula, eric_grievance_spiral, erik_screech. One sub-voice per turn, no hybrids. Never punches at active grief, minors, cognitively vulnerable, or medical crises.",
    systemPrompt: THE_TROLL_KERNEL,
    personaReference: THE_TROLL_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 3. SOUND EFFECTS / CONTEXT — Fred Norris ("Earth Dog Fred")
  //
  // v1.8 persona-refinement push: Fred is the third persona landed from
  // the deep-research plan (after Jackie in this pack and Alex in the
  // TWiST pack). The kernel + reference now live in
  // `./prompts/fred-norris.ts` and follow the "long-form reference +
  // production prompt kernel at the end" variant of the author's schema.
  // The prose is treated as truth — do not rewrite voice rules, the
  // five-mode output spec, the verification ledger, or red lines without
  // Seth's explicit ask.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Voice is now grounded in ~45 years of Stern history (WCCC 1979 →
  //     WWDC 1981 → WNBC 1982 → K-Rock 1985 → SiriusXM 2006 → present)
  //     plus the verification ledger: debunks the 2012 stroke, the
  //     "Howard Pack" alter-ego label, the Bandcamp fan project, the
  //     "Silver Nickels" authorship myth, etc. Persona will NOT fabricate
  //     these.
  //   - Output is now five explicit modes with percentage targets: A SFX
  //     drop (55–65%) | B one-clause zinger under 15 words (15–20%) |
  //     C impression landing [as Nixon] "..." (5–10%) | D [silence]
  //     (5–10%) | E music/motorcycle/old-TV mini-riff (<10%). One mode
  //     per turn, no hybrids. Matches the author's turn-function spec.
  //   - Impressions catalog is now first-class (Nixon, Kurt Waldheim Jr.,
  //     Ham Hands Bill, Herman Munster, Jackie cackle, Gary lisp, Ronnie
  //     bark, Sal wet-mouth, Stuttering John, Buckley, Imus, Sinatra,
  //     Arnold, Elvis, Larry King, Dice Clay, Jagger, Takei, Tom Christy,
  //     Dwight Gooden). Unverified fan-lore impressions explicitly NOT
  //     volunteered.
  //   - Trolly-edge calibration: hard on pundits / politician pageantry /
  //     tech-CEO visionary talk / apology videos / sports-broadcaster
  //     oversell; never on Howard, children, active grief, or cast
  //     sentimental moments. Edge lives in character voices (Waldheim Jr.,
  //     Munster) rather than direct cruelty.
  //   - Red lines now explicit and researched: Allison, Tess (one 's'),
  //     Long Island home, health (no stroke), religion, politics-as-
  //     policy, Artie's addiction, Jackie personally post-2001, Robin's
  //     2013 cancer, Ben Stern's 2022 death, Wack Packer deaths, Ray
  //     Stern (still alive — do not reference her death).
  //
  // Output-format note: this kernel emits literal `[SFX: <drop>]`,
  // `[as <character>] "..."`, and `[silence]` stage directions. The
  // existing side-panel UI renders bracketed text as-is, same as the
  // pre-v1.8 `[record scratch]` drops. `[silence]` rendering as a
  // visible stage direction is intentional per the author-delivered spec
  // — a visible quiet beat is often the joke. Bare "-" passes remain
  // available for the director-driven soundfx path (per
  // DESIGN-PRINCIPLES rule 1, the UI does not pre-animate Fred, so a
  // silent pass is invisible, while `[silence]` is visible — two
  // different tools for two different moments).
  //
  // Integration with Director + ensemble is unchanged: directorHint still
  // feeds the v3 routing call, cascades still inject "other personas'
  // last line" via buildPersonaContext, Director still owns WHEN Fred
  // speaks. Kernel + reference shape HOW he speaks once picked — per
  // DESIGN-PRINCIPLES rule 3a ("Persona prompts are the lever, not the
  // Director").
  //
  // Model: xAI Grok 4.1 Fast non-reasoning. Drops have to hit INSTANTLY;
  // reasoning mode would second-guess the mode-selection and kill the
  // timing. The non-reasoning variant is built for reflexive, punchy
  // output — exactly Fred's whole voice.
  // ─────────────────────────────────────────────────────────
  {
    id: "soundfx",
    name: "Fred",
    role: "Sound Effects & Context",
    emoji: "🎧",
    color: "#a855f7",
    model: "xai-grok-4-fast",
    directorHint:
      "Bone-dry SFX + one-liner man (Howard's screen is still up). Five modes: SFX drop | one-clause zinger under 15 words | impression landing ([as Nixon/Waldheim Jr./Buckley/Munster] \"...\") | [silence] | music/motorcycle/old-TV mini-riff. Pick on pundit emoting, politician pageantry, tech-CEO visionary talk, celebrity crying / apology videos, sports-broadcaster oversell, confidently wrong claims, or awkward silence. Trolly edge lives in character voices — never direct cast attacks.",
    systemPrompt: FRED_KERNEL,
    personaReference: FRED_REFERENCE,
  },

  // ─────────────────────────────────────────────────────────
  // 4. THE COMEDY WRITER — Jackie "The Joke Man" Martling
  //
  // v1.8 persona-refinement push: Jackie is the first persona landed from
  // the deep-research plan in docs/PERSONA-REFINEMENT-PLAN.md. The kernel
  // + reference now live in `./prompts/jackie-martling.ts` and follow the
  // canonical persona-file schema (kernel = paste-ready system prompt,
  // reference = examples + voice detail + craft rules + topic buckets +
  // relational dynamics + red lines + recovery library + interjection
  // shape + verbatim joke bank + identity anchors). The author-delivered
  // prose is treated as truth — do not rewrite voice rules, the laugh
  // spec, or red lines without Seth's explicit ask.
  //
  // What changed from the pre-v1.8 prompt:
  //   - Voice is now grounded in the actual 1986-2001 Stern-note template,
  //     the 1999 fan-chat pattern, and his own "How To Tell A Joke" craft
  //     rules — not a hand-crafted approximation.
  //   - "hehehe" is mandatory and specified (pre-sell, not reaction).
  //   - Every joke present tense, no broken dialogue, no adjectives unless
  //     distinguishing characters.
  //   - 85/10/5 trigger behavior (fire / plug-or-heckle-self / pass with
  //     self-deprecation) replaces the generic "one-liner machine" brief.
  //   - Explicit red lines on Nancy, Bobby, Jimmy, 2001 departure, Artie's
  //     addiction, and the hardest ethnic/disability material.
  //
  // Integration with Director + ensemble is unchanged: directorHint still
  // feeds the v3 routing call, cascades still inject "other personas' last
  // line" via buildPersonaContext, Director still owns WHEN Jackie speaks.
  // The kernel shapes HOW he speaks once picked — per DESIGN-PRINCIPLES
  // rule 3a ("Persona prompts are the lever, not the Director").
  //
  // Model: Claude Haiku (humor requires nuance, misdirection, and timing)
  // ─────────────────────────────────────────────────────────
  {
    id: "joker",
    name: "Jackie",
    role: "The Joke Man",
    emoji: "😂",
    color: "#f59e0b",
    model: "claude-haiku",
    directorHint:
      "Rapid-fire dirty one-liners + puns with signature 'hehehe' pre-sell laugh. Pick when the transcript hits a concrete noun (bar, doctor, marriage, body part, boss, cop, drink, dog, phone, car) — he category-matches to a stock joke. Also pick on straight-man setups or absurdity begging for a punchline. Pass on earnest commentary, political takes, or long personal storytelling.",
    systemPrompt: JACKIE_KERNEL,
    personaReference: JACKIE_REFERENCE,
  },
];
