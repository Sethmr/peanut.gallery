/**
 * Peanut Gallery — Session Highlight Picker (SET-24)
 *
 * Picks the single best "moment" from a session's persona fires.
 * Priority order:
 *   1. Pin wins — the user already decided; return immediately, no LLM call.
 *   2. Upvote shortlist — if multiple upvotes exist and a key is available,
 *      ask Haiku to pick the sharpest one; else fall back to most-recent upvote.
 *   3. No upvotes — score all fires by substance × diversity × recency-decay,
 *      send top-5 to Haiku if key available, else return the top scorer.
 *
 * Pure module — no side effects other than the optional Anthropic call and
 * structured debug logging. Never throws; returns null when entries is empty
 * or all LLM + rule paths fail.
 */

import Anthropic from "@anthropic-ai/sdk";

import { logPipeline } from "./debug-logger";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Shape of a single persona fire in the session feed.
 * Mirrors the JS object literal created in extension/sidepanel.js.
 */
export interface FeedEntry {
  id: string;
  personaId: string;
  role: string;
  text: string;
  timestamp: number;
  transcript: string;
}

export interface SessionHighlight {
  entryId: string;
  personaId: string;
  role: string;
  text: string;
  transcript: string;
  timestamp: number;
  /** One-sentence explanation of why this was picked — rendered in UI. */
  rationale: string;
  /** How the pick was made. */
  source: "upvote" | "rule" | "llm";
}

// ─────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────

interface ScoredEntry {
  entry: FeedEntry;
  score: number;
}

/**
 * Score each fire for "which moment is worth surfacing":
 *
 * - Substance: transcript length at that moment (longer = more was said).
 *   Capped at 800 chars so a single mega-monologue doesn't dominate.
 * - Persona-diversity bonus: fires from under-represented personas score
 *   slightly higher; avoids picking five consecutive joker responses.
 * - Recency-decay: prefer the middle of the session. Discount the first 3
 *   fires (cold-open chitchat) and the last 5 (sessions often trail off).
 *   Applied only when the session has >10 fires so short sessions aren't
 *   penalized.
 */
