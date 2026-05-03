/**
 * Peanut Gallery — Smart Director v3 (experimental, behind flag)
 *
 * A parallel implementation of the routing brain that addresses the five
 * failure modes identified in the 2026-04 research brief. Ships ALONGSIDE
 * `./director-llm.ts` (v2) so we can shadow-test and fail back cleanly.
 *
 * What's different from v2:
 *
 *   1. SILENT is a first-class 5th slot, not a fallback. Returning silent
 *      is a real pick with its own few-shots. (Kadavath et al. 2022;
 *      Feng et al. 2024: "None of the Above" as a fallback harms
 *      calibration — make abstention a positive choice.)
 *
 *   2. Output is constrained by Anthropic tool_use (strict JSON schema
 *      enum). The model cannot return a persona id outside the 5 valid
 *      slots. No free-text parsing, no "extract first JSON object"
 *      regex hacks.
 *
 *   3. Per-call random ordering of personas in the prompt + per-call
 *      random ordering of SILENT position. Kills position bias
 *      (Wang et al. 2023: flipped 66/80 pairwise outcomes by swapping
 *      option order).
 *
 *   4. The model returns a verbalized confidence distribution across
 *      all 5 slots (Tian et al. 2023: verbalized beats token-logit
 *      confidence, ~50% ECE reduction). The Director applies an
 *      external sticky-agent penalty to previous speakers BEFORE
 *      argmax, so recency bias is handled deterministically — not
 *      begged for in the prompt.
 *
 *   5. The prompt optionally surfaces a ring buffer of "live callback
 *      candidates" — notable phrases from the last 3-5 minutes. The
 *      model is rewarded for heightening them (Del Close / UCB Manual:
 *      callbacks are the improv Harold's payoff beat). The ring buffer
 *      lives in the Director; this file only threads it through.
 *
 *   6. Contract is still `pickPersonaLLMv2(ctx) => Promise<Pick | null>`.
 *      NEVER throws. On timeout, upstream error, or malformed tool use,
 *      returns null and the caller falls back to the rule-based scorer.
 *
 * Latency note: Haiku tool_use adds a small overhead (~30-60ms per call
 * over free-text JSON) but removes an entire class of parse failures.
 * The 400ms budget still holds on the happy path. Moving off Haiku to
 * a sub-200ms provider (Groq Llama 3.1 8B) is tracked as a separate
 * experiment — not in this file.
 */

import Anthropic from "@anthropic-ai/sdk";

import { logPipeline } from "./debug-logger";
import type { Persona } from "./personas";

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

/**
 * v3: 5 slots. "silent" is a positive pick — the routing brain actively
 * chose to not fire anyone. Downstream, `Director.decide` skips the
 * cascade roll on a silent pick and returns an empty chain.
 */
export type ArchetypeIdV2 =
  | "producer"
  | "troll"
  | "soundfx"
  | "joker"
  | "silent";

export const VALID_ARCHETYPE_IDS_V2: readonly ArchetypeIdV2[] = [
  "producer",
  "troll",
  "soundfx",
  "joker",
  "silent",
] as const;

export interface ConfidenceVectorV2 {
  producer: number;
  troll: number;
  soundfx: number;
  joker: number;
  silent: number;
}

export interface LlmRoutingPickV2 {
  /** Argmax of the verbalized confidence vector. Always a valid slot id. */
  personaId: ArchetypeIdV2;
  /**
   * Verbalized confidence across all 5 slots. Expected to roughly sum
   * to 1 but we don't hard-reject on drift — we re-normalize before
   * passing to the Director so downstream penalties see a clean
   * distribution.
   */
  confidence: ConfidenceVectorV2;
  /** One-sentence rationale. Flows into TriggerDecision.reason. */
  rationale: string;
  /**
   * If the model recognized a live callback candidate and the picked
   * persona intends to heighten it, the phrase snippet goes here. This
   * is UI telemetry — it does NOT cause the persona response to
   * actually reference the callback (that's the persona's job). null
   * when no callback was surfaced or used.
   */
  callbackUsed: string | null;
}

