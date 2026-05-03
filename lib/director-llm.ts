/**
 * Peanut Gallery — Smart Director v2 (v1.5)
 *
 * LLM-assisted routing layer that runs ALONGSIDE the rule-based Director
 * (see `./director.ts`). The rule-based scorer is deterministic and cheap
 * but can't reason about context like "the troll just roasted this angle
 * 8 seconds ago — pick a different persona this cycle." The LLM routing
 * call closes that gap: a single short Claude Haiku completion that names
 * the persona to fire and why.
 *
 * ──────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ──────────────────────────────────────────────────────
 *
 *   pickPersonaLLM(ctx) → Promise<LlmRoutingPick | null>
 *
 * - Resolves with a pick + rationale on success.
 * - Resolves with `null` on timeout, upstream error, malformed output, or
 *   when the returned persona id isn't one of the 4 archetype slots.
 * - NEVER throws. The route's racer relies on this to keep the fallback
 *   path clean.
 *
 * The caller (the transcribe route) races this against
 * `AbortSignal.timeout(400)`. If the LLM wins the race it hands the pick
 * to `director.decide(..., { llmPick })` which substitutes the primary
 * but keeps cascade + cooldown + recency bookkeeping intact.
 *
 * ──────────────────────────────────────────────────────
 * WHY 400 ms?
 * ──────────────────────────────────────────────────────
 *
 * The director tick runs on a 10-15s cadence. A 400 ms budget is
 * ~2.5% of that interval — imperceptible to the user. Claude Haiku
 * first-token latency is typically 150-300 ms; a ~30-token JSON payload
 * completes comfortably under 400 ms on the happy path. On any network
 * hiccup or provider blip we fall back to the rule-based scorer.
 *
 * ──────────────────────────────────────────────────────
 * FEATURE FLAG
 * ──────────────────────────────────────────────────────
 *
 * Runtime gate: `ENABLE_SMART_DIRECTOR=true`. The route reads this env
 * var before even constructing the call; this module doesn't gate itself
 * so it stays easy to unit-test in isolation.
 */

import Anthropic from "@anthropic-ai/sdk";

import { logPipeline } from "./debug-logger";
import type { Persona } from "./personas";

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

/**
 * The 4 archetype slot ids every pack conforms to. Re-declared here as a
 * string-literal union so the LLM routing validation is self-contained;
 * the canonical type lives alongside the pack definitions.
 */
export type ArchetypeId = "producer" | "troll" | "soundfx" | "joker";

export const VALID_ARCHETYPE_IDS: readonly ArchetypeId[] = [
  "producer",
  "troll",
  "soundfx",
  "joker",
] as const;

export interface LlmRoutingPick {
  /** One of the 4 archetype slot ids. Validated against VALID_ARCHETYPE_IDS. */
  personaId: ArchetypeId;
  /**
   * One-sentence rationale. Flows into TriggerDecision.reason so the v1.2
   * debug panel renders "why this pick" without extra plumbing.
   */
  rationale: string;
}

