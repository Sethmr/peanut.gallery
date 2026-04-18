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
  initialState?: {
    recentFirings?: string[];
    cyclesSinceFire?: Record<string, number>;
    lastFiredAt?: Record<string, number>;
  };
  input: {
    transcript: string;
    isSilence?: boolean;
    sessionId?: string;
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
    mustFirePersona?: string;
    mustFireRatio?: number;        // default 0.80
    mustNotFire?: string;          // strict — never
    // reason constraints
    reasonContains?: string;
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
  if (!state) return d;
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
  return d;
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
  if (a.mustNotFire && decision.personaIds.includes(a.mustNotFire)) {
    fail.push(`mustNotFire violated: ${a.mustNotFire} appeared in chain`);
  }
  if (a.reasonContains && !decision.reason.includes(a.reasonContains)) {
    fail.push(`reasonContains violated: reason="${decision.reason}" missing "${a.reasonContains}"`);
  }
  if (a.delaysFirstZero && decision.delays[0] !== 0) {
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
    if (!Array.isArray(decision.top3) || decision.top3.length === 0) fail.push(`returnShapeComplete: top3 missing/empty`);
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
    const a = d.decide(fixture.input.transcript, fixture.input.isSilence ?? false);
    const secondInput = v.secondInput ?? fixture.input;
    const b = d.decide(secondInput.transcript, secondInput.isSilence ?? false);
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
      fixture.input.sessionId
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
  const fixtures = FILTER_NAME
    ? allFixtures.filter((f) => f.name === FILTER_NAME || f.name.includes(FILTER_NAME))
    : allFixtures;

  if (fixtures.length === 0) {
    console.error(FILTER_NAME ? `No fixture matched "${FILTER_NAME}"` : "No fixtures loaded");
    process.exit(1);
  }

  console.log(`Director test harness — ${fixtures.length} fixture(s), ${DEFAULT_RUNS} runs each\n`);

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
