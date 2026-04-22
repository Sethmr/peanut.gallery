#!/usr/bin/env tsx
/**
 * Unit tests for the evidence classifier (producer tier gate).
 *
 * Covers:
 *   - MISSING on null / empty / whitespace
 *   - STRONG on multiple bullets + URLs
 *   - PARTIAL on single bullet + URL, or multiple bullets without URLs
 *   - WEAK on single uncited bullet, on "no data" cues, on longish synth
 *   - Aggregate roll-up rules
 *   - Preamble string shape for each strength
 *
 * Runs against pure functions — no I/O, no network. Trivially fast.
 * Does NOT touch Director, persona-engine, claim-detector: those
 * research-backed systems have their own suites and are untouched
 * by this feature.
 */

import {
  aggregateEvidenceStrength,
  buildEvidencePreamble,
  classifyEvidence,
  type EvidenceStrength,
} from "../lib/evidence-classifier";

let total = 0;
let passed = 0;
const failures: string[] = [];

function section(name: string): void {
  console.log(`\n── ${name} ──`);
}

function assert(condition: boolean, label: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

function assertEq<T>(got: T, want: T, label: string): void {
  assert(Object.is(got, want), `${label} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
}

function testMissing(): void {
  section("classifyEvidence — MISSING");
  assertEq(classifyEvidence(null).strength, "MISSING", "null → MISSING");
  assertEq(classifyEvidence(undefined).strength, "MISSING", "undefined → MISSING");
  assertEq(classifyEvidence("").strength, "MISSING", "empty string → MISSING");
  assertEq(classifyEvidence("   \n\t  ").strength, "MISSING", "whitespace → MISSING");
  assertEq(classifyEvidence("x").strength, "MISSING", "single char → MISSING");
}

function testStrong(): void {
  section("classifyEvidence — STRONG");
  const brave = [
    "• [TechCrunch] Acme raised $40M Series B in March 2024 (source: https://techcrunch.com/acme-b)",
    "• [Bloomberg] Acme valuation at $400M post-money (source: https://bloomberg.com/acme)",
    "• [The Information] Acme founder confirmed round on podcast (https://theinformation.com/acme)",
  ].join("\n");
  const c = classifyEvidence(brave);
  assertEq(c.strength, "STRONG", "3 bullets + 3 URLs → STRONG");
  assertEq(c.bulletCount, 3, "bulletCount=3");
  assert(c.urlCount >= 3, `urlCount ≥ 3 (got ${c.urlCount})`);
  assertEq(c.hasNoDataSignal, false, "no no-data signal");

  const xaiSynth = `- Acme raised $40M Series B in 2024\n- Valuation is $400M post-money (https://example.com/a)\n(sources: https://example.com/a, https://example.com/b)`;
  assertEq(classifyEvidence(xaiSynth).strength, "STRONG", "xAI synth with 2 bullets + 2+ URLs → STRONG");
}

function testPartial(): void {
  section("classifyEvidence — PARTIAL");
  const oneCited = "• [Wikipedia] Acme was founded in 2015 (https://en.wikipedia.org/wiki/Acme)";
  assertEq(
    classifyEvidence(oneCited).strength,
    "PARTIAL",
    "1 bullet + 1 URL → PARTIAL (not STRONG; needs ≥2 bullets for STRONG)"
  );

  const twoBulletsNoUrl = `• [TechCrunch] Founder hinted at a new round on stage.\n• [Reuters] Analysts speculate the raise is imminent.`;
  assertEq(
    classifyEvidence(twoBulletsNoUrl).strength,
    "PARTIAL",
    "2 bullets + 0 URLs → PARTIAL"
  );
}

function testWeak(): void {
  section("classifyEvidence — WEAK");
  const oneBullet = "• [Some Blog] Heard a rumor that Acme is buying Beta.";
  assertEq(
    classifyEvidence(oneBullet).strength,
    "WEAK",
    "1 uncited bullet → WEAK"
  );

  const longSynthNoBullets =
    "Acme raised a round recently but the exact amount was not disclosed in public sources. Coverage has been light and no primary source has confirmed numbers yet.";
  assertEq(
    classifyEvidence(longSynthNoBullets).strength,
    "WEAK",
    "longish synth paragraph, no bullets / URLs → WEAK"
  );

  const noData = "• [xAI synth] No reliable data available for the claim.";
  const c = classifyEvidence(noData);
  assertEq(c.strength, "WEAK", "'no reliable data' phrase → WEAK");
  assertEq(c.hasNoDataSignal, true, "hasNoDataSignal=true on cue");

  const unableCited = "Unable to verify this claim. (https://example.com/ref)";
  assertEq(
    classifyEvidence(unableCited).strength,
    "WEAK",
    "'unable to verify' + URL still caps at WEAK"
  );
}

function testAggregate(): void {
  section("aggregateEvidenceStrength");
  assertEq(aggregateEvidenceStrength([]), "MISSING", "empty array → MISSING");
  assertEq(
    aggregateEvidenceStrength(["STRONG", "WEAK", "MISSING"] as EvidenceStrength[]),
    "STRONG",
    "any STRONG wins"
  );
  assertEq(
    aggregateEvidenceStrength(["PARTIAL", "WEAK", "MISSING"] as EvidenceStrength[]),
    "PARTIAL",
    "any PARTIAL wins over WEAK/MISSING"
  );
  assertEq(
    aggregateEvidenceStrength(["WEAK", "MISSING", "MISSING"] as EvidenceStrength[]),
    "WEAK",
    "any WEAK wins over MISSING"
  );
  assertEq(
    aggregateEvidenceStrength(["MISSING", "MISSING"] as EvidenceStrength[]),
    "MISSING",
    "all MISSING → MISSING"
  );
}

function testPreamble(): void {
  section("buildEvidencePreamble — exact prompt strings");
  const labels: EvidenceStrength[] = ["STRONG", "PARTIAL", "WEAK", "MISSING"];
  for (const label of labels) {
    const p = buildEvidencePreamble(label);
    assert(p.startsWith(`OVERALL EVIDENCE: ${label}`), `${label}: starts with "OVERALL EVIDENCE: ${label}"`);
    assert(p.split("\n").length === 2, `${label}: exactly two lines (header + hint)`);
  }
  // Sanity — the STRONG hint mentions FACT CHECK / CONTEXT; the WEAK
  // hint mentions HEADS UP + hedge; the MISSING hint mentions "pass".
  assert(
    buildEvidencePreamble("STRONG").toLowerCase().includes("fact check"),
    "STRONG preamble mentions FACT CHECK"
  );
  assert(
    buildEvidencePreamble("WEAK").toLowerCase().includes("heads up"),
    "WEAK preamble mentions HEADS UP"
  );
  assert(
    buildEvidencePreamble("MISSING").toLowerCase().includes("pass"),
    "MISSING preamble mentions pass"
  );
}

function main(): void {
  testMissing();
  testStrong();
  testPartial();
  testWeak();
  testAggregate();
  testPreamble();

  console.log(`\n${passed}/${total} tests ${passed === total ? "passed" : "FAILED"}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
