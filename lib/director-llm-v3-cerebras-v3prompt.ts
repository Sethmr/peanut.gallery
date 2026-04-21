/**
 * Peanut Gallery — Smart Director v3 prompt (Cerebras Llama 3.1 8B) — SET-13
 *
 * v3-prompt shadow companion. Replaces the v2 free-text JSON prompt from
 * `director-llm-v3-cerebras.ts` with the full v3 routing brain: 5-slot
 * SILENT as a positive pick, verbalized confidence distribution across all
 * five slots, randomised persona order to kill position bias, and live
 * callback candidates. Structured output enforced via
 * `response_format: { type: "json_schema" }` — Cerebras's OpenAI-compatible
 * analogue of Anthropic `tool_use`. Returns `LlmRoutingPickV2 | null`.
 *
 * ──────────────────────────────────────────────────────
 * WHY json_schema INSTEAD OF json_object?
 * ──────────────────────────────────────────────────────
 *
 * The v2 shadow modules used `response_format: { type: "json_object" }`, which
 * guarantees valid JSON but not valid *values* — the model could still emit
 * `"personaId": "wizard"` and we'd catch it only at validatePickV2 time.
 * `json_schema` with an explicit enum constraint on personaId gives us the same
 * hard-enum guarantee that Anthropic tool_use provides, closing the last class
 * of parse failures on the Cerebras path.
 *
 * ──────────────────────────────────────────────────────
 * FEATURE FLAG
 * ──────────────────────────────────────────────────────
 *
 * ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT=true
 *
 * Keep the v2-prompt flag (ENABLE_SMART_DIRECTOR_V3_CEREBRAS) active in
 * parallel for ~1 week so the agreement-rate comparison is meaningful.
 * Both can be on at once — the route fires independent promises.
 *
 * ──────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ──────────────────────────────────────────────────────
 *
 *   pickPersonaCerebrasV3(ctx) → Promise<LlmRoutingPickV2 | null>
 *
 * - Resolves with a 5-slot pick + confidence vector + rationale on success.
 * - Resolves with `null` on timeout, upstream error, malformed output, or
 *   invalid persona id.
 * - NEVER throws. Used exclusively for shadow telemetry; its result is
 *   logged in `director_v3_shadow_compare` but never fed to director.decide().
 */

import { logPipeline } from "./debug-logger";
import {
  ROUTING_SYSTEM_PROMPT_V2,
  buildRoutingUserPromptV2,
  validatePickV2,
  VALID_ARCHETYPE_IDS_V2,
  type LlmRoutingPickV2,
  type RoutingPromptCtxV2,
} from "./director-llm-v2";
import type { Persona } from "./personas";

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

export interface PickPersonaCtxV3CerebrasV3 {
  recentTranscript: string;
  isSilence: boolean;
  recentFirings: string[];
  cooldownsMs: Record<string, number>;
  packPersonas: Persona[];
  /**
   * Ring buffer of notable phrases from the last 3-5 minutes. Forwarded
   * into the v3 prompt's LIVE CALLBACK CANDIDATES section. Optional —
   * omit when the Director hasn't collected candidates yet.
   */
  liveCallbacks?: string[];
  /** Cerebras API key. Passed in so this file doesn't read env directly. */
  cerebrasKey: string;
  signal?: AbortSignal;
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────

const CEREBRAS_ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "llama3.1-8b";

// JSON Schema mirroring the Anthropic pick_next_speaker tool input_schema.
// `response_format: { type: "json_schema" }` on Cerebras's OpenAI-compat
// endpoint enforces the enum at the provider level — same hard guarantee as
// Anthropic tool_use. The callbackUsed field uses a type array to allow null.
const PICK_SCHEMA = {
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
      additionalProperties: false,
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
  additionalProperties: false,
};

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Cerebras Llama 3.1 8B (v3 prompt) to pick the next persona or SILENT.
 * Uses `json_schema` response format for hard-enum enforcement on personaId.
 * Returns `null` on any failure path. Never throws.
 */
export async function pickPersonaCerebrasV3(
  ctx: PickPersonaCtxV3CerebrasV3
): Promise<LlmRoutingPickV2 | null> {
  const started = Date.now();

  const promptCtx: RoutingPromptCtxV2 = {
    recentTranscript: ctx.recentTranscript,
    isSilence: ctx.isSilence,
    recentFirings: ctx.recentFirings,
    cooldownsMs: ctx.cooldownsMs,
    packPersonas: ctx.packPersonas,
    liveCallbacks: ctx.liveCallbacks,
  };

  try {
    const res = await fetch(CEREBRAS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.cerebrasKey}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        max_tokens: 300,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pick_next_speaker",
            schema: PICK_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: ROUTING_SYSTEM_PROMPT_V2 },
          { role: "user", content: buildRoutingUserPromptV2(promptCtx) },
        ],
      }),
      signal: ctx.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      logPipeline({
        event: "llm_director_v3_error",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          provider: "cerebras",
          promptVersion: "v3",
          status: res.status,
          elapsedMs: Date.now() - started,
          preview: body.slice(0, 200),
        },
      });
      return null;
    }

    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      logPipeline({
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "json_parse_error",
          provider: "cerebras",
          promptVersion: "v3",
          elapsedMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          preview: text.slice(0, 200),
        },
      });
      return null;
    }

    const pick = validatePickV2(parsed);
    if (!pick) {
      logPipeline({
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "invalid_shape",
          provider: "cerebras",
          promptVersion: "v3",
          elapsedMs: Date.now() - started,
          raw: parsed,
        },
      });
      return null;
    }

    logPipeline({
      event: "llm_director_v3_pick",
      level: "info",
      sessionId: ctx.sessionId,
      data: {
        pick: pick.personaId,
        rationale: pick.rationale,
        confidence: pick.confidence,
        callbackUsed: pick.callbackUsed,
        provider: "cerebras",
        promptVersion: "v3",
        model: CEREBRAS_MODEL,
        elapsedMs: Date.now() - started,
      },
    });

    return pick;
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));

    logPipeline({
      event: isAbort ? "llm_director_v3_timeout" : "llm_director_v3_error",
      level: isAbort ? "debug" : "warn",
      sessionId: ctx.sessionId,
      data: {
        provider: "cerebras",
        promptVersion: "v3",
        model: CEREBRAS_MODEL,
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export { VALID_ARCHETYPE_IDS_V2 as VALID_ARCHETYPE_IDS_V3 };
