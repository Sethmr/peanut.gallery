/**
 * Peanut Gallery — Smart Director v3 (Groq Llama 3.1 8B) — SET-6
 *
 * @deprecated Uses the v2 routing prompt (4-slot, no SILENT, no confidence).
 * Kept for 1 week (until ~2026-04-28) so Seth can A/B v2-shadow vs v3-shadow
 * agreement rates. After the transition window, replace with
 * `director-llm-v3-groq-v3prompt.ts` (5-slot, confidence, json_schema).
 * Gated behind ENABLE_SMART_DIRECTOR_V3_GROQ=true.
 *
 * Shadow-test companion to director-llm.ts (Haiku v2). Identical routing
 * logic and identical prompt — only the provider differs. Gated behind
 * ENABLE_SMART_DIRECTOR_V3_GROQ=true; never routes user-facing traffic.
 *
 * ──────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ──────────────────────────────────────────────────────
 *
 *   pickPersonaGroq(ctx) → Promise<LlmRoutingPick | null>
 *
 * - Resolves with a pick + rationale on success.
 * - Resolves with `null` on timeout, upstream error, malformed output,
 *   or when the returned persona id isn't one of the 4 archetype slots.
 * - NEVER throws.
 *
 * The caller (transcribe route) fires this in parallel with the v2 Haiku
 * call and logs a `director_v3_shadow_compare` event. The v3 pick is
 * never used for actual routing — shadow data only.
 *
 * ──────────────────────────────────────────────────────
 * WHY GROQ LLAMA 3.1 8B?
 * ──────────────────────────────────────────────────────
 *
 * Haiku p95 TTFT ~640–740 ms vs a 400 ms Director budget → frequent
 * timeouts. Groq-hosted Llama 3.1 8B runs 50–120 ms TTFT at ~$0.06/M
 * input. Closed-set 5-enum classification accuracy gap predicted <3 F1
 * points (RouterBench). This shadow run collects ≥500 ticks to verify
 * agreement rate and p50/p95 latency deltas before any routing swap.
 *
 * ──────────────────────────────────────────────────────
 * FEATURE FLAG
 * ──────────────────────────────────────────────────────
 *
 * Runtime gate: `ENABLE_SMART_DIRECTOR_V3_GROQ=true`. Caller checks the
 * flag; this module doesn't gate itself so it stays easy to test in
 * isolation.
 */

import Groq from "groq-sdk";

import { logPipeline } from "./debug-logger";
import type { LlmRoutingPick } from "./director-llm";
import {
  VALID_ARCHETYPE_IDS,
  ROUTING_SYSTEM_PROMPT,
  buildRoutingUserPrompt,
  extractFirstJsonObject,
  validatePick,
} from "./director-llm";
import type { Persona } from "./personas";

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

/**
 * Context for the Groq v3 pick — mirrors PickPersonaCtx from director-llm.ts
 * but with groqKey instead of anthropicKey. All other fields are identical
 * so the route can pass the same per-tick state to both callers.
 */
export interface PickPersonaCtxV3Groq {
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
  /** Groq API key. Passed in so this file doesn't read env directly. */
  groqKey: string;
  /** AbortSignal — caller may supply a timeout signal. */
  signal?: AbortSignal;
  /** Optional session id for log correlation. */
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Groq Llama 3.1 8B to pick the next persona using strict JSON-mode.
 * Returns `null` on any failure path — timeout, upstream error, malformed
 * JSON, invalid id. Never throws. Used exclusively for shadow telemetry;
 * its result is logged but never fed to director.decide().
 */
export async function pickPersonaGroq(
  ctx: PickPersonaCtxV3Groq
): Promise<LlmRoutingPick | null> {
  const started = Date.now();

  try {
    const client = new Groq({ apiKey: ctx.groqKey });

    // Groq's OpenAI-compatible API supports response_format JSON mode which
    // guarantees the model emits a JSON object without a code-fence wrapper.
    // This makes the extractFirstJsonObject fallback unnecessary, but we keep
    // the shared validatePick call so the output contract is identical to v2.
    const completion = await client.chat.completions.create(
      {
        model: "llama-3.1-8b-instant",
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: ROUTING_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildRoutingUserPrompt(ctx),
          },
        ],
      },
      { signal: ctx.signal }
    );

    const text = (completion.choices[0]?.message?.content ?? "").trim();

    // JSON-mode guarantees a valid object, but we still run through the
    // shared extractor+validator so any Groq quirk is caught cleanly.
    const jsonStr = extractFirstJsonObject(text) ?? text;
    if (!jsonStr) {
      logPipeline({
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "no_json_object",
          provider: "groq",
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
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "json_parse_error",
          provider: "groq",
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
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "invalid_shape",
          provider: "groq",
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
        provider: "groq",
        model: "llama-3.1-8b-instant",
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
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

// Re-export for callers that want to log which archetype ids are valid.
export { VALID_ARCHETYPE_IDS };
