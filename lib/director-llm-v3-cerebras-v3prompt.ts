/**
 * Peanut Gallery — Smart Director v3 prompt (Cerebras Llama 3.1 8B) — SET-13
 *
 * v3-prompt shadow companion. Superseded the v2 free-text JSON prompt
 * module (`director-llm-v3-cerebras.ts`, removed 2026-04-22) with the
 * full v3 routing brain: 5-slot
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
 * This is the only Cerebras shadow path. The v2-prompt variant and its
 * `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` flag were retired 2026-04-22 after
 * Llama 8B was observed echoing `{"type":"object"}` instead of picking
 * a persona under `response_format: json_object` — json_schema's enum
 * constraint closes that failure mode.
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
  PICK_NEXT_SPEAKER_INPUT_SCHEMA,
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
  /**
   * SET-7: number of tail chars in `recentTranscript` that are NEW since
   * the previous tick. Prompt builder renders a `⟨ UNSTABLE TAIL … ⟩`
   * marker around those chars so the router can treat them as tentative.
   */
  unstableTailLen?: number;
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

// JSON Schema is the single source of truth in director-llm-v2.ts so the
// Anthropic tool_use path (main v3) and the Cerebras / Groq `response_format:
// json_schema` paths (shadows) all validate against the same shape. Any edit
// to the 5-slot enum or the confidence vector lands in exactly one place.

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
    unstableTailLen: ctx.unstableTailLen,
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
        // 300 was too tight once Llama 3.1 8B started echoing the full
        // json_schema envelope (~250 tokens of schema text) before
        // emitting the real pick. 600 leaves room for both the echo AND
        // the answer so JSON.parse doesn't choke on a truncated tail.
        max_tokens: 600,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pick_next_speaker",
            schema: PICK_NEXT_SPEAKER_INPUT_SCHEMA,
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
      // Truncated schema-echo failures are a known Llama 3.1 8B quirk on
      // the Cerebras shadow path — loud "warn" noise buries real problems
      // in the logs. Detect the echo shape and demote to debug; anything
      // else still surfaces as warn so genuine parse regressions are loud.
      const isSchemaEcho =
        text.startsWith('{"type"') && text.includes('"properties"');
      logPipeline({
        event: "llm_director_v3_parse_fail",
        level: isSchemaEcho ? "debug" : "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: isSchemaEcho ? "schema_echo_truncated" : "json_parse_error",
          provider: "cerebras",
          promptVersion: "v3",
          elapsedMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          preview: text.slice(0, 200),
        },
      });
      return null;
    }

    // Llama 3.1 8B occasionally wraps its answer in a JSON-Schema envelope:
    //   {"type":"object","properties":{<real payload>},"required":[...]}
    // Unwrap once when `properties.personaId` is a concrete string (not a
    // nested schema object), so shadow telemetry captures a usable pick
    // instead of discarding the whole call.
    parsed = unwrapSchemaEnvelope(parsed);

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

/**
 * Unwrap `{"type":"object","properties":{<payload>}}` into `<payload>` when
 * `properties.personaId` is already a concrete string rather than a nested
 * schema. Otherwise returns the input unchanged.
 */
function unwrapSchemaEnvelope(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const envelope = parsed as {
    type?: unknown;
    properties?: unknown;
    personaId?: unknown;
  };
  if (envelope.personaId !== undefined) return parsed;
  if (envelope.type !== "object") return parsed;
  if (!envelope.properties || typeof envelope.properties !== "object") {
    return parsed;
  }
  const inner = envelope.properties as { personaId?: unknown };
  if (typeof inner.personaId !== "string") return parsed;
  return envelope.properties;
}