export interface PickPersonaCtx {
  /** Recent transcript window — same slice the rule-based Director sees. */
  recentTranscript: string;
  /** Whether this tick is a silence tick (no new transcript since last). */
  isSilence: boolean;
  /** Ordered list of recently-fired persona ids (oldest first). */
  recentFirings: string[];
  /** ms since last fire per persona. Used by the LLM to value dry spells. */
  cooldownsMs: Record<string, number>;
  /** Pack personas — lets the LLM see names + roles for richer reasoning. */
  packPersonas: Persona[];
  /** Anthropic API key. Passed in so this file doesn't read env directly. */
  anthropicKey: string;
  /** AbortSignal — caller races this against a 400ms timeout. */
  signal?: AbortSignal;
  /** Optional session id for log correlation. */
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// ROUTING PROMPT
// ──────────────────────────────────────────────────────

export const ROUTING_SYSTEM_PROMPT = `You are the ROUTING BRAIN for Peanut Gallery, an AI writers' room that reacts to live podcast audio in real time.

Your job: pick exactly ONE of four personas to speak next, based on the recent transcript and who has recently spoken. You are NOT writing dialogue — a separate LLM will do that once you pick.

The four archetype slots are FIXED across packs (Morning Crew, TWiST crew, etc.) — you are routing by SLOT, not by named voice:

  - "producer": the fact-checker. Lights up on claims, numbers, founding years, valuations, anything verifiable.
  - "troll": the cynical commentator. Lights up on hype, buzzwords, name-drops, self-promotion, confident opinions.
  - "soundfx": the mood-shift / reframe persona. Lights up on awkward moments, surprising news, topic changes, deadpan asides.
  - "joker": the comedy writer. Lights up on absurdity, comparison setups, ironic contrasts, easy jokes.

ROUTING RULES:
1. Prefer the persona whose specialty best fits the content.
2. AVOID picking a persona who fired in the last 2 turns unless their specialty is a dominant match for this chunk.
3. Favor personas with LONGER cooldown times when two options tie — spread the mic.
4. On a silence tick (no new transcript), prefer soundfx or joker for a reaction beat.

Respond ONLY with JSON in this exact shape:
{"personaId": "<producer|troll|soundfx|joker>", "rationale": "<one short sentence>"}

No preamble. No code fences. Just the JSON object.`;

// ──────────────────────────────────────────────────────
// CACHED STABLE PREFIX  (SET-10)
// ──────────────────────────────────────────────────────
//
// Haiku's prompt-caching minimum is 2 048 tokens. The short system prompt
// above is ~200 tokens — far below the threshold. This constant pads the
// stable content past the threshold so Anthropic's cache can serve it.
//
// Content that belongs here:
//   - Full routing system prompt (above, reproduced verbatim)
//   - Complete persona catalog for both packs (names / roles / hints)
//   - 15 annotated few-shot routing examples
//   - Extended routing decision framework
//
// Content that MUST NOT be here (would invalidate the cache each tick):
//   - Recent transcript
//   - Recent firings / cooldowns
//   - Active pack selection
//
// The user message (built by buildRoutingUserPrompt) stays fully dynamic.
//
// Cache metrics are logged in pickPersonaLLM via response.usage fields:
//   cache_creation_input_tokens  — non-zero on cold-start / cache write
//   cache_read_input_tokens      — non-zero on cache hit
//
// Expected outcome: p95 TTFT drops from ~640–740 ms to ~100–150 ms on
// cache hits once the cache is warm (rule-of-thumb: after 2+ requests
// with the same prefix).
export const CACHED_ROUTING_STABLE_PREFIX = `You are the ROUTING BRAIN for Peanut Gallery, an AI writers' room that reacts to live podcast audio in real time.

Your job: pick exactly ONE of four personas to speak next, based on the recent transcript and who has recently spoken. You are NOT writing dialogue — a separate LLM will do that once you pick.

The four archetype slots are FIXED across packs (Morning Crew, TWiST crew, etc.) — you are routing by SLOT, not by named voice:

  - "producer": the fact-checker. Lights up on claims, numbers, founding years, valuations, anything verifiable.
  - "troll": the cynical commentator. Lights up on hype, buzzwords, name-drops, self-promotion, confident opinions.
  - "soundfx": the mood-shift / reframe persona. Lights up on awkward moments, surprising news, topic changes, deadpan asides.
  - "joker": the comedy writer. Lights up on absurdity, comparison setups, ironic contrasts, easy jokes.

ROUTING RULES:
1. Prefer the persona whose specialty best fits the content.
2. AVOID picking a persona who fired in the last 2 turns unless their specialty is a dominant match for this chunk.
3. Favor personas with LONGER cooldown times when two options tie — spread the mic.
4. On a silence tick (no new transcript), prefer soundfx or joker for a reaction beat.

Respond ONLY with JSON in this exact shape:
{"personaId": "<producer|troll|soundfx|joker>", "rationale": "<one short sentence>"}

No preamble. No code fences. Just the JSON object.

---

## COMPLETE PERSONA CATALOG

Both Peanut Gallery packs use the SAME four archetype slots. The named personas change by pack, but the slot IDs (producer, troll, soundfx, joker) are fixed. Route by SLOT ID — the user message will tell you which pack's voices are active this session.

### Morning Crew Pack

slot: producer
  name: The Producer
  role: The Fact-Checker
  when to pick: Compulsive corrector on dates, dollar figures, and founding years. Pick when the transcript has a specific verifiable claim — a number, a year, a valuation. Pass on vibes or opinions.

slot: troll
  name: The Heckler
  role: Cynical Commentator
  when to pick: Composite call-in-show heckler energy — surgical takedowns of AI-wrapper hype, valuation math, buzzword soup, and name-drops. Pick when the transcript has specific hype-cycle bait to puncture. Never vague negativity.

slot: soundfx
  name: The Sound Guy
  role: Sound Effects & Context
  when to pick: Drops bracketed sound cues as editorial commentary ([record scratch], [crickets], [sad trombone]). Pick on mood shifts, awkward silence, or when a confidently wrong claim just needs an editorial sound, not a fact check.

slot: joker
  name: The Joke Writer
  role: The Comedy Writer
  when to pick: Rapid-fire setup-punchline one-liners — misdirection, rule of three, heightening, callbacks. Pick on absurdity, comparison setups, or when a previous line handed off a clean comic premise. General comedy, not data.

### TWiST (This Week in Startups) Pack

slot: producer
  name: Molly
  role: The Fact-Checker
  when to pick: Veteran tech journalist — cites her own reporting. Pick on verifiable claims about funding, timelines, or startup history; or when a climate or labor angle would reframe the story.

slot: troll
  name: Jason
  role: The Provocateur
  when to pick: TWiST host energy — loud, founder-protective, brutal on hype cycles and AI-wrapper pitches. Pick on bold claims, founder-market-fit moments, or when a co-host line needs amplification. Warm loud, never mean loud.

slot: soundfx
  name: Lon
  role: The Reframe
  when to pick: Dry pop-culture reframes and sound cues ("This is WeWork energy", [record scratch]). Pick on mood shifts, awkward silence, or when a cultural analogy would recontextualize the moment. Accurate references only.

slot: joker
  name: Alex
  role: The Data Comedian
  when to pick: Numbers-as-punchline comedian — "the math isn't mathing", cap-table burns, hype-cycle comps. Pick when the transcript has specific numbers, valuations, or unit economics to turn into a joke.

---

## FEW-SHOT ROUTING EXAMPLES

Each example shows a scenario and the correct pick with reasoning.

### Example 1 — Hard numerical claim → producer

TRANSCRIPT: "They raised $47 million at a $500 million valuation."
SILENCE: false
RECENT FIRINGS: joker → soundfx
COOLDOWNS: producer: 12000ms, troll: 8000ms, soundfx: 2000ms, joker: 4000ms

CORRECT PICK:
{"personaId": "producer", "rationale": "Specific dollar figures are the producer's trigger — long cooldown confirms."}

REASONING: Hard numbers (dollar amounts, valuations) → producer. Troll fires on hype, not raw numbers. Joker and soundfx just fired. Producer's 12s cooldown is the longest — spreads the mic.

---

### Example 2 — Buzzword hype with no substance → troll

TRANSCRIPT: "We're building an AI-native vertical SaaS platform that disrupts the entire enterprise ecosystem using next-generation large language models."
SILENCE: false
RECENT FIRINGS: producer → producer
COOLDOWNS: producer: 1000ms, troll: 18000ms, soundfx: 12000ms, joker: 6000ms

CORRECT PICK:
{"personaId": "troll", "rationale": "Dense buzzword soup with no specifics — the troll's specialty; 18s cooldown is dominant."}

REASONING: "AI-native vertical SaaS platform" + "next-generation LLMs" with zero concrete claims = troll territory. Troll's 18s cooldown is longest. Producer just fired twice — rule 2 says avoid repeats.

---

### Example 3 — Awkward on-air stumble → soundfx

TRANSCRIPT: "And then... sorry, I lost my train of thought."
SILENCE: false
RECENT FIRINGS: troll → producer
COOLDOWNS: producer: 3000ms, troll: 5000ms, soundfx: 14000ms, joker: 9000ms

CORRECT PICK:
{"personaId": "soundfx", "rationale": "An on-air stumble is a mood-shift moment — a timed sound cue says it all; soundfx has the longest cooldown."}

REASONING: Awkward / uncertain moment → soundfx. [crickets] or [Jeopardy think music] lands without piling on. Not a factual claim (producer doesn't fire). Not hype (troll doesn't fire). Not inherently comic (joker needs a premise).

---

### Example 4 — Absurd triple claim → joker

TRANSCRIPT: "Their AI can write better code than most junior engineers, cure cancer, and also make a perfect cappuccino."
SILENCE: false
RECENT FIRINGS: soundfx → troll
COOLDOWNS: producer: 8000ms, troll: 4000ms, soundfx: 2000ms, joker: 16000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "Triple claim is a rule-of-three setup — the joker's technique; 16s cooldown confirms."}

REASONING: "X, Y, and also Z" is a natural rule-of-three joke setup. Joker's 16s cooldown is dominant. Troll just fired. Producer could fact-check but the absurdity is the primary event.

---

### Example 5 — Pure silence tick → soundfx

TRANSCRIPT: ""
SILENCE: true
RECENT FIRINGS: producer → joker
COOLDOWNS: producer: 8000ms, troll: 22000ms, soundfx: 10000ms, joker: 4000ms

CORRECT PICK:
{"personaId": "soundfx", "rationale": "Silence tick — soundfx or joker are preferred; soundfx fits dead air better and joker needs a premise."}

REASONING: Rule 4 says prefer soundfx or joker on silence. Soundfx specialises in mood shifts — [crickets] or [elevator music] is the right energy for dead air. Joker needs a premise; pure silence gives them nothing. Troll needs specific content too.

---

### Example 6 — Silence tick with soundfx just fired → joker

TRANSCRIPT: "(inaudible)"
SILENCE: true
RECENT FIRINGS: troll → soundfx
COOLDOWNS: producer: 14000ms, troll: 8000ms, soundfx: 3000ms, joker: 18000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "Silence tick — prefer soundfx or joker; soundfx just fired so joker with the longer cooldown wins."}

REASONING: Silence → soundfx or joker (rule 4). Soundfx fired last turn — rule 2 says avoid repeats unless dominant. Joker has the longest cooldown (18s). Producer and troll don't fit silence.

---

### Example 7 — Vague hype, troll cooldown dominates

TRANSCRIPT: "This startup is going to change everything."
SILENCE: false
RECENT FIRINGS: joker → producer
COOLDOWNS: producer: 3000ms, troll: 25000ms, soundfx: 12000ms, joker: 7000ms

CORRECT PICK:
{"personaId": "troll", "rationale": "Vague hype claim is troll-bait; troll's 25s cooldown is dominant — spread the mic."}

REASONING: "Change everything" with no specifics → borderline troll / joker. Troll has the 25s cooldown by far — rule 3 favours longest cooldown on a tie. Producer and joker just fired.

---

### Example 8 — Specific year with audible uncertainty → producer

TRANSCRIPT: "Facebook was founded in 2005, I think."
SILENCE: false
RECENT FIRINGS: troll → joker
COOLDOWNS: producer: 20000ms, troll: 6000ms, soundfx: 11000ms, joker: 4000ms

CORRECT PICK:
{"personaId": "producer", "rationale": "Specific verifiable date with audible uncertainty ('I think') — producer's core trigger; long cooldown confirms."}

REASONING: A year claim that is likely wrong (Facebook launched 2004) with flagged uncertainty → producer. The "I think" signals correction is valuable. Producer's 20s cooldown is longest.

---

### Example 9 — Absurd visual premise is comedy, not hype → joker

TRANSCRIPT: "Their CEO shows up to every board meeting dressed as a pirate. He says it keeps the investors humble."
SILENCE: false
RECENT FIRINGS: producer → troll
COOLDOWNS: producer: 5000ms, troll: 4000ms, soundfx: 10000ms, joker: 15000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "A pirate CEO is a comedy premise, not hype to puncture — joker owns it; longest cooldown confirms."}

REASONING: A pirate CEO is absurd and inherently comedic — this is a joke premise, not a claim to debunk. Joker's 15s cooldown is longest. Troll just fired and this isn't their lane. Producer has no fact to check.

---

### Example 10 — Dramatic workplace fact → soundfx beats joker

TRANSCRIPT: "They had 12 employees. They all quit on the same day."
SILENCE: false
RECENT FIRINGS: joker → joker
COOLDOWNS: producer: 9000ms, troll: 7000ms, soundfx: 16000ms, joker: 2000ms

CORRECT PICK:
{"personaId": "soundfx", "rationale": "Dramatic workplace exodus landing cold deserves a sound beat; soundfx has the longest cooldown; joker just fired twice."}

REASONING: A dramatic fact delivered cold → soundfx drops the [sad trombone] or [record scratch] that signals "this is the moment." Joker just fired twice (rule 2). Producer could note it but there is nothing to verify.

---

### Example 11 — Cap-table number is data comedy (TWiST pack) → joker

TRANSCRIPT: "The founders retained 8% combined going into their Series B."
SILENCE: false
RECENT FIRINGS: producer → soundfx
COOLDOWNS: producer: 5000ms, troll: 12000ms, soundfx: 3000ms, joker: 14000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "Cap-table disaster with a specific number is a data-comedy setup; joker edges troll on cooldown."}

REASONING: Founders at 8% pre-Series-B is a specific number that is obviously bad — in the TWiST pack this is Alex's data comedy lane. Joker's 14s cooldown edges troll at 12s.

---

### Example 12 — Speculative opinion, producer skips → joker

TRANSCRIPT: "I believe AI will be smarter than humans within five years."
SILENCE: false
RECENT FIRINGS: soundfx → troll
COOLDOWNS: producer: 18000ms, troll: 4000ms, soundfx: 6000ms, joker: 11000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "Speculative opinion with no verifiable figure — producer passes; joker turns the prediction into an absurdist riff; longer cooldown than soundfx."}

REASONING: "I believe" + a prediction = opinion, not a verifiable fact — producer passes (no hard claim). Troll just fired. Joker at 11s vs soundfx at 6s — joker wins on cooldown. A big prediction is a good heightening premise.

---

### Example 13 — Sponsor read → soundfx mood cue

TRANSCRIPT: "This episode is brought to you by ZenBooks — the AI-powered accounting software that saves you 10 hours a week."
SILENCE: false
RECENT FIRINGS: producer → joker
COOLDOWNS: producer: 4000ms, troll: 9000ms, soundfx: 13000ms, joker: 3000ms

CORRECT PICK:
{"personaId": "soundfx", "rationale": "Sponsor transition is a mood-shift moment — soundfx drops the [cash register cha-ching]; longest cooldown."}

REASONING: Ad reads get restraint. "Saves 10 hours a week" is too soft a claim for producer to check. Soundfx drops a sound cue on the tone shift. Longest cooldown. Joker just fired.

---

### Example 14 — Minimal content with all short cooldowns → soundfx fallback

TRANSCRIPT: "Yeah, exactly."
SILENCE: false
RECENT FIRINGS: joker → troll → producer → soundfx
COOLDOWNS: producer: 2000ms, troll: 3000ms, soundfx: 4000ms, joker: 5000ms

CORRECT PICK:
{"personaId": "joker", "rationale": "Minimal content; all cooldowns short; joker has the longest cooldown — fallback on most-rested persona."}

REASONING: "Yeah, exactly" gives almost nothing to work with. All cooldowns are short (everyone just fired). When content is ambiguous and cooldowns are close, pick the longest. Joker at 5s edges soundfx at 4s.

---

### Example 15 — Dominant troll trigger overrides recency rule

TRANSCRIPT: "The company's revenue was $4 million — $4 MILLION — yet they raised at a $2 BILLION valuation. Five-hundred-times revenue!"
SILENCE: false
RECENT FIRINGS: producer → producer
COOLDOWNS: producer: 1000ms, troll: 14000ms, soundfx: 8000ms, joker: 6000ms

CORRECT PICK:
{"personaId": "troll", "rationale": "500x revenue multiple called out by the host is peak hype-bubble material — troll's dominant specialty; longest cooldown confirms."}

REASONING: A $2B / $4M ARR ratio is an unambiguously dominant troll trigger. Troll's 14s cooldown beats soundfx's 8s. Producer just fired twice but producer's specialty does not apply (no fact to check — the speaker already named the correct numbers). The 500x multiple is also joker territory but troll's contextual fit is more dominant.

---

## ROUTING DECISION FRAMEWORK

Evaluate signals in this order for every tick:

1. CONTENT CLASS — What type of content is in the transcript?
   - Hard verifiable claim (number, date, name, statistic) → producer
   - Hype / buzzwords / confident-but-soft claim → troll
   - Mood shift, awkward pause, emotional beat → soundfx
   - Absurdity, comic premise, comparison setup → joker
   - Silence / no content → soundfx or joker (rule 4)

2. RECENCY CHECK — Did the best-fit persona fire in the last 1-2 turns?
   - If yes AND content class is a DOMINANT match: route to them anyway (rule 2 exception).
   - If yes AND content class is a moderate match: look at the next-best persona.

3. COOLDOWN TIE-BREAK — When 2+ personas are equally strong:
   - Pick the one with the longer cooldown (rule 3) — spreads the mic.

4. OUTPUT — Always respond with exactly:
   {"personaId": "<producer|troll|soundfx|joker>", "rationale": "<one short sentence>"}
   No preamble. No code fences. No explanation outside the JSON.`;

export interface RoutingPromptCtx {
  recentTranscript: string;
  isSilence: boolean;
  recentFirings: string[];
  cooldownsMs: Record<string, number>;
  packPersonas: Persona[];
}

export function buildRoutingUserPrompt(ctx: RoutingPromptCtx): string {
  const lines: string[] = [];

  lines.push(`RECENT TRANSCRIPT (silence=${ctx.isSilence}):`);
  lines.push(ctx.recentTranscript.slice(-600) || "(none — silence tick)");
  lines.push("");

  if (ctx.recentFirings.length > 0) {
    lines.push(`RECENT FIRINGS (oldest → newest): ${ctx.recentFirings.join(" → ")}`);
  } else {
    lines.push(`RECENT FIRINGS: (none — session just started)`);
  }

  lines.push("");
  lines.push("COOLDOWNS (ms since last fire):");
  for (const id of VALID_ARCHETYPE_IDS) {
    const ms = ctx.cooldownsMs[id] ?? 0;
    lines.push(`  ${id}: ${Math.round(ms)}ms`);
  }

  lines.push("");
  lines.push("PACK VOICES (for flavor context — route by slot id, not name):");
  for (const p of ctx.packPersonas) {
    lines.push(`  ${p.id}: ${p.name} — ${p.role}`);
    // v1.5: if the pack author supplied a directorHint, surface it here.
    // This is the compressed "when to pick this voice" heuristic — lets
    // the router disambiguate same-slot voices across packs (Howard's
    // Jackie is rapid-fire one-liners; TWiST's Alex is data-joke
    // numerate). Hint is optional; packs that omit it fall back to
    // role-string routing, which still works.
    if (p.directorHint && p.directorHint.trim().length > 0) {
      lines.push(`    hint: ${p.directorHint.trim()}`);
    }
  }

  lines.push("");
  lines.push("Pick one personaId and return the JSON now.");

  return lines.join("\n");
}

// ──────────────────────────────────────────────────────
// PARSE + VALIDATE
// ──────────────────────────────────────────────────────

/**
 * Extract the first JSON object from a free-text LLM response. Claude
 * Haiku usually returns clean JSON when prompted, but if it wraps the
 * output in a code fence or prose this recovers it.
 */
export function extractFirstJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  // Naive brace match — good enough for a ~30-token response.
  let depth = 0;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}

