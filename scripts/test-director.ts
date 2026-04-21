#!/usr/bin/env tsx
/**
 * Peanut Gallery — Director test harness
 *
 * Runs each JSON fixture under scripts/fixtures/director/ against a fresh
 * Director N times (default 50) and asserts on distribution + structural
 * invariants. Exits 0 on a clean pass, non-zero on any fixture failure.
 *
 * Why distribution-based assertions? The Director uses Math.random() for
 * tiebreaks, cascade rolls, and remaining-persona shuffle. Any single run
 * can be unlucky. Running each fixture 50+ times and asserting thresholds
 * (e.g. "pick is Baba in ≥ 90% of runs") catches real regressions without
 * flaking on RNG noise.
 *
 * Usage:
 *   npx tsx scripts/test-director.ts
 *   npx tsx scripts/test-director.ts --fixture baba-booey-fact-driven
 *   npx tsx scripts/test-director.ts --runs 200
 *   npx tsx scripts/test-director.ts --pack twist    // only TWiST fixtures
 *   npx tsx scripts/test-director.ts --pack howard   // only Howard fixtures
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { Director, type TriggerDecision } from "../lib/director";

// ──────────────────────────────────────────────────────
// FIXTURE SCHEMA
// Mirrors docs/V1.2-PLAN.md §6.2. New fields are additive.
// ──────────────────────────────────────────────────────

interface DirectorFixture {
  name: string;
  description: string;
  /**
   * Optional pack id this fixture targets (v1.3+). The Director is
   * pack-agnostic — it only sees archetype slots (producer/troll/soundfx/joker)
   * — so the `pack` field doesn't change runtime behavior. It exists so the
   * harness can filter by pack (e.g. `--pack twist`) and so a failing fixture
   * can be traced back to the transcript vocabulary that drove it.
   *
   * Fixtures without this field default to "howard" (back-compat with the
   * pre-v1.3 suite). No existing fixture needs to be edited.
   */
  pack?: string;
  initialState?: {
    recentFirings?: string[];
    cyclesSinceFire?: Record<string, number>;
    lastFiredAt?: Record<string, number>;
  };
  input: {
    transcript: string;
    isSilence?: boolean;
    sessionId?: string;
    /**
     * v1.5 (Smart Director v2): pre-computed LLM pick handed directly to
     * `Director.decide`. Fixtures can't actually call Anthropic from the
     * harness — they inject a synthetic pick to exercise the llm-assisted
     * code path deterministically. When omitted, the Director falls back
     * to the rule-based scorer (same shape as a production LLM timeout).
     */
    llmPick?: { personaId: string; rationale: string };
    /**
     * v1.7 (Smart Director v3, experimental): pre-computed v3 pick. Shape
     * mirrors the real router's output including the SILENT slot and
     * optional callbackUsed. When `personaId === "silent"` the Director
     * returns an empty chain and stamps source="silent-llm".
     */
    llmPickV2?: {
      personaId: "producer" | "troll" | "soundfx" | "joker" | "silent";
      rationale: string;
      callbackUsed?: string | null;
    };
    /**
     * v1.7: seed the Director's live-callback ring buffer. Each string is
     * push()'d in order before decide() runs, so fixtures can validate
     * callback-aware behavior deterministically.
     */
    liveCallbacks?: string[];
    /**
     * v1.7: per-persona recent-fallback counts threaded into
     * DecideOptions.recentFallbackCounts. Lets fixtures validate the
     * RECENT_FALLBACK_PENALTY without instantiating a PersonaEngine.
     */
    recentFallbackCounts?: Record<string, number>;
  };
  assertions: {
    // pick constraints
    pickIn?: string[];
    pickInRatio?: number;         // default 0.95
    pickNot?: string[];            // strict — never
    // chain constraints
    chainMaxLength?: number;
    chainMinLength?: number;
    cascadeLenExact?: number;
    cascadeLenMax?: number;        // v1.7: soft cap over distribution
    mustFirePersona?: string;
    mustFireRatio?: number;        // default 0.80
    mustNotFire?: string;          // strict — never
    // reason constraints
    reasonContains?: string;
    // v1.5: decision.source must equal one of these. Strict — checked every run.
    // v1.7: "silent-llm" joins the union for SILENT-slot fixtures.
    sourceIn?: Array<"rule" | "llm" | "silent-llm">;
    /** v1.7: chain must be empty (SILENT picks). Strict. */
    chainEmpty?: boolean;
    // structural invariants
    delaysMonotonic?: boolean;     // strict
    delaysFirstZero?: boolean;     // strict
    returnShapeComplete?: boolean; // strict — score, top3, cooldownsMs present
    // multi-run constraints
    variance?: {                   // fires decide() twice, asserts chains differ
      runs: number;                // fraction of runs where second chain != first
      minDifferentRatio: number;   // e.g. 0.5
      secondInput?: {              // optional second transcript; defaults to input.transcript
        transcript: string;
        isSilence?: boolean;
      };
    };
  };
  runs?: number; // overrides CLI --runs
}