export interface PickPersonaCtxV2 {
  /** Recent transcript window — same slice the rule-based Director sees. */
  recentTranscript: string;
  /** Whether this tick is a silence tick (no new transcript since last). */
  isSilence: boolean;
  /** Ordered list of recently-fired persona ids (oldest first). */
  recentFirings: string[];
  /** ms since last fire per persona. Used by the LLM to value dry spells. */
  cooldownsMs: Record<string, number>;
  /** Pack personas — lets the LLM see names + roles + hints. */
  packPersonas: Persona[];
  /**
   * Ring buffer of notable phrases from the last 3-5 minutes. The LLM
   * is encouraged to pick a persona that can heighten / riff on one.
   * Up to 3 surfaced to the model; more are silently ignored.
   */
  liveCallbacks?: string[];
  /**
   * v1.7 (SET-7): number of characters at the tail of `recentTranscript`
   * that are NEW since the previous Director tick. Flagged as
   * "tentative" in the prompt so the router can downweight signals
   * found only in the brand-new tail — the #1 TRP-misfire pattern is
   * reacting to a half-formed claim the speaker is still finishing.
   *
   * The caller computes this via `computeUnstableTailLen(current,
   * previous)` and passes the session's prior tick's recentTranscript.
   * 0 means "everything is stable" (common on recorded streams where
   * final chunks arrive atomically); the tail rule then adds no
   * pressure. The router's behaviour is backward-compatible when the
   * field is omitted.
   */
  unstableTailLen?: number;
  /** Anthropic API key. */
  anthropicKey: string;
  /** AbortSignal — caller races this against a 400ms timeout. */
  signal?: AbortSignal;
  /** Optional session id for log correlation. */
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// ROUTING PROMPT
// ──────────────────────────────────────────────────────

export const ROUTING_SYSTEM_PROMPT_V2 = `You are the ROUTING BRAIN for Peanut Gallery, an AI writers' room that reacts to live podcast audio in real time.

Your job: pick ONE of FIVE options for this tick — four personas, or SILENT. You are NOT writing dialogue. A separate LLM does that once you pick.

The four persona archetype slots (fixed across packs — route by SLOT, not by named voice):
  - "producer": the fact-checker. Lights up on claims, numbers, founding years, valuations, anything verifiable.
  - "troll": the cynical commentator. Lights up on hype, buzzwords, name-drops, self-promotion, confident opinions.
  - "soundfx": the mood-shift / reframe persona. Lights up on awkward moments, surprising news, topic changes, deadpan asides.
  - "joker": the comedy writer. Lights up on absurdity, comparison setups, ironic contrasts, easy jokes.

AND — equally valid, often the correct pick:
  - "silent": NOBODY speaks this tick. This is the right call when:
      · The transcript ends mid-clause / mid-thought ("because…", "so…", "if…")
      · The host is mid-disfluency or self-correction ("um", "uh", "let me rephrase")
      · The tail is a backchannel invitation the speaker is about to answer themselves ("right?", "you know?")
      · Another participant was just directly addressed ("Molly, what do you think?")
      · The cast just landed a punchline — give it 1-3 beats to breathe
      · The current chunk is a content-free restart, repetition, or filler
      · There's no claim, joke, hype, or mood-shift worth reacting to yet
  SILENT is not "we don't know" — it's a positive, skilled pick. A real writers' room stays quiet often. False-positive firing is the #1 failure mode of LLM reactors; picking SILENT when warranted is how we stand out.

ROUTING RULES:
  1. Pick the slot whose specialty best fits the content. If nothing fits and there's no moment, pick SILENT.
  2. DO NOT use recent-firings or cooldowns to penalize — an external sticky-agent penalty is applied to your confidences after you respond. Report your honest specialty match, not your guess at what the orchestrator wants. This matters: the orchestrator cannot recover from you under-reporting an obvious match just because that persona spoke a moment ago.
  3. If a LIVE CALLBACK is listed and a persona can legitimately heighten it (reuse, riff on, or invert the phrase), prefer that persona — and set callbackUsed to the exact phrase snippet.
  4. Report confidence across ALL 5 slots as a distribution that sums to approximately 1.0.

Respond by calling the \`pick_next_speaker\` tool exactly once with your decision. The tool enforces the 5-slot enum.`;

// ──────────────────────────────────────────────────────
// CACHED STABLE PREFIX — v3
// ──────────────────────────────────────────────────────
//
// Haiku's prompt-cache minimum is 2,048 tokens. The system prompt above is
// ~400 tokens; the tool definition is ~200. Padding the system block past
// the threshold with stable content (persona catalog + few-shots covering
// all 5 slots, including SILENT) unlocks the ~85 % TTFT / ~90 % cost
// reduction on cache hits. Load-bearing for the 400 ms routing budget.
//
// MUST stay stable across ticks within a session (or else cache invalidates).
// Dynamic content (transcript / firings / cooldowns / callback candidates)
// stays in the user message, NOT here.
//
// Designed to pair with `cache_control: { type: "ephemeral" }` on the
// system block + tools array in `pickPersonaLLMv2`.
const CACHED_V3_EXTENDED_PREFIX = `

---

## COMPLETE PERSONA CATALOG

Both Peanut Gallery packs use the same five slots (four personas plus SILENT).

### Morning Crew Pack
slot: producer — The Producer (Fact-Checker): compulsive corrector on dates / dollar figures / founding years. Pick on specific verifiable claims.
slot: troll    — The Heckler (Cynical Commentator): puncture hype, valuation math, buzzword soup, name-drops. Pick on specific hype-cycle bait.
slot: soundfx  — The Sound Guy (SFX & Context): drops bracketed sound cues as editorial commentary. Pick on mood shifts, awkward pauses, confident-but-wrong beats.
slot: joker    — The Joke Writer (Comedy Writer): rapid-fire one-liners, misdirection, rule of three, callbacks. Pick on absurdity or clean comic setups.

### TWiST Pack
slot: producer — Molly (Fact-Checker): veteran tech journalist; cites own reporting. Pick on verifiable funding / timeline / startup-history claims.
slot: troll    — Jason (Provocateur): TWiST host energy; loud, founder-protective, brutal on hype cycles. Pick on bold claims + founder-market-fit moments.
slot: soundfx  — Lon (Reframe): dry pop-culture reframes + sound cues ("this is WeWork energy"). Pick on mood shifts + cultural analogies.
slot: joker    — Alex (Data Comedian): numbers-as-punchline, cap-table burns, hype-cycle comps. Pick on specific numbers / valuations / unit economics.

---

## FEW-SHOT ROUTING EXAMPLES

Each example shows a transcript + correct pick. Load-bearing: all 5 slots appear, including multiple SILENT examples (the #1 failure mode of LLM reactors is false-positive firing — SILENT must be a live choice, not a fallback).

### Example 1 — Hard numerical claim → producer
TRANSCRIPT: "They raised \\$47 million at a \\$500 million valuation."
SILENCE: false
CORRECT: {"personaId":"producer","rationale":"Specific dollar figures are the producer's core trigger."}

### Example 2 — Buzzword soup with no substance → troll
TRANSCRIPT: "We're building an AI-native vertical SaaS platform that disrupts the entire enterprise ecosystem."
SILENCE: false
CORRECT: {"personaId":"troll","rationale":"Dense buzzword soup with zero concrete claims — troll specialty."}

### Example 3 — Host mid-disfluency → SILENT (no restart interruption)
TRANSCRIPT: "Yeah so the valuation was, uh, let me rephrase that — the thing about the Series B is that —"
SILENCE: false
CORRECT: {"personaId":"silent","rationale":"Mid-disfluency restart; no complete clause to react to yet."}

### Example 4 — Tag-question backchannel invite → SILENT (let host land their thought)
TRANSCRIPT: "And so the whole funding thing just fell apart, you know what I mean?"
SILENCE: false
CORRECT: {"personaId":"silent","rationale":"Backchannel-inviting tag question; host expects to answer their own thought."}

### Example 5 — Absurd triple claim → joker
TRANSCRIPT: "Their AI can write better code than most junior engineers, cure cancer, and also make a perfect cappuccino."
SILENCE: false
CORRECT: {"personaId":"joker","rationale":"Triple claim is a rule-of-three setup — joker's technique."}

### Example 6 — Host directly addressed another participant → SILENT (let the human answer)
TRANSCRIPT: "Jason pitched the whole AstroForge thing for ten minutes straight. Molly, what do you think about the market sizing?"
SILENCE: false
CORRECT: {"personaId":"silent","rationale":"Host directly addressed Molly by name — human should speak next."}

### Example 7 — Awkward on-air stumble → soundfx
TRANSCRIPT: "And then... sorry, I lost my train of thought."
SILENCE: false
CORRECT: {"personaId":"soundfx","rationale":"On-air stumble is a mood-shift moment — a timed sound cue lands it."}

### Example 8 — Pure silence tick → soundfx
TRANSCRIPT: ""
SILENCE: true
CORRECT: {"personaId":"soundfx","rationale":"Silence tick; soundfx fits dead air better than joker without a premise."}

### Example 9 — Cap-table number (TWiST pack) → joker (data-comedy lane)
TRANSCRIPT: "The founders retained 8% combined going into their Series B."
SILENCE: false
CORRECT: {"personaId":"joker","rationale":"Specific cap-table number is a data-comedy setup — joker owns it in TWiST."}

### Example 10 — Speculative opinion, producer passes → joker
TRANSCRIPT: "I believe AI will be smarter than humans within five years."
SILENCE: false
CORRECT: {"personaId":"joker","rationale":"Speculative prediction is not a verifiable fact — joker heightens."}

### Example 11 — Minimal filler, nothing to react to → SILENT
TRANSCRIPT: "Yeah, exactly."
SILENCE: false
CORRECT: {"personaId":"silent","rationale":"Trivial agreement filler; no content worth reacting to."}

### Example 12 — Dominant hype-bubble trigger → troll (even if they just fired)
TRANSCRIPT: "The company's revenue was \\$4 million — \\$4 MILLION — yet they raised at a \\$2 BILLION valuation. Five-hundred-times revenue!"
SILENCE: false
CORRECT: {"personaId":"troll","rationale":"500x revenue multiple is unambiguously dominant troll territory."}

### Example 13 — Dramatic workplace fact → soundfx
TRANSCRIPT: "They had 12 employees. They all quit on the same day."
SILENCE: false
CORRECT: {"personaId":"soundfx","rationale":"Dramatic fact landing cold wants a [sad trombone] beat, not a fact-check."}

### Example 14 — Pure content-free restart → SILENT
TRANSCRIPT: "so, so, um, so the thing I want to say is, hold on —"
SILENCE: false
CORRECT: {"personaId":"silent","rationale":"Repetitions and restarts; nothing to react to yet."}

### Example 15 — Year + audible uncertainty → producer
TRANSCRIPT: "Facebook was founded in 2005, I think."
SILENCE: false
CORRECT: {"personaId":"producer","rationale":"Verifiable year with flagged uncertainty — correction is the win."}

---

## ROUTING DECISION FRAMEWORK

Evaluate these signals in order:

1. CONTENT CLASS
   - Hard verifiable claim (number / date / statistic) → producer
   - Hype / buzzwords / confident-but-soft claim      → troll
   - Mood shift / awkward pause / emotional beat       → soundfx
   - Absurdity / comic premise / comparison setup      → joker
   - None of the above applies this tick              → silent
   - Silence tick (no new transcript)                   → prefer soundfx or joker

2. WHEN TO PREFER SILENT
   - Mid-clause / mid-thought tail ("because…", "so…", "if…")
   - Disfluency, restart, repetition ("um", "uh", "let me rephrase")
   - Backchannel-inviting tag question ("right?", "you know?")
   - Another participant directly addressed by name
   - Post-punchline moment (1–3 beats to breathe)
   - Content-free filler agreement ("Yeah, exactly.")
   - The only potentially-reactable signal lives inside a "[[ UNSTABLE TAIL ]]" marker. That text has been in the transcript for exactly one tick — the speaker may finish it differently, or the ASR may revise it, or they may immediately self-correct. If removing the unstable tail leaves no signal worth reacting to, prefer SILENT and let the next tick confirm.

3. CONFIDENCE
   Report HONEST specialty match across all 5 slots. Do NOT self-penalize recent speakers — an external sticky-agent penalty handles that deterministically after your response.

4. CALLBACK
   If a LIVE CALLBACK is listed and a persona can legitimately reuse / invert / heighten the phrase, prefer that persona and set callbackUsed to the exact snippet.

5. OUTPUT
   Call pick_next_speaker with: personaId ∈ {producer, troll, soundfx, joker, silent}, confidence (object summing to ~1.0 across all 5), one-sentence rationale, callbackUsed (exact snippet or null).
`;

/**
 * Full cached stable prefix: the routing system prompt + extended catalog
 * + few-shots + decision framework. Padded past the 2,048-token Haiku cache
 * minimum so ephemeral caching actually fires. Composed once at load time.
 *
 * Sized for ~2,200 tokens in the combined block; stays comfortably above
 * the cache threshold even if future edits trim a few examples.
 */
export const CACHED_ROUTING_STABLE_PREFIX_V2 =
  ROUTING_SYSTEM_PROMPT_V2 + CACHED_V3_EXTENDED_PREFIX;

/**
 * Subset of PickPersonaCtxV2 that contains only the fields needed to build
 * the routing user prompt. Shadow providers (Cerebras, Groq) construct this
 * directly so they don't need to carry anthropicKey / signal / sessionId.
 */
export interface RoutingPromptCtxV2 {
  recentTranscript: string;
  isSilence: boolean;
  recentFirings: string[];
  cooldownsMs: Record<string, number>;
  packPersonas: Persona[];
  liveCallbacks?: string[];
  /**
   * v1.7 (SET-7): number of tail chars in `recentTranscript` that are
   * new since the previous tick. Rendered visually in the prompt as a
   * `[[ UNSTABLE TAIL ]]` marker so the router can treat those tokens as
   * tentative. See PickPersonaCtxV2.unstableTailLen for context.
   */
  unstableTailLen?: number;
}

/**
 * v1.7 (SET-7): compute how many characters of `current` are NEW since
 * `previous`. The implementation finds the longest suffix of `previous`
 * that's also a prefix of `current` — a sliding-window friendly model
 * that handles Deepgram's growing final-text windows correctly even when
 * the Director's slice(-500) clips the earlier history.
 *
 * Returns 0 when current is fully contained in previous (transcript went
 * quiet); returns current.length when there's no overlap (first tick, or
 * the ASR threw away its hypothesis). O((min(n,m))^2) worst-case char
 * comparison, which for <=500-char windows is ~sub-millisecond.
 */
export function computeUnstableTailLen(current: string, previous: string): number {
  if (!current) return 0;
  if (!previous) return current.length;
  const maxOverlap = Math.min(current.length, previous.length);
  for (let k = maxOverlap; k > 0; k--) {
    const suf = previous.slice(previous.length - k);
    if (current.startsWith(suf)) {
      return current.length - k;
    }
  }
  return current.length;
}

function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildRoutingUserPromptV2(ctx: RoutingPromptCtxV2): string {
  const lines: string[] = [];

  // v1.7 (SET-7): split the transcript into stable + unstable-tail
  // visually. The router is told to treat the tail as tentative. Cap the
  // visible tail at 200 chars — longer tails are almost always the
  // speaker still forming a long sentence, and the marker noise past 200
  // chars would start drowning out the stable content.
  const sliced = ctx.recentTranscript.slice(-600);
  const tailLen = Math.max(0, Math.min(ctx.unstableTailLen ?? 0, 200, sliced.length));
  const stableEnd = sliced.length - tailLen;
  lines.push(`RECENT TRANSCRIPT (silence=${ctx.isSilence}):`);
  if (!sliced) {
    lines.push("(none — silence tick)");
  } else if (tailLen === 0) {
    lines.push(sliced);
  } else {
    lines.push(sliced.slice(0, stableEnd) + "[[ UNSTABLE TAIL: " + sliced.slice(stableEnd) + " ]]");
  }
  lines.push("");

  if (ctx.recentFirings.length > 0) {
    lines.push(`RECENT FIRINGS (oldest → newest): ${ctx.recentFirings.join(" → ")}`);
  } else {
    lines.push(`RECENT FIRINGS: (none — session just started)`);
  }
  lines.push("");

  lines.push("COOLDOWNS (ms since last fire):");
  // Shuffled display order — kills position bias on cooldown readouts.
  for (const id of shuffled(["producer", "troll", "soundfx", "joker"])) {
    const ms = ctx.cooldownsMs[id] ?? 0;
    lines.push(`  ${id}: ${Math.round(ms)}ms`);
  }
  lines.push("");

  // Shuffle per-call so the same slot doesn't always appear first in the roster.
  // Wang et al. 2023: option order flips pairwise outcomes 66/80 times.
  const shuffledPersonas = shuffled(ctx.packPersonas);
  lines.push("PACK VOICES (order is randomized — do not read positional meaning into this list):");
  for (const p of shuffledPersonas) {
    lines.push(`  ${p.id}: ${p.name} — ${p.role}`);
    if (p.directorHint && p.directorHint.trim().length > 0) {
      lines.push(`    hint: ${p.directorHint.trim()}`);
    }
  }
  lines.push("");

  if (ctx.liveCallbacks && ctx.liveCallbacks.length > 0) {
    lines.push("LIVE CALLBACK CANDIDATES (notable phrases from the last few minutes):");
    for (const c of ctx.liveCallbacks.slice(0, 3)) {
      lines.push(`  · "${c}"`);
    }
    lines.push(
      "If a persona can legitimately heighten one of these, prefer that persona and set callbackUsed."
    );
    lines.push("");
  }

  lines.push(
    "Call pick_next_speaker with personaId (one of producer, troll, soundfx, joker, silent), a confidence object covering ALL FIVE slots, a one-sentence rationale, and callbackUsed (the exact snippet or null)."
  );

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────
// TOOL SCHEMA
// ──────────────────────────────────────────────────────

/**
 * Shared JSON schema for the v3 pick output. Exported so Cerebras / Groq
 * shadow modules (which use OpenAI-compatible `response_format: json_schema`)
 * can validate against the identical structure — single source of truth for
 * the 5-slot enum + confidence vector shape.
 */
export const PICK_NEXT_SPEAKER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    personaId: {
      type: "string",
      enum: ["producer", "troll", "soundfx", "joker", "silent"],
      description: "The archetype slot that speaks next, or 'silent' for nobody.",
    },
    confidence: {
      type: "object",
      description:
        "Verbalized confidence across all 5 slots. Should sum to approximately 1.0.",
      properties: {
        producer: { type: "number", minimum: 0, maximum: 1 },
        troll: { type: "number", minimum: 0, maximum: 1 },
        soundfx: { type: "number", minimum: 0, maximum: 1 },
        joker: { type: "number", minimum: 0, maximum: 1 },
        silent: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["producer", "troll", "soundfx", "joker", "silent"],
    },
    rationale: {
      type: "string",
      description: "One short sentence explaining the pick.",
    },
    callbackUsed: {
      type: ["string", "null"],
      description:
        "Exact phrase from LIVE CALLBACK CANDIDATES that the picked persona will heighten, or null if none.",
    },
  },
  required: ["personaId", "confidence", "rationale", "callbackUsed"],
} as const;

// Anthropic tool_use tool definition. The `enum` on personaId is the
// hard guarantee — the model cannot return an invalid slot id.
const PICK_NEXT_SPEAKER_TOOL: Anthropic.Tool = {
  name: "pick_next_speaker",
  description:
    "Decide who speaks next in the Peanut Gallery writers' room, or choose SILENT for no one.",
  // Cast: the shared schema is `as const`-frozen for JSON-Schema consumers;
  // Anthropic's Tool type expects a mutable InputSchema. The structural
  // contents are identical — only the readonly-ness differs.
  input_schema: PICK_NEXT_SPEAKER_INPUT_SCHEMA as unknown as Anthropic.Tool["input_schema"],
};

// ──────────────────────────────────────────────────────
// VALIDATION
// ──────────────────────────────────────────────────────

function coerceNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }
  return 0;
}

