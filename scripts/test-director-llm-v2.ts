#!/usr/bin/env tsx
/**
 * Unit tests for `lib/director-llm-v2.ts`.
 *
 * These are pure-logic checks — they don't call Anthropic. The expensive
 * shadow-test (real HTTP against Haiku) lives elsewhere and is opt-in via
 * `ANTHROPIC_API_KEY=… npm run shadow:director-v3`. This file runs every
 * time as part of `npm run check` alongside the fixture suite.
 *
 * Focus: the sticky-penalty math and confidence-vector normalization.
 * If these regress, production telemetry would still "look fine" but the
 * router would be silently biased — these are the cheap tripwires.
 */

import {
  applyStickyPenalty,
  computeUnstableTailLen,
  type ConfidenceVectorV2,
} from "../lib/director-llm-v2";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`\x1b[32m✓\x1b[0m ${msg}`);
    passed++;
  } else {
    console.log(`\x1b[31m✗\x1b[0m ${msg}`);
    failed++;
  }
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function vecSumsToOne(v: ConfidenceVectorV2): boolean {
  const s = v.producer + v.troll + v.soundfx + v.joker + v.silent;
  return approxEqual(s, 1, 1e-4);
}

// ─── Test 1: no recent firings = no penalty, argmax unchanged ───
{
  const v: ConfidenceVectorV2 = {
    producer: 0.1,
    troll: 0.5,
    soundfx: 0.1,
    joker: 0.2,
    silent: 0.1,
  };
  const r = applyStickyPenalty(v, []);
  assert(r.argmax === "troll", "no firings: argmax stays at highest (troll)");
  assert(vecSumsToOne(r.confidence), "no firings: output normalizes to 1");
}

// ─── Test 2: troll just fired = troll's confidence drops below alt ───
{
  const v: ConfidenceVectorV2 = {
    producer: 0.1,
    troll: 0.5,
    soundfx: 0.1,
    joker: 0.3,
    silent: 0.0,
  };
  const r = applyStickyPenalty(v, ["producer", "troll"]);
  assert(r.argmax === "joker", "troll fired last: argmax shifts to joker");
  assert(r.confidence.troll < v.troll, "troll confidence decreased");
  assert(vecSumsToOne(r.confidence), "output normalizes");
}

// ─── Test 3: troll fired twice in a row = compound penalty ───
{
  const v: ConfidenceVectorV2 = {
    producer: 0.05,
    troll: 0.7,
    soundfx: 0.05,
    joker: 0.2,
    silent: 0.0,
  };
  const r = applyStickyPenalty(v, ["troll", "troll"]);
  assert(
    r.confidence.troll < r.confidence.joker,
    "troll fired 2x: troll confidence falls below joker despite being raw argmax"
  );
}

// ─── Test 4: SILENT never penalized ───
{
  const v: ConfidenceVectorV2 = {
    producer: 0.15,
    troll: 0.15,
    soundfx: 0.15,
    joker: 0.15,
    silent: 0.4,
  };
  const r = applyStickyPenalty(v, ["silent" as unknown as string, "silent" as unknown as string]);
  // SILENT shouldn't be in recentFirings in practice, but even if it slips in,
  // the function should not penalize it (it's not in the persona branch of
  // the switch). This is a guardrail test.
  assert(r.confidence.silent >= v.silent - 1e-6, "SILENT is never penalized");
}

// ─── Test 5: most-recent penalty is stronger than older ones ───
{
  const v: ConfidenceVectorV2 = {
    producer: 0.25,
    troll: 0.25,
    soundfx: 0.25,
    joker: 0.25,
    silent: 0.0,
  };
  // producer fired two ticks ago; troll fired most recently
  const r = applyStickyPenalty(v, ["producer", "troll"]);
  assert(
    r.confidence.troll < r.confidence.producer,
    "most-recent speaker penalized harder than older one"
  );
}

// ─── SET-7: computeUnstableTailLen ───
//
// Finds the longest suffix of `previous` that's also a prefix of `current`,
// then returns how many chars of `current` are past that overlap. This is
// the sliding-window-friendly model: Deepgram's transcripts grow from the
// tail, and the Director's slice(-500) clips the head, so straight prefix
// matching wouldn't work across a window boundary.

// Empty previous → everything in current is unstable (first tick case).
assert(
  computeUnstableTailLen("hello world", "") === "hello world".length,
  "SET-7: empty previous returns full current length"
);

// Empty current → zero (nothing unstable when nothing exists).
assert(
  computeUnstableTailLen("", "anything") === 0,
  "SET-7: empty current returns 0"
);

// Pure prefix growth (the common Deepgram case — current = previous + new).
assert(
  computeUnstableTailLen("hello world and more", "hello world") === " and more".length,
  "SET-7: pure prefix growth returns suffix length"
);

// Fully stable — current === previous.
assert(
  computeUnstableTailLen("hello world", "hello world") === 0,
  "SET-7: identical strings return 0 (fully stable)"
);

// Sliding window — prev got its head clipped, current keeps growing.
// previous = "are you doing today"; current = "you doing today and more"
// Longest suffix of prev that's prefix of current = "you doing today" (15 chars).
// Unstable tail = " and more" (9 chars).
{
  const prev = "are you doing today";
  const curr = "you doing today and more";
  const expected = " and more".length;
  assert(
    computeUnstableTailLen(curr, prev) === expected,
    `SET-7: sliding window case returns ${expected}`
  );
}

// No overlap at all — transcripts fully diverged (rare, e.g. session reset).
// Longest matching suffix-of-prev ∩ prefix-of-current = "" → full current is unstable.
assert(
  computeUnstableTailLen("completely new content", "nothing in common here") === "completely new content".length,
  "SET-7: no overlap falls back to current.length"
);

// One-char overlap pathological case.
assert(
  computeUnstableTailLen("o world", "hello") === "o world".length - 1,
  "SET-7: minimal suffix overlap handled"
);

console.log();
console.log(`${passed}/${passed + failed} unit tests passed`);
process.exit(failed === 0 ? 0 : 1);
