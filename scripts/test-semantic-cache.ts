#!/usr/bin/env tsx
/**
 * Peanut Gallery — SemanticCache unit tests
 *
 * Tests SemanticCache.cosineSimilarity with known vector pairs. These are pure
 * math — no API calls, no env vars, no async. Runs as part of `npm run check`.
 *
 * Why test this explicitly? cosineSimilarity is the single point of failure for
 * the entire semantic anti-repeat feature (SET-15). A sign error or an off-by-
 * one in the normalization would silently flag everything (maxSim ≈ 1.0 always)
 * or nothing (maxSim ≈ 0 always), and neither would be obvious from logs alone.
 */

import { SemanticCache } from "../lib/semantic-cache";

let passed = 0;
let failed = 0;

function assert(
  label: string,
  got: number,
  expected: number,
  tolerance = 1e-6
): void {
  const ok = Math.abs(got - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓ ${label} (got ${got.toFixed(8)})`);
    passed++;
  } else {
    console.error(
      `  ✗ ${label}: expected ${expected} ± ${tolerance}, got ${got.toFixed(8)}`
    );
    failed++;
  }
}

console.log("\nSemanticCache.cosineSimilarity");

// ── identical vectors → similarity = 1.0 ──
assert(
  "identical unit vectors",
  SemanticCache.cosineSimilarity([1, 0, 0], [1, 0, 0]),
  1.0
);

assert(
  "identical non-unit vectors",
  SemanticCache.cosineSimilarity([3, 4, 0], [3, 4, 0]),
  1.0
);

// ── orthogonal vectors → similarity = 0.0 ──
assert(
  "orthogonal vectors",
  SemanticCache.cosineSimilarity([1, 0, 0], [0, 1, 0]),
  0.0
);

// ── opposite vectors → similarity = -1.0 ──
assert(
  "opposite unit vectors",
  SemanticCache.cosineSimilarity([1, 0, 0], [-1, 0, 0]),
  -1.0
);

// ── known 45° angle → cos(45°) = √2/2 ≈ 0.7071 ──
const cos45 = Math.SQRT2 / 2;
assert(
  "45° angle (cos ≈ 0.7071)",
  SemanticCache.cosineSimilarity([1, 0], [1, 1]),
  cos45,
  1e-6
);

// ── zero vector → should return 0 (guard against NaN/division by zero) ──
assert(
  "zero vector a",
  SemanticCache.cosineSimilarity([0, 0, 0], [1, 2, 3]),
  0.0
);

assert(
  "zero vector b",
  SemanticCache.cosineSimilarity([1, 2, 3], [0, 0, 0]),
  0.0
);

assert(
  "both zero vectors",
  SemanticCache.cosineSimilarity([0, 0], [0, 0]),
  0.0
);

// ── empty arrays → should return 0 (guard for malformed embeddings) ──
assert("empty arrays", SemanticCache.cosineSimilarity([], []), 0.0);

// ── mismatched lengths → should return 0 ──
assert(
  "mismatched lengths",
  SemanticCache.cosineSimilarity([1, 2], [1, 2, 3]),
  0.0
);

// ── known 3-vector similarity: [1,2,3] vs [4,5,6] ──
// dot = 4+10+18 = 32; |a| = √14; |b| = √77; cos = 32/√(14*77) = 32/√1078
const expected3d = 32 / Math.sqrt(14 * 77);
assert(
  "[1,2,3] vs [4,5,6]",
  SemanticCache.cosineSimilarity([1, 2, 3], [4, 5, 6]),
  expected3d,
  1e-6
);

// ── symmetry: sim(a, b) === sim(b, a) ──
const simAB = SemanticCache.cosineSimilarity([1, 2, 3], [4, 5, 6]);
const simBA = SemanticCache.cosineSimilarity([4, 5, 6], [1, 2, 3]);
assert("symmetry sim(a,b) === sim(b,a)", simAB - simBA, 0.0);

// ── values stay in [-1, 1] ──
const vectors = [
  [0.12, -0.34, 0.78],
  [-0.9, 0.01, 0.44],
  [1000, 2000, 3000],
  [-1, -1, -1],
];
for (let i = 0; i < vectors.length; i++) {
  for (let j = i + 1; j < vectors.length; j++) {
    const s = SemanticCache.cosineSimilarity(vectors[i], vectors[j]);
    const label = `range check vec[${i}] vs vec[${j}]`;
    if (s >= -1.0 - 1e-9 && s <= 1.0 + 1e-9) {
      console.log(`  ✓ ${label} (${s.toFixed(4)} in [-1,1])`);
      passed++;
    } else {
      console.error(`  ✗ ${label}: ${s} is out of [-1, 1]`);
      failed++;
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
