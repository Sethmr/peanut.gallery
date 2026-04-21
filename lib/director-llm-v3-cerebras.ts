/**
 * Peanut Gallery — Smart Director v3 (Cerebras Llama 3.1 8B) — SET-6
 *
 * @deprecated Uses the v2 routing prompt (4-slot, no SILENT, no confidence).
 * Kept for 1 week (until ~2026-04-28) so Seth can A/B v2-shadow vs v3-shadow
 * agreement rates. After the transition window, replace with
 * `director-llm-v3-cerebras-v3prompt.ts` (5-slot, confidence, json_schema).
 * Gated behind ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true.
 *
 * Shadow-test companion to director-llm.ts (Haiku v2). Identical routing
 * logic and identical prompt — only the provider differs. Gated behind
 * ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true; never routes user-facing traffic.
 *
 * ──────────────────────────────────────────────────────
 * WHY CEREBRAS (AND NOT GROQ)?
 * ──────────────────────────────────────────────────────
 *
 * The 2026-04 Director research brief's experiment E1 originally named
 * Groq as the fastest OSS provider for the routing call. As of 2026-04-21,
 * **Groq's Developer tier is "temporarily unavailable due to high demand"**
 * and Free tier's ~6k TPM cap would 429 on real production traffic. The
 * Groq module (`director-llm-v3-groq.ts`) is kept in the tree for when
 * Developer tier reopens — migration is tracked in Linear SET-11 — but
 * Cerebras is the currently-available fast-provider path.
 *
 * Cerebras runs the *same* Llama 3.1 8B model as Groq. Provider numbers
 * (2026-04 brief):
 *   - TTFT ~100–440 ms (Groq: ~50–120 ms)
 *   - Throughput ~2,212 tok/s (Groq: ~567–619 tok/s)
 *   - Blended cost ~$0.10/M (Groq: ~$0.06/M)
 *
 * All within budget for the 400 ms Director tick. The migration back to
 * Groq is a 1-env-flip swap once the tier is open.
 *
 * ──────────────────────────────────────────────────────
 * DESIGN CONTRACT
 * ──────────────────────────────────────────────────────
 *
 *   pickPersonaCerebras(ctx) → Promise<LlmRoutingPick | null>
 *
 * - Resolves with a pick + rationale on success.
 * - Resolves with `null` on timeout, upstream error, malformed output,
 *   or when the returned persona id isn't one of the 4 archetype slots.
 * - NEVER throws.
 *
 * Used exclusively for shadow telemetry. The transcribe route fires this
 * in parallel with whichever Haiku call (v2 or v3) is active and logs a
 * `director_v3_shadow_compare` event with both picks + latencies.
 *
 * ──────────────────────────────────────────────────────
 * IMPLEMENTATION
 * ──────────────────────────────────────────────────────
 *
 * Raw fetch against Cerebras's OpenAI-compatible endpoint
 * (`https://api.cerebras.ai/v1/chat/completions`). No new SDK dep — same
 * pattern as xAI Grok calls elsewhere in the codebase. Keeps the shadow
 * path cheap to roll back if Cerebras turns out to have its own quirks.
 */

import { logPipeline } from "./debug-logger";
import {
  VALID_ARCHETYPE_IDS,
  ROUTING_SYSTEM_PROMPT,
  buildRoutingUserPrompt,
  extractFirstJsonObject,
  validatePick,
  type LlmRoutingPick,
} from "./director-llm";
import type { Persona } from "./personas";

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

/**
 * Context for the Cerebras v3 pick — mirrors PickPersonaCtxV3Groq so the
 * route can pass the same per-tick state to either shadow provider.
 */
export interface PickPersonaCtxV3Cerebras {
  recentTranscript: string;
  isSilence: boolean;
  recentFirings: string[];
  cooldownsMs: Record<string, number>;
  packPersonas: Persona[];
  /** Cerebras API key. Passed in so this file doesn't read env directly. */
  cerebrasKey: string;
  signal?: AbortSignal;
  sessionId?: string;
}

// ──────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────

const CEREBRAS_ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";

// Cerebras exposes Llama 3.1 8B as `llama3.1-8b`. Same weights Groq uses.
// If Cerebras renames the slug we'll see a 404 in the logs and can swap.
const CEREBRAS_MODEL = "llama3.1-8b";

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

/**
 * Ask Cerebras Llama 3.1 8B to pick the next persona using strict JSON
 * mode. Returns `null` on any failure path — timeout, upstream error,
 * malformed JSON, invalid id. Never throws. Used exclusively for shadow
 * telemetry; its result is logged but never fed to director.decide().
 */
export async function pickPersonaCerebras(
  ctx: PickPersonaCtxV3Cerebras
): Promise<LlmRoutingPick | null> {
  const started = Date.now();

  try {
    // Cerebras is OpenAI-compatible; the shape matches OpenAI chat/completions
    // with `response_format: { type: "json_object" }` for JSON mode.
    // buildRoutingUserPrompt accepts any object with the v2-shaped fields —
    // we pass ctx with an unused anthropicKey (it's typed away) because the
    // shared prompt helper only reads transcript / firings / cooldowns /
    // personas / isSilence.
    const res = await fetch(CEREBRAS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.cerebrasKey}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ROUTING_SYSTEM_PROMPT },
          {
            role: "user",
            content: buildRoutingUserPrompt({
              recentTranscript: ctx.recentTranscript,
              isSilence: ctx.isSilence,
              recentFirings: ctx.recentFirings,
              cooldownsMs: ctx.cooldownsMs,
              packPersonas: ctx.packPersonas,
            }),
          },
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
          status: res.status,
          elapsedMs: Date.now() - started,
          preview: body.slice(0, 200),
        },
      });
      return null;
    }

    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? "").trim();

    const jsonStr = extractFirstJsonObject(text) ?? text;
    if (!jsonStr) {
      logPipeline({
        event: "llm_director_v3_parse_fail",
        level: "warn",
        sessionId: ctx.sessionId,
        data: {
          reason: "no_json_object",
          provider: "cerebras",
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
          provider: "cerebras",
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
          provider: "cerebras",
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
        provider: "cerebras",
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
        model: CEREBRAS_MODEL,
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export { VALID_ARCHETYPE_IDS };