function scoreEntries(entries: FeedEntry[]): ScoredEntry[] {
  if (entries.length === 0) return [];

  const personaCounts: Record<string, number> = {};
  for (const e of entries) {
    personaCounts[e.personaId] = (personaCounts[e.personaId] ?? 0) + 1;
  }
  const uniquePersonas = Object.keys(personaCounts).length;

  const scored: ScoredEntry[] = entries.map((entry, idx) => {
    const substanceScore = Math.min(entry.transcript.length, 800) / 800;

    const personaFreq = personaCounts[entry.personaId] / entries.length;
    const diversityBonus = uniquePersonas > 1 ? 1 + (1 - personaFreq) * 0.4 : 1;

    let decayFactor = 1;
    if (entries.length > 10) {
      if (idx < 3) decayFactor = 0.7;
      else if (idx >= entries.length - 5) decayFactor = 0.6;
    }

    return { entry, score: substanceScore * diversityBonus * decayFactor };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────
// LLM PICK (Haiku, tool_use, strict entryId enum)
// ─────────────────────────────────────────────────────────────

/**
 * Ask Claude Haiku to pick the best highlight from a candidate list.
 *
 * Uses tool_use with a strict `enum` of valid entryIds so the model cannot
 * hallucinate an id that doesn't exist in the candidate set.
 *
 * Budget: max_tokens=200, temperature=0.3 (consistency > variety for a
 * deterministic editorial pick). At ~800 prompt tokens + 200 response,
 * each call costs roughly $0.0003 — negligible even for power users.
 *
 * Returns null on any failure path so the caller can fall back gracefully.
 */
async function pickWithLLM(
  candidates: FeedEntry[],
  anthropicKey: string,
  installId?: string
): Promise<SessionHighlight | null> {
  const started = Date.now();
  const validIds = candidates.map((e) => e.id);

  // Compact representation keeps the prompt under ~800 tokens total.
  const candidateJson = candidates.map((e) => ({
    entryId: e.id,
    persona: e.personaId,
    role: e.role,
    text: e.text,
    transcriptTail: e.transcript.slice(-400),
  }));

  const pickTool: Anthropic.Tool = {
    name: "pick_highlight",
    description:
      "Pick the single best highlight moment from the candidate list. " +
      "Return the entryId of the most shareable moment and a one-sentence rationale.",
    input_schema: {
      type: "object",
      properties: {
        entryId: {
          type: "string",
          enum: validIds,
          description: "entryId of the chosen moment — must be one of the listed ids.",
        },
        rationale: {
          type: "string",
          description: "One sentence: why this moment makes the best shareable card.",
        },
      },
      required: ["entryId", "rationale"],
    } as Anthropic.Tool["input_schema"],
  };

  try {
    const client = new Anthropic({ apiKey: anthropicKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      temperature: 0.3,
      system:
        "You are the editor of a podcast's highlight reel. " +
        "Pick the ONE moment that would make the best shareable card. " +
        "Prioritize clarity, humor, or genuine surprise over volume. " +
        "Return a tool call with the entryId.",
      tools: [pickTool],
      tool_choice: { type: "tool", name: "pick_highlight" },
      messages: [
        {
          role: "user",
          content:
            `Pick the best highlight from these ${candidates.length} candidates:\n\n` +
            JSON.stringify(candidateJson, null, 2),
        },
      ],
    });

    const toolBlock = response.content.find(
      (b) => b.type === "tool_use" && b.name === "pick_highlight"
    );
    if (!toolBlock || toolBlock.type !== "tool_use") {
      logPipeline({
        event: "highlight_picker_llm_no_tool_use",
        level: "warn",
        data: { elapsedMs: Date.now() - started, installId },
      });
      return null;
    }

    const input = toolBlock.input as Record<string, unknown>;
    const entryId = input.entryId;
    const rationaleRaw = input.rationale;

    if (typeof entryId !== "string" || !validIds.includes(entryId)) {
      logPipeline({
        event: "highlight_picker_llm_invalid_id",
        level: "warn",
        data: { entryId, elapsedMs: Date.now() - started, installId },
      });
      return null;
    }

    const entry = candidates.find((e) => e.id === entryId);
    if (!entry) return null;

    const rationale =
      typeof rationaleRaw === "string" && rationaleRaw.trim().length > 0
        ? rationaleRaw.trim().slice(0, 240)
        : "LLM-selected highlight.";

    logPipeline({
      event: "highlight_picker_llm_pick",
      level: "info",
      data: {
        entryId,
        rationale,
        candidateCount: candidates.length,
        elapsedMs: Date.now() - started,
        installId,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    });

    return {
      entryId: entry.id,
      personaId: entry.personaId,
      role: entry.role,
      text: entry.text,
      transcript: entry.transcript,
      timestamp: entry.timestamp,
      rationale,
      source: "llm",
    };
  } catch (err) {
    logPipeline({
      event: "highlight_picker_llm_error",
      level: "warn",
      data: {
        elapsedMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
        installId,
      },
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * Pick the single best highlight from a session's persona fires.
 *
 * Algorithm (priority order):
 *   1. **Pin wins.** `pinnedId` set → return that entry immediately.
 *   2. **Upvote shortlist.** Any upvotes → LLM picks the sharpest (if key
 *      provided) or fall back to the most-recent upvoted entry.
 *   3. **No upvotes.** Score all fires by substance × diversity × decay,
 *      send top-5 to LLM (if key provided) or return highest-scored.
 *
 * Never throws. Returns null only when `entries` is empty.
 */
export async function pickSessionHighlight(params: {
  /** All persona fires from the session. */
  entries: FeedEntry[];
  /** Vote map from pgVotes_<sessionId>. */
  votes: Record<string, "up" | "down">;
  /** If set, this entry wins unconditionally (user already decided). */
  pinnedId?: string | null;
  /** Optional Anthropic API key — enables LLM tie-breaking. */
  anthropicKey?: string;
  /** Optional install id for log correlation. */
  installId?: string;
  /**
   * Injected in unit tests only — replaces the Haiku call so tests run
   * without a real API key. Prefixed `_` to signal test-only usage.
   */
  _llmPickerOverride?: (
    candidates: FeedEntry[],
    key: string,
    installId?: string
  ) => Promise<SessionHighlight | null>;
}): Promise<SessionHighlight | null> {
  const { entries, votes, pinnedId, anthropicKey, installId } = params;
  const llmPicker = params._llmPickerOverride ?? pickWithLLM;

  if (entries.length === 0) return null;

  /** Inline helper to avoid repeating the shape construction. */
  function toHighlight(
    entry: FeedEntry,
    source: SessionHighlight["source"],
    rationale: string
  ): SessionHighlight {
    return {
      entryId: entry.id,
      personaId: entry.personaId,
      role: entry.role,
      text: entry.text,
      transcript: entry.transcript,
      timestamp: entry.timestamp,
      rationale,
      source,
    };
  }

  // ── 1. Pin wins ─────────────────────────────────────────────
  if (pinnedId) {
    const pinned = entries.find((e) => e.id === pinnedId);
    if (pinned) {
      return toHighlight(pinned, "rule", "User pinned this moment during the session.");
    }
  }

  // ── 2. Upvote shortlist ──────────────────────────────────────
  const upvoted = entries.filter((e) => votes[e.id] === "up");

  if (upvoted.length > 0) {
    if (upvoted.length === 1) {
      return toHighlight(upvoted[0], "upvote", "Only upvoted moment in the session.");
    }
    if (anthropicKey) {
      const llmPick = await llmPicker(upvoted, anthropicKey, installId);
      if (llmPick) return llmPick;
    }
    // No key or LLM failed: return most-recent upvote
    const latest = upvoted.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    return toHighlight(latest, "upvote", "Latest upvoted moment.");
  }

  // ── 3. No upvotes: scored pass ───────────────────────────────
  const scored = scoreEntries(entries);
  if (scored.length === 0) return null;

  const top5 = scored.slice(0, 5).map((s) => s.entry);

  if (anthropicKey) {
    const llmPick = await llmPicker(top5, anthropicKey, installId);
    if (llmPick) return llmPick;
  }

  return toHighlight(
    scored[0].entry,
    "rule",
    "Highest-scored moment by transcript length and session balance."
  );
}