// Private-field backdoor so we can seed Director state without adding a
// test-mode hook to the production class. The plan says "No 'test mode' flag"
// — poking private state from the harness keeps Director's public API clean.
type DirectorPrivate = Director & {
  recentFirings: string[];
  cyclesSinceFire: Record<string, number>;
  lastFiredAt: Record<string, number>;
};

// ──────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DEFAULT_RUNS = (() => {
  const idx = args.indexOf("--runs");
  if (idx === -1) return 50;
  const n = Number.parseInt(args[idx + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();
const FILTER_NAME = (() => {
  const idx = args.indexOf("--fixture");
  return idx === -1 ? null : args[idx + 1];
})();
// --pack <id> (v1.3): filter fixtures whose pack field matches. Fixtures
// without a pack field default to "howard", so `--pack howard` covers both
// explicit "howard" and the legacy (untagged) fixtures. Unknown pack ids
// produce zero matches and exit 1, which is the right behavior for CI.
const FILTER_PACK = (() => {
  const idx = args.indexOf("--pack");
  if (idx === -1) return null;
  const raw = args[idx + 1];
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
})();
const VERBOSE = args.includes("--verbose");

const FIXTURES_DIR = join(__dirname, "fixtures", "director");

// ──────────────────────────────────────────────────────
// HARNESS
// ──────────────────────────────────────────────────────

function loadFixtures(): DirectorFixture[] {
  let files: string[];
  try {
    files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error(`No fixtures directory at ${FIXTURES_DIR}`);
    console.error(`Expected JSON fixtures per docs/V1.2-PLAN.md §6.3.`);
    throw err;
  }
  const fixtures: DirectorFixture[] = [];
  for (const file of files) {
    const raw = readFileSync(join(FIXTURES_DIR, file), "utf-8");
    let parsed: DirectorFixture;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Failed to parse ${file}: ${(err as Error).message}`);
    }
    fixtures.push(parsed);
  }
  return fixtures.sort((a, b) => a.name.localeCompare(b.name));
}

function seedDirector(fixture: DirectorFixture): Director {
  const d = new Director() as DirectorPrivate;
  const state = fixture.initialState;
  if (state) {
    if (Array.isArray(state.recentFirings)) {
      d.recentFirings = [...state.recentFirings];
    }
    if (state.cyclesSinceFire) {
      for (const [id, n] of Object.entries(state.cyclesSinceFire)) {
        d.cyclesSinceFire[id] = n;
      }
    }
    if (state.lastFiredAt) {
      for (const [id, t] of Object.entries(state.lastFiredAt)) {
        d.lastFiredAt[id] = t;
      }
    }
  }
  // v1.7: seed live-callback ring buffer from fixture.input.liveCallbacks
  // so callback-aware fixtures are deterministic.
  if (Array.isArray(fixture.input.liveCallbacks)) {
    for (const phrase of fixture.input.liveCallbacks) {
      d.addLiveCallback(phrase);
    }
  }
  return d;
}

function buildOpts(fixture: DirectorFixture):
  | {
      llmPick?: { personaId: string; rationale: string };
      llmPickV2?: {
        personaId: "producer" | "troll" | "soundfx" | "joker" | "silent";
        rationale: string;
        callbackUsed?: string | null;
      };
      recentFallbackCounts?: Record<string, number>;
    }
  | undefined {
  const opts: {
    llmPick?: { personaId: string; rationale: string };
    llmPickV2?: {
      personaId: "producer" | "troll" | "soundfx" | "joker" | "silent";
      rationale: string;
      callbackUsed?: string | null;
    };
    recentFallbackCounts?: Record<string, number>;
  } = {};
  if (fixture.input.llmPick) opts.llmPick = fixture.input.llmPick;
  if (fixture.input.llmPickV2) opts.llmPickV2 = fixture.input.llmPickV2;
  if (fixture.input.recentFallbackCounts) {
    opts.recentFallbackCounts = fixture.input.recentFallbackCounts;
  }
  return Object.keys(opts).length > 0 ? opts : undefined;
}

interface RunRecord {
  decision: TriggerDecision;
  failures: string[];
}

function strictChecks(fixture: DirectorFixture, decision: TriggerDecision): string[] {
  const fail: string[] = [];
  const a = fixture.assertions;

  if (a.pickNot && a.pickNot.includes(decision.personaIds[0])) {
    fail.push(`pickNot violated: got pick=${decision.personaIds[0]}`);
  }
  if (a.chainMaxLength !== undefined && decision.personaIds.length > a.chainMaxLength) {
    fail.push(`chainMaxLength violated: got ${decision.personaIds.length} > ${a.chainMaxLength}`);
  }
  if (a.chainMinLength !== undefined && decision.personaIds.length < a.chainMinLength) {
    fail.push(`chainMinLength violated: got ${decision.personaIds.length} < ${a.chainMinLength}`);
  }
  if (a.cascadeLenExact !== undefined && decision.personaIds.length !== a.cascadeLenExact) {
    fail.push(`cascadeLenExact violated: got ${decision.personaIds.length} !== ${a.cascadeLenExact}`);
  }
  if (a.cascadeLenMax !== undefined && decision.personaIds.length > a.cascadeLenMax) {
    fail.push(`cascadeLenMax violated: got ${decision.personaIds.length} > ${a.cascadeLenMax}`);
  }
  if (a.chainEmpty && decision.personaIds.length !== 0) {
    fail.push(`chainEmpty violated: got chain=[${decision.personaIds.join(",")}]`);
  }
  if (a.mustNotFire && decision.personaIds.includes(a.mustNotFire)) {
    fail.push(`mustNotFire violated: ${a.mustNotFire} appeared in chain`);
  }
  if (a.reasonContains && !decision.reason.includes(a.reasonContains)) {
    fail.push(`reasonContains violated: reason="${decision.reason}" missing "${a.reasonContains}"`);
  }
  if (a.sourceIn && a.sourceIn.length > 0) {
    const got = decision.source ?? "rule";
    if (!a.sourceIn.includes(got)) {
      fail.push(`sourceIn violated: got source="${got}", expected one of [${a.sourceIn.join(",")}]`);
    }
  }
  if (a.delaysFirstZero && decision.delays.length > 0 && decision.delays[0] !== 0) {
    fail.push(`delaysFirstZero violated: got ${decision.delays[0]}`);
  }
  if (a.delaysMonotonic) {
    for (let i = 1; i < decision.delays.length; i++) {
      if (decision.delays[i] < decision.delays[i - 1]) {
        fail.push(`delaysMonotonic violated at index ${i}: ${decision.delays[i - 1]} → ${decision.delays[i]}`);
        break;
      }
    }
  }
  if (a.returnShapeComplete) {
    if (typeof decision.score !== "number") fail.push(`returnShapeComplete: score missing`);
    // v1.7: a silent-llm pick legitimately returns an empty top3 (no one
    // was scored). Only enforce top3-non-empty when the chain fired.
    if (decision.source !== "silent-llm") {
      if (!Array.isArray(decision.top3) || decision.top3.length === 0) fail.push(`returnShapeComplete: top3 missing/empty`);
    } else if (!Array.isArray(decision.top3)) {
      fail.push(`returnShapeComplete: top3 must be an array (empty ok for silent-llm)`);
    }
    if (!decision.cooldownsMs || typeof decision.cooldownsMs !== "object") fail.push(`returnShapeComplete: cooldownsMs missing`);
  }
  return fail;
}

function distributionChecks(
  fixture: DirectorFixture,
  records: RunRecord[]
): string[] {
  const fail: string[] = [];
  const a = fixture.assertions;
  const total = records.length;

  if (a.pickIn && a.pickIn.length > 0) {
    const ratio = records.filter((r) => a.pickIn!.includes(r.decision.personaIds[0])).length / total;
    const threshold = a.pickInRatio ?? 0.95;
    if (ratio < threshold) {
      fail.push(
        `pickIn ratio too low: ${(ratio * 100).toFixed(1)}% in {${a.pickIn.join(",")}} < ${(threshold * 100).toFixed(0)}%`
      );
    }
  }
  if (a.mustFirePersona) {
    const ratio = records.filter((r) => r.decision.personaIds.includes(a.mustFirePersona!)).length / total;
    const threshold = a.mustFireRatio ?? 0.80;
    if (ratio < threshold) {
      fail.push(
        `mustFirePersona ${a.mustFirePersona} ratio too low: ${(ratio * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%`
      );
    }
  }
  return fail;
}

function varianceCheck(fixture: DirectorFixture): string[] {
  const v = fixture.assertions.variance;
  if (!v) return [];
  let differentCount = 0;
  for (let i = 0; i < v.runs; i++) {
    const d = seedDirector(fixture);
    const opts = buildOpts(fixture);
    const a = d.decide(
      fixture.input.transcript,
      fixture.input.isSilence ?? false,
      undefined,
      opts
    );
    const secondInput = v.secondInput ?? fixture.input;
    const b = d.decide(
      secondInput.transcript,
      secondInput.isSilence ?? false,
      undefined,
      opts
    );
    // "Different chain" = either different primary OR different cascade length
    // OR different membership. Cheap stringify is fine for 50-200 runs.
    if (JSON.stringify(a.personaIds) !== JSON.stringify(b.personaIds)) {
      differentCount++;
    }
  }
  const ratio = differentCount / v.runs;
  if (ratio < v.minDifferentRatio) {
    return [
      `variance: only ${(ratio * 100).toFixed(1)}% of paired runs produced different chains, need ≥ ${(v.minDifferentRatio * 100).toFixed(0)}%`,
    ];
  }
  return [];
}

interface FixtureResult {
  name: string;
  pass: boolean;
  runs: number;
  failures: string[];
  details: string[];
}

function runFixture(fixture: DirectorFixture): FixtureResult {
  const failures: string[] = [];
  const details: string[] = [];
  const runCount = fixture.runs ?? DEFAULT_RUNS;

  // Per-run strict checks
  const records: RunRecord[] = [];
  const perRunFailures: Record<string, number> = {};
  for (let i = 0; i < runCount; i++) {
    const d = seedDirector(fixture);
    const decision = d.decide(
      fixture.input.transcript,
      fixture.input.isSilence ?? false,
      fixture.input.sessionId,
      buildOpts(fixture)
    );
    const runFail = strictChecks(fixture, decision);
    for (const msg of runFail) perRunFailures[msg] = (perRunFailures[msg] ?? 0) + 1;
    records.push({ decision, failures: runFail });
  }

  // Strict assertions must hold EVERY run. If any did fail, aggregate.
  for (const [msg, count] of Object.entries(perRunFailures)) {
    failures.push(`strict [${count}/${runCount} runs]: ${msg}`);
  }

  // Distribution assertions.
  failures.push(...distributionChecks(fixture, records));

  // Variance (paired runs).
  failures.push(...varianceCheck(fixture));

  // Tally some details for human-readable output.
  const picks: Record<string, number> = {};
  let chainLenSum = 0;
  for (const r of records) {
    picks[r.decision.personaIds[0]] = (picks[r.decision.personaIds[0]] ?? 0) + 1;
    chainLenSum += r.decision.personaIds.length;
  }
  const picksSorted = Object.entries(picks)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id}:${((n / runCount) * 100).toFixed(0)}%`)
    .join(" ");
  details.push(`picks → ${picksSorted}`);
  details.push(`avg chain length → ${(chainLenSum / runCount).toFixed(2)}`);

  return {
    name: fixture.name,
    pass: failures.length === 0,
    runs: runCount,
    failures,
    details,
  };
}

// ──────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────

function main() {
  const allFixtures = loadFixtures();

  let fixtures = allFixtures;
  if (FILTER_PACK) {
    fixtures = fixtures.filter((f) => (f.pack ?? "howard") === FILTER_PACK);
  }
  if (FILTER_NAME) {
    fixtures = fixtures.filter(
      (f) => f.name === FILTER_NAME || f.name.includes(FILTER_NAME)
    );
  }

  if (fixtures.length === 0) {
    const parts: string[] = [];
    if (FILTER_PACK) parts.push(`pack="${FILTER_PACK}"`);
    if (FILTER_NAME) parts.push(`fixture="${FILTER_NAME}"`);
    console.error(
      parts.length > 0
        ? `No fixtures matched ${parts.join(", ")}`
        : "No fixtures loaded"
    );
    process.exit(1);
  }

  const filterDesc = [
    FILTER_PACK ? `pack=${FILTER_PACK}` : null,
    FILTER_NAME ? `name~${FILTER_NAME}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const header = filterDesc
    ? `Director test harness — ${fixtures.length} fixture(s) [${filterDesc}], ${DEFAULT_RUNS} runs each`
    : `Director test harness — ${fixtures.length} fixture(s), ${DEFAULT_RUNS} runs each`;
  console.log(`${header}\n`);

  const results = fixtures.map(runFixture);

  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    const color = r.pass ? "\x1b[32m" : "\x1b[31m";
    console.log(`${color}${icon}\x1b[0m ${r.name} (${r.runs} runs)`);
    if (VERBOSE || !r.pass) {
      for (const d of r.details) console.log(`    ${d}`);
    }
    for (const f of r.failures) {
      console.log(`    \x1b[31m→\x1b[0m ${f}`);
    }
  }

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log();
  console.log(`${passCount}/${results.length} fixtures passed${failCount ? `, ${failCount} failed` : ""}`);

  process.exit(failCount === 0 ? 0 : 1);
}

main();