function normalizeConfidence(raw: unknown): ConfidenceVectorV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const vec: ConfidenceVectorV2 = {
    producer: coerceNumber(obj.producer),
    troll: coerceNumber(obj.troll),
    soundfx: coerceNumber(obj.soundfx),
    joker: coerceNumber(obj.joker),
    silent: coerceNumber(obj.silent),
  };

  const sum =
    vec.producer + vec.troll + vec.soundfx + vec.joker + vec.silent;
  if (sum <= 0) return null;

  return {
    producer: vec.producer / sum,
    troll: vec.troll / sum,
    soundfx: vec.soundfx / sum,
    joker: vec.joker / sum,
    silent: vec.silent / sum,
  };
}

export function validatePickV2(raw: unknown): LlmRoutingPickV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const id = obj.personaId;
  if (typeof id !== "string") return null;
  if (!VALID_ARCHETYPE_IDS_V2.includes(id as ArchetypeIdV2)) return null;

  const confidence = normalizeConfidence(obj.confidence);
  if (!confidence) return null;

  const rationaleRaw = obj.rationale;
  const rationaleStr =
    typeof rationaleRaw === "string" && rationaleRaw.trim().length > 0
      ? rationaleRaw.trim().slice(0, 240)
      : "LLM routing (no rationale provided)";

  // callbackUsed is nullable by schema; treat any empty/whitespace string as null.
  const cbRaw = obj.callbackUsed;
  const callbackUsed =
    typeof cbRaw === "string" && cbRaw.trim().length > 0
      ? cbRaw.trim().slice(0, 160)
      : null;

  return {
    personaId: id as ArchetypeIdV2,
    confidence,
    rationale: rationaleStr,
    callbackUsed,
  };
}

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Claude Haiku (via tool_use) to pick the next persona or SILENT.
 * Returns `null` on any failure path — timeout, upstream error, missing
 * tool_use block, malformed input, invalid slot. Never throws.
 */
