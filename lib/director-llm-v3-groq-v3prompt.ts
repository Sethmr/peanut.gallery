/**
 * Peanut Gallery — Smart Director v3 prompt (Groq Llama 3.1 8B) — SET-13
 *
 * v3-prompt shadow companion. Superseded the v2 free-text JSON prompt
 * module (`director-llm-v3-groq.ts`, removed 2026-04-22) with the full v3
 * routing brain: 5-slot SILENT as a positive pick, verbalized confidence
 * distribution, randomised persona order, and live callback candidates.
 * Structured output enforced via `response_format: { type: "json_schema" }`
 * — Groq's OpenAI-compatible analogue of Anthropic `tool_use`. Returns
 * `LlmRoutingPickV2 | null`.
 *
 * ──────────────────────────────────────────────────────
 * STATUS
 * ──────────────────────────────────────────────────────
 *
 * Groq Developer tier is "temporarily unavailable due to high demand" as of
 * 2026-04-21. This file is ready to activate; migration is tracked in
 * Linear SET-11. When the tier reopens, set
 * ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT=true and the shadow fires.
 *
 * ──────────────────────────────────────────────────────
 * FEATURE FLAG
 * ──────────────────────────────────────────────────────
 *
 * ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT=true
 *
 * This is the only Groq shadow path. The v2-prompt variant and its
 * `ENABLE_SMART_DIRECTOR_V3_GROQ` flag were retired 2026-04-22 for the
 * same json_object → `{"type":"object"}` echo bug that killed its
 * Cerebras counterpart. Dormant in production until the Groq Developer
 * tier reopens (SET-11).
 *
 * ──────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ──────────────────────────────────────────────────────
 *
 *   pickPersonaGroqV3(ctx) → Promise<LlmRoutingPickV2 | null>
 *
 * - Resolves with a 5-slot pick + confidence vector + rationale on success.
 * - Resolves with `null` on timeout, upstream error, malformed output, or
 *   invalid persona id.
 * - NEVER throws. Used exclusively for shadow telemetry; its result is
 *   logged in `director_v3_shadow_compare` but never fed to director.decide().
 */

import Groq from "groq-sdk";

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

export interface PickPersonaCtxV3GroqV3 {
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
   * the previous tick. Prompt builder marks those chars as tentative so
   * the router can downweight signals found only in the unstable tail.
   */
  unstableTailLen?: number;
  /** Groq API key. Passed in so this file doesn't read env directly. */
  groqKey: string;
  signal?: AbortSignal;
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────

const GROQ_MODEL = "llama-3.1-8b-instant";

// JSON Schema is the single source of truth in director-llm-v2.ts so the
// Anthropic tool_use path (main v3) and both Cerebras / Groq json_schema
// paths validate against the same shape. Any edit to the 5-slot enum or
// the confidence vector lands in exactly one place.

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Groq Llama 3.1 8B (v3 prompt) to pick the next persona or SILENT.
 * Uses `json_schema` response format for hard-enum enforcement on personaId.
 * Returns `null` on any failure path. Never throws.
 */
export async function pickPersonaGroqV3(
  ctx: PickPersonaCtxV3GroqV3
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
    const client = new Groq({ apiKey: ctx.groqKey });

    const completion = await client.chat.completions.create(
      {
        model: GROQ_MODEL,
        max_tokens: 300,
        // Groq supports json_schema mode via the OpenAI-compatible structured
        // outputs API. The enum on personaId is enforced at the provider level.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pick_next_speaker",
            schema: PICK_NEXT_SPEAKER_INPUT_SCHEMA,
          },
        } as any,
        messages: [
          { role: "system", content: ROUTING_SYSTEM_PROMPT_V2 },
          { role: "user", content: buildRoutingUserPromptV2(promptCtx) },
        ],
      },
      { signal: ctx.signal }
    );

    const text = (completion.choices[0]?.message?.content ?? "").trim();

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
          provider: "groq",
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
          provider: "groq",
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
        provider: "groq",
        promptVersion: "v3",
        model: GROQ_MODEL,
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
        provider: "groq",
        promptVersion: "v3",
        model: GROQ_MODEL,
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export { VALID_ARCHETYPE_IDS_V2 as VALID_ARCHETYPE_IDS_V3 };
