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

The four archetype slots are FIXED across packs (Howard Stern crew, TWiST crew, etc.) — you are routing by SLOT, not by named voice:

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
        system: ROUTING_SYSTEM_PROMPT,
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

    logPipeline({
      event: "llm_director_pick",
      level: "info",
      sessionId: ctx.sessionId,
      data: {
        pick: pick.personaId,
        rationale: pick.rationale,
        elapsedMs: Date.now() - started,
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