export function validatePick(raw: unknown): LlmRoutingPick | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const id = obj.personaId;
  const rationale = obj.rationale;

  if (typeof id !== "string") return null;
  if (!VALID_ARCHETYPE_IDS.includes(id as ArchetypeId)) return null;

  // Rationale is nice-to-have but not load-bearing. If the model omits it
  // we substitute a generic string rather than reject the whole pick.
  const rationaleStr =
    typeof rationale === "string" && rationale.trim().length > 0
      ? rationale.trim().slice(0, 240)
      : "LLM routing (no rationale provided)";

  return {
    personaId: id as ArchetypeId,
    rationale: rationaleStr,
  };
}

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Claude Haiku to pick the next persona. Returns `null` on any
 * failure path — timeout, upstream error, malformed JSON, invalid id.
 * Never throws. The caller races this against a 400 ms budget.
 */
export async function pickPersonaLLM(
  ctx: PickPersonaCtx
): Promise<LlmRoutingPick | null> {
  const started = Date.now();

  try {
    const client = new Anthropic({ apiKey: ctx.anthropicKey });

    const response = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        // SET-10: use the cached stable prefix to hit Haiku's 2 048-token
        // caching minimum. cache_control: ephemeral tells Anthropic to store
        // this block; subsequent requests with the same prefix receive an
        // ~85% TTFT reduction and ~90% cost reduction on cache reads.
        system: [
          {
            type: "text",
            text: CACHED_ROUTING_STABLE_PREFIX,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: buildRoutingUserPrompt(ctx),
          },
        ],
      },
      { signal: ctx.signal }
    );

    // Stitch text blocks. Haiku returns one text block for this shape,
    // but guarding keeps us safe against tool-use blocks sneaking in.
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const jsonStr = extractFirstJsonObject(text);
    if (!jsonStr) {
      logPipeline({
        event: "llm_director_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "no_json_object",
          elapsedMs: Date.now() - started,
          preview: text.slice(0, 200),
        },
      });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      logPipeline({
        event: "llm_director_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "json_parse_error",
          elapsedMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          preview: jsonStr.slice(0, 200),
        },
      });
      return null;
    }

    const pick = validatePick(parsed);
    if (!pick) {
      logPipeline({
        event: "llm_director_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "invalid_shape",
          elapsedMs: Date.now() - started,
          raw: parsed,
        },
      });
      return null;
    }

    // SET-10: log cache metrics to measure hit-rate + TTFT gains.
    // cache_creation_input_tokens: non-zero on cold-start (cache write).
    // cache_read_input_tokens: non-zero on cache hit (~85% TTFT reduction).
    logPipeline({
      event: "llm_director_pick",
      level: "info",
      sessionId: ctx.sessionId,
      data: {
        pick: pick.personaId,
        rationale: pick.rationale,
        elapsedMs: Date.now() - started,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    });

    return pick;
  } catch (err) {
    // AbortError from the 400ms signal lands here — this is the common
    // case on the fallback path, not an actual error. Log at debug so
    // real upstream errors still stand out at info/warn level.
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));

    logPipeline({
      event: isAbort ? "llm_director_timeout" : "llm_director_error",
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