export async function pickPersonaLLMv2(
  ctx: PickPersonaCtxV2
): Promise<LlmRoutingPickV2 | null> {
  const started = Date.now();

  try {
    const client = new Anthropic({ apiKey: ctx.anthropicKey });

    // Haiku caching: mark the system block + the single tool definition as
    // ephemeral-cacheable. On cache hit we pay ~10 % of normal input cost and
    // get the ~85 % TTFT reduction that makes the 400 ms routing budget
    // cleanly achievable. First request in a warm session pays the cache-write
    // overhead; every subsequent tick in the same session rides the cache.
    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: [
          {
            type: "text",
            text: CACHED_ROUTING_STABLE_PREFIX_V2,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            ...PICK_NEXT_SPEAKER_TOOL,
            cache_control: { type: "ephemeral" },
          },
        ],
        tool_choice: { type: "tool", name: "pick_next_speaker" },
        messages: [
          { role: "user", content: buildRoutingUserPromptV2(ctx) },
        ],
      },
      { signal: ctx.signal }
    );

    const toolBlock = response.content.find(
      (b) => b.type === "tool_use" && b.name === "pick_next_speaker"
    );
    if (!toolBlock || toolBlock.type !== "tool_use") {
      logPipeline({
        event: "llm_director_v2_no_tool_use",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          elapsedMs: Date.now() - started,
          stopReason: response.stop_reason,
        },
      });
      return null;
    }

    const pick = validatePickV2(toolBlock.input);
    if (!pick) {
      logPipeline({
        event: "llm_director_v2_invalid_shape",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          elapsedMs: Date.now() - started,
          raw: toolBlock.input,
        },
      });
      return null;
    }

    // cacheCreationTokens: non-zero on cold-start (cache write on first use).
    // cacheReadTokens: non-zero on cache hit (cheap + fast). SET-16 pulls
    // these fields to validate hit rate ≥ 80 % and p95 TTFT ≤ 250 ms.
    logPipeline({
      event: "llm_director_v2_pick",
      level: "info",
      sessionId: ctx.sessionId,
      data: {
        pick: pick.personaId,
        rationale: pick.rationale,
        confidence: pick.confidence,
        callbackUsed: pick.callbackUsed,
        elapsedMs: Date.now() - started,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    });

    return pick;
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));

    logPipeline({
      event: isAbort ? "llm_director_v2_timeout" : "llm_director_v2_error",
      level: isAbort ? "debug" : "warn",
      sessionId: ctx.sessionId,
      data: {
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

// ──────────────────────────────────────────────────────
// STICKY-AGENT PENALTY
// ──────────────────────────────────────────────────────

/**
 * Apply a sticky-agent penalty to the confidence vector before argmax.
 *
 * The LLM is instructed NOT to penalize recent speakers itself (so the
 * specialty signal stays honest). This function bolts the recency
 * penalty on deterministically: every persona who fired in the last
 * `window` firings gets their confidence multiplied by `penalty`
 * raised to the recency index (more recent = stronger penalty).
 *
 * SILENT is never penalized — it has no recency context.
 *
 * Returns a new vector + the new argmax slot.
 */
export function applyStickyPenalty(
  confidence: ConfidenceVectorV2,
  recentFirings: string[],
  window = 2,
  penalty = 0.6
): { confidence: ConfidenceVectorV2; argmax: ArchetypeIdV2 } {
  const adjusted: ConfidenceVectorV2 = { ...confidence };
  const tail = recentFirings.slice(-window);
  tail.forEach((id, idx) => {
    if (id === "producer" || id === "troll" || id === "soundfx" || id === "joker") {
      // idx = 0 is oldest, idx = tail.length-1 is newest. Newest gets
      // the smallest multiplier (strongest penalty). The multiplier
      // `penalty^(idx+1)` ranges from `penalty` (oldest) to
      // `penalty^tail.length` (newest); for penalty<1 that means the
      // most recent firing compounds hardest. Multiplicative so a
      // persona firing twice in a row is squashed twice over.
      const strength = Math.pow(penalty, idx + 1);
      adjusted[id] *= strength;
    }
  });

  // Re-normalize (keeps the vector interpretable downstream).
  const sum =
    adjusted.producer +
    adjusted.troll +
    adjusted.soundfx +
    adjusted.joker +
    adjusted.silent;
  if (sum > 0) {
    adjusted.producer /= sum;
    adjusted.troll /= sum;
    adjusted.soundfx /= sum;
    adjusted.joker /= sum;
    adjusted.silent /= sum;
  }

  // Argmax across all 5.
  let best: ArchetypeIdV2 = "silent";
  let bestP = -1;
  for (const id of VALID_ARCHETYPE_IDS_V2) {
    if (adjusted[id] > bestP) {
      bestP = adjusted[id];
      best = id;
    }
  }

  return { confidence: adjusted, argmax: best };
}
