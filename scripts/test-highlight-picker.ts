#!/usr/bin/env tsx
/**
 * Unit tests for `lib/highlight-picker.ts` (SET-24).
 *
 * Four paths are exercised:
 *   A. Pin wins    — pinnedId set → immediate return, no LLM.
 *   B. Upvote-only — single/multiple upvotes, no Anthropic key.
 *   C. Upvote+LLM  — multiple upvotes + mocked Anthropic client.
 *   D. No-upvote fallback — rule-based scorer over 60-fire session.
 *
 * No real HTTP calls are made. The Anthropic SDK is monkey-patched with a
 * minimal mock that returns a deterministic tool_use block.
 */

import { pickSessionHighlight, type FeedEntry, type SessionHighlight } from "../lib/highlight-picker";

// ─────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
    passed++;
  } else {
    console.log(`\x1b[31m✗\x1b[0m ${msg}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  assert(actual === expected, `${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

// ─────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────

function makeEntry(id: string, personaId: string, role: string, timestamp: number, transcriptLen = 200): FeedEntry {
  return {
    id,
    personaId,
    role,
    text: `Response from ${personaId} — entry ${id}`,
    timestamp,
    transcript: "x".repeat(transcriptLen),
  };
}

/** Build a session with N fires across 4 personas. */
function makeSession(n: number): FeedEntry[] {
  const personas = ["producer", "troll", "soundfx", "joker"];
  return Array.from({ length: n }, (_, i) =>
    makeEntry(
      `entry-${i}`,
      personas[i % 4],
      personas[i % 4],
      1_000_000 + i * 10_000,
      100 + (i * 13) % 700 // varied transcript lengths
    )
  );
}

// ─────────────────────────────────────────────────────────────
// LLM MOCK FACTORY
// ─────────────────────────────────────────────────────────────

/**
 * Returns a `_llmPickerOverride` function that returns the given entryId
 * (or the first candidate's id if not specified). Injected via the
 * `_llmPickerOverride` param on `pickSessionHighlight` — no SDK patching needed.
 */
function makeMockLlmPicker(overrideEntryId?: string) {
  return async (candidates: FeedEntry[]): Promise<SessionHighlight | null> => {
    const chosen = candidates.find((e) => e.id === overrideEntryId) ?? candidates[0];
    if (!chosen) return null;
    return {
      entryId: chosen.id,
      personaId: chosen.personaId,
      role: chosen.role,
      text: chosen.text,
      transcript: chosen.transcript,
      timestamp: chosen.timestamp,
      rationale: "Mock LLM pick for unit test.",
      source: "llm",
    };
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN (async wrapper required — top-level await unsupported in CJS)
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── A: PIN WINS ──────────────────────────────────────────────
  console.log("\n── A: Pin wins ──");
  {
    const entries = makeSession(10);
    const pinnedId = "entry-7";

    const result = await pickSessionHighlight({ entries, votes: {}, pinnedId });

    assert(result !== null, "A1: returns non-null when pinned");
    assertEq(result?.entryId, pinnedId, "A2: entryId matches pinnedId");
    assertEq(result?.source, "rule", "A3: source is 'rule' for pin");
    assert(
      result?.rationale.toLowerCase().includes("pinned") ?? false,
      "A4: rationale mentions pin"
    );
  }

  // Pin wins even when upvotes and a key exist
  {
    const entries = makeSession(10);
    const pinnedId = "entry-3";
    const votes: Record<string, "up" | "down"> = {
      "entry-0": "up",
      "entry-1": "up",
      "entry-3": "up",
    };

    const result = await pickSessionHighlight({
      entries,
      votes,
      pinnedId,
      anthropicKey: "mock-key",
      _llmPickerOverride: makeMockLlmPicker(),
    });

    assertEq(result?.entryId, pinnedId, "A5: pin overrides upvotes + LLM key");
    assertEq(result?.source, "rule", "A6: pin source is always 'rule'");
  }

  // ── B: UPVOTE-ONLY (no Anthropic key) ────────────────────────
  console.log("\n── B: Upvote-only (no key) ──");
  {
    const entries = makeSession(10);
    const votes: Record<string, "up" | "down"> = { "entry-4": "up" };

    const result = await pickSessionHighlight({ entries, votes });

    assert(result !== null, "B1: single upvote returns non-null");
    assertEq(result?.entryId, "entry-4", "B2: picks the only upvoted entry");
    assertEq(result?.source, "upvote", "B3: source is 'upvote'");
    assert(
      result?.rationale.toLowerCase().includes("only") ?? false,
      "B4: rationale mentions 'only'"
    );
  }

  {
    // Multiple upvotes, no key → returns most-recent
    const entries = makeSession(10);
    const votes: Record<string, "up" | "down"> = {
      "entry-2": "up",
      "entry-6": "up",
      "entry-8": "up",
    };

    const result = await pickSessionHighlight({ entries, votes });

    assert(result !== null, "B5: multiple upvotes no-key returns non-null");
    assertEq(result?.entryId, "entry-8", "B6: picks most-recent when no key");
    assertEq(result?.source, "upvote", "B7: source is 'upvote'");
    assert(
      result?.rationale.toLowerCase().includes("latest") ?? false,
      "B8: rationale mentions 'latest'"
    );
  }

  // ── C: UPVOTE + LLM ──────────────────────────────────────────
  console.log("\n── C: Upvote + LLM ──");
  {
    const entries = makeSession(10);
    const votes: Record<string, "up" | "down"> = {
      "entry-2": "up",
      "entry-6": "up",
      "entry-8": "up",
    };

    const result = await pickSessionHighlight({
      entries,
      votes,
      anthropicKey: "mock-key",
      _llmPickerOverride: makeMockLlmPicker("entry-6"),
    });

    assert(result !== null, "C1: upvote+LLM returns non-null");
    assertEq(result?.entryId, "entry-6", "C2: LLM pick is respected");
    assertEq(result?.source, "llm", "C3: source is 'llm'");
    assert(
      typeof result?.rationale === "string" && result.rationale.length > 0,
      "C4: rationale is non-empty string"
    );
  }

  // LLM returns null (simulates failure) → fall back to most-recent upvote
  {
    const entries = makeSession(10);
    const votes: Record<string, "up" | "down"> = { "entry-2": "up", "entry-6": "up" };

    const result = await pickSessionHighlight({
      entries,
      votes,
      anthropicKey: "mock-key",
      _llmPickerOverride: async () => null, // simulates LLM failure / hallucinated id
    });

    assert(result !== null, "C5: fallback fires when LLM returns null");
    assertEq(result?.source, "upvote", "C6: fallback source is 'upvote'");
    assertEq(result?.entryId, "entry-6", "C7: fallback picks most-recent upvote");
  }

  // ── D: NO UPVOTES — RULE-BASED FALLBACK ──────────────────────
  console.log("\n── D: No-upvote rule-based fallback ──");
  {
    const entries = makeSession(60); // 60-fire session
    const result = await pickSessionHighlight({ entries, votes: {} });

    assert(result !== null, "D1: 60-fire session returns non-null");
    assertEq(result?.source, "rule", "D2: source is 'rule' without key");
    assert(
      typeof result?.entryId === "string" && result.entryId.startsWith("entry-"),
      "D3: entryId is a real entry from the session"
    );
    assert(
      result?.rationale.toLowerCase().includes("scored") ||
        result?.rationale.toLowerCase().includes("highest") ||
        result?.rationale.toLowerCase().includes("transcript") ||
        result?.rationale.toLowerCase().includes("balance"),
      "D4: rationale mentions scoring rationale"
    );

    // Picked entry should not be cold-open or tail when session is long enough
    const pickedIdx = entries.findIndex((e) => e.id === result?.entryId);
    assert(
      pickedIdx >= 3 && pickedIdx < entries.length - 5,
      `D5: picked entry (idx=${pickedIdx}) is in the mid-session sweet spot`
    );
  }

  // No upvotes + LLM key — mock picks the first of the top-5 candidates
  {
    const entries = makeSession(60);
    let capturedFirst: string | undefined;
    const result = await pickSessionHighlight({
      entries,
      votes: {},
      anthropicKey: "mock-key",
      _llmPickerOverride: async (candidates) => {
        capturedFirst = candidates[0]?.id;
        return makeMockLlmPicker(capturedFirst)(candidates);
      },
    });

    assert(result !== null, "D6: no-upvote LLM path returns non-null");
    assertEq(result?.source, "llm", "D7: source is 'llm' with key");
    assertEq(result?.entryId, capturedFirst ?? "", "D8: LLM pick matches first top-5 candidate");
  }

  // Empty session returns null
  {
    const result = await pickSessionHighlight({ entries: [], votes: {} });
    assert(result === null, "D9: empty entries returns null");
  }
}

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────

main()
  .then(() => {
    console.log(
      `\n${passed + failed} tests: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m`
    );
    if (failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  });
