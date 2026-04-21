#!/usr/bin/env tsx
/**
 * SET-14: Smart Director v3 Canary Analysis
 *
 * Reads logs/pipeline-debug.jsonl, filters director_v3_compare events,
 * and computes the six metric bands defined in the SET-14 success gate:
 *
 *   1. Agreement rate     ≥ 0.55
 *   2. Silent rate        0.10 – 0.25
 *   3. Override rate      0.20 – 0.55
 *   4. p50 / p95 latency  p95 < 350 ms
 *   5. Timeout rate       < 0.05
 *   6. Tool-use validity  = 1.0 (all LLM picks are valid persona IDs)
 *
 * Also prints 20-row samples for the two SILENT sanity checks.
 *
 * Usage:
 *   npm run analyze:director-v3
 *   # or with a custom log file:
 *   LOG_FILE=logs/my-debug.jsonl npm run analyze:director-v3
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

interface V3CompareData {
  rulePrimary: string | null;
  llmPrimary: string | null;
  finalPrimary: string | null;
  source: "rule" | "llm" | "silent-llm" | string;
  llmRationale: string | null;
  llmElapsedMs: number | null;
  llmTimedOut: boolean;
  agreed: boolean;
  overrode: boolean;
  isSilence: boolean;
  confidence: {
    producer: number;
    troll: number;
    soundfx: number;
    joker: number;
    silent: number;
  } | null;
  callbackUsed: boolean | null;
  silentPicked: boolean;
  // SET-7: tail-stability telemetry. unstableTailLen is how many chars
  // of this tick's input were NEW since the previous tick; directorInputLen
  // is the total length so the analyzer can compute the tail share.
  unstableTailLen?: number;
  directorInputLen?: number;
}

interface LogEntry {
  timestamp: string;
  event: string;
  level: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

// ── Config ────────────────────────────────────────────────────────────────────

const VALID_PERSONA_IDS = new Set(["producer", "troll", "soundfx", "joker", "silent"]);
const SAMPLE_SIZE = 20;

const LOG_FILE =
  process.env.LOG_FILE ?? join(process.cwd(), "logs", "pipeline-debug.jsonl");

// ── Helpers ───────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function pct(n: number, d: number): string {
  if (d === 0) return "N/A";
  return ((n / d) * 100).toFixed(1) + "%";
}

function band(
  value: number,
  lo: number,
  hi: number,
  label: string
): { pass: boolean; line: string } {
  const pass = value >= lo && value <= hi;
  const marker = pass ? "✓" : "✗";
  return {
    pass,
    line: `  ${marker} ${label}: ${(value * 100).toFixed(1)}%  (target ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%)`,
  };
}

function bandMin(
  value: number,
  lo: number,
  label: string
): { pass: boolean; line: string } {
  const pass = value >= lo;
  const marker = pass ? "✓" : "✗";
  return {
    pass,
    line: `  ${marker} ${label}: ${(value * 100).toFixed(1)}%  (target ≥ ${(lo * 100).toFixed(0)}%)`,
  };
}

function bandMax(
  value: number,
  hi: number,
  label: string,
  unit = "%",
  scale = 100
): { pass: boolean; line: string } {
  const pass = value <= hi;
  const marker = pass ? "✓" : "✗";
  const displayVal =
    unit === "ms" ? `${value.toFixed(0)} ms` : `${(value * scale).toFixed(1)}%`;
  const displayTarget =
    unit === "ms" ? `< ${hi} ms` : `< ${(hi * scale).toFixed(0)}%`;
  return {
    pass,
    line: `  ${marker} ${label}: ${displayVal}  (target ${displayTarget})`,
  };
}

// ── Load ──────────────────────────────────────────────────────────────────────

if (!existsSync(LOG_FILE)) {
  console.error(`\nLog file not found: ${LOG_FILE}`);
  console.error("Make sure ENABLE_SMART_DIRECTOR_V2=true is set and traffic has flowed.");
  process.exit(1);
}

const raw = readFileSync(LOG_FILE, "utf8");
const lines = raw.split("\n").filter((l) => l.trim().length > 0);

const rows: Array<{ ts: string; sessionId: string | undefined; d: V3CompareData }> = [];

for (const line of lines) {
  let entry: LogEntry;
  try {
    entry = JSON.parse(line) as LogEntry;
  } catch {
    continue;
  }
  if (entry.event !== "director_v3_compare") continue;
  if (!entry.data) continue;
  rows.push({
    ts: entry.timestamp,
    sessionId: entry.sessionId,
    d: entry.data as unknown as V3CompareData,
  });
}

// ── Header ────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════");
console.log("  Smart Director v3 Canary — Telemetry Report (SET-14)");
console.log("══════════════════════════════════════════════════════");
console.log(`  Log file : ${LOG_FILE}`);
console.log(`  Events   : ${rows.length} director_v3_compare rows`);
if (rows.length > 0) {
  console.log(`  Window   : ${rows[0].ts}  →  ${rows[rows.length - 1].ts}`);
}
console.log();

if (rows.length === 0) {
  console.log("No director_v3_compare events found.");
  console.log("Is ENABLE_SMART_DIRECTOR_V2=true set on the server?");
  process.exit(0);
}

// ── Metric computation ────────────────────────────────────────────────────────

const total = rows.length;

// 1. Agreement rate
const agreedCount = rows.filter((r) => r.d.agreed).length;
const agreementRate = agreedCount / total;

// 2. Silent rate
const silentPickedCount = rows.filter((r) => r.d.silentPicked).length;
const silentRate = silentPickedCount / total;

// 3. Override rate (source is 'llm' OR 'silent-llm')
const overrideCount = rows.filter(
  (r) => r.d.source === "llm" || r.d.source === "silent-llm"
).length;
const overrideRate = overrideCount / total;

// 4. p50 / p95 llmElapsedMs (only rows where LLM responded — not null)
const latencies = rows
  .map((r) => r.d.llmElapsedMs)
  .filter((ms): ms is number => ms !== null && ms !== undefined)
  .sort((a, b) => a - b);
const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);

// 5. Timeout rate
const timedOutCount = rows.filter((r) => r.d.llmTimedOut).length;
const timeoutRate = timedOutCount / total;

// 6. Tool-use validity rate — among rows where LLM responded (non-null pick)
const llmResponded = rows.filter((r) => r.d.llmPrimary !== null);
const validPicks = llmResponded.filter((r) =>
  VALID_PERSONA_IDS.has(r.d.llmPrimary ?? "")
);
const toolUseValidityRate =
  llmResponded.length > 0 ? validPicks.length / llmResponded.length : 1.0;

// ── Results ───────────────────────────────────────────────────────────────────

console.log("── Metric Bands ─────────────────────────────────────\n");

const results = [
  bandMin(agreementRate, 0.55, "Agreement rate  (agreed / all)"),
  band(silentRate, 0.10, 0.25, "Silent rate     (silentPicked / all)"),
  band(overrideRate, 0.20, 0.55, "Override rate   (llm+silent-llm / all)"),
  bandMax(timeoutRate, 0.05, "Timeout rate    (llmTimedOut / all)"),
  bandMax(toolUseValidityRate, 1.0001, "Tool-use validity (valid enum / llm-responded)", "%", 100),
];

for (const r of results) {
  console.log(r.line);
}

// Latency separately (different unit)
const latPass = p95 < 350;
console.log(
  `  ${latPass ? "✓" : "✗"} p95 llmElapsedMs : ${p95.toFixed(0)} ms  (target < 350 ms)`
);
console.log(
  `    p50 llmElapsedMs : ${p50.toFixed(0)} ms  (from ${latencies.length} LLM responses)`
);

const allPass =
  results.every((r) => r.pass) && latPass && toolUseValidityRate === 1.0;

console.log();
console.log(
  allPass
    ? "✅  All bands pass — gate is OPEN for SET-18 scheduling."
    : "❌  One or more bands missed — do NOT schedule SET-18 yet."
);

// ── Breakdown ─────────────────────────────────────────────────────────────────

console.log("\n── Raw Counts ───────────────────────────────────────\n");
const sourceGroups: Record<string, number> = {};
for (const r of rows) {
  sourceGroups[r.d.source] = (sourceGroups[r.d.source] ?? 0) + 1;
}
console.log("  By source:");
for (const [src, cnt] of Object.entries(sourceGroups).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${src.padEnd(12)} ${cnt}  (${pct(cnt, total)})`);
}
console.log();

const llmPrimaryGroups: Record<string, number> = {};
for (const r of rows) {
  const key = r.d.llmPrimary ?? "(null / timeout)";
  llmPrimaryGroups[key] = (llmPrimaryGroups[key] ?? 0) + 1;
}
console.log("  LLM primary picks:");
for (const [pick, cnt] of Object.entries(llmPrimaryGroups).sort((a, b) => b[1] - a[1])) {
  const valid = pick === "(null / timeout)" || VALID_PERSONA_IDS.has(pick);
  console.log(`    ${pick.padEnd(20)} ${cnt}  (${pct(cnt, total)})${valid ? "" : " ⚠️  INVALID"}`);
}

// ── SILENT sanity sample (source='silent-llm') ────────────────────────────────

const silentRows = rows.filter((r) => r.d.source === "silent-llm");
console.log(
  `\n── SILENT Sanity Read — source='silent-llm' (${silentRows.length} total, showing ${Math.min(SAMPLE_SIZE, silentRows.length)}) ─────\n`
);
if (silentRows.length === 0) {
  console.log("  (no silent-llm rows yet)");
} else {
  for (const r of silentRows.slice(0, SAMPLE_SIZE)) {
    console.log(`  [${r.ts}] session=${r.sessionId ?? "?"}  isSilence=${r.d.isSilence}  callbackUsed=${r.d.callbackUsed}`);
    console.log(`    rationale: ${r.d.llmRationale ?? "(none)"}`);
    if (r.d.confidence) {
      const cv = r.d.confidence;
      console.log(
        `    confidence: producer=${cv.producer.toFixed(2)} troll=${cv.troll.toFixed(2)} soundfx=${cv.soundfx.toFixed(2)} joker=${cv.joker.toFixed(2)} silent=${cv.silent.toFixed(2)}`
      );
    }
    console.log();
  }
}

// ── LLM override sanity sample (source='llm', non-silent) ────────────────────

const llmOverrideRows = rows.filter((r) => r.d.source === "llm");
console.log(
  `── LLM Override Sanity Read — source='llm' (${llmOverrideRows.length} total, showing ${Math.min(SAMPLE_SIZE, llmOverrideRows.length)}) ──────\n`
);
if (llmOverrideRows.length === 0) {
  console.log("  (no llm-override rows yet)");
} else {
  for (const r of llmOverrideRows.slice(0, SAMPLE_SIZE)) {
    console.log(
      `  [${r.ts}] session=${r.sessionId ?? "?"}  rule=${r.d.rulePrimary ?? "?"}  llm=${r.d.llmPrimary ?? "?"}  final=${r.d.finalPrimary ?? "?"}`
    );
    console.log(`    rationale: ${r.d.llmRationale ?? "(none)"}`);
    console.log();
  }
}

// ── Cache hit-rate (SET-16) ──────────────────────────────────────────────────
//
// Pulls `llm_director_v2_pick` events for the same window and computes the
// Haiku prompt-cache hit rate + TTFT split by hit/miss. Target bands from
// SET-16: hit rate ≥ 80 % after warmup, p95 TTFT ≤ 250 ms on hits.

interface V2PickData {
  pick: string;
  rationale: string;
  elapsedMs: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  callbackUsed?: string | null;
}

const pickRows: Array<{ ts: string; sessionId: string | undefined; d: V2PickData }> = [];
for (const line of lines) {
  let entry: LogEntry;
  try {
    entry = JSON.parse(line) as LogEntry;
  } catch {
    continue;
  }
  if (entry.event !== "llm_director_v2_pick") continue;
  if (!entry.data) continue;
  pickRows.push({
    ts: entry.timestamp,
    sessionId: entry.sessionId,
    d: entry.data as unknown as V2PickData,
  });
}

if (pickRows.length > 0) {
  console.log("\n── Cache Hit Rate — SET-16 validation ───────────────\n");
  console.log(`  ${pickRows.length} llm_director_v2_pick events analyzed`);

  const hits = pickRows.filter((r) => (r.d.cacheReadTokens ?? 0) > 0);
  const misses = pickRows.filter((r) => (r.d.cacheReadTokens ?? 0) === 0);
  const hitRate = pickRows.length === 0 ? 0 : hits.length / pickRows.length;

  console.log(
    `  ${hitRate >= 0.80 ? "✓" : "✗"} Cache hit rate: ${(hitRate * 100).toFixed(1)}%  (target ≥ 80% after warmup)`
  );
  console.log(`    hits: ${hits.length}  misses: ${misses.length}`);

  if (hits.length > 0) {
    const hitLatencies = hits.map((r) => r.d.elapsedMs).sort((a, b) => a - b);
    const hitP50 = percentile(hitLatencies, 50);
    const hitP95 = percentile(hitLatencies, 95);
    console.log(
      `  ${hitP95 <= 250 ? "✓" : "✗"} Cache-hit p95 TTFT: ${hitP95.toFixed(0)} ms  (target ≤ 250 ms)`
    );
    console.log(`    cache-hit p50: ${hitP50.toFixed(0)} ms`);
  }

  if (misses.length > 0) {
    const missLatencies = misses.map((r) => r.d.elapsedMs).sort((a, b) => a - b);
    const missP50 = percentile(missLatencies, 50);
    const missP95 = percentile(missLatencies, 95);
    console.log(`    cache-miss p50: ${missP50.toFixed(0)} ms`);
    console.log(`    cache-miss p95: ${missP95.toFixed(0)} ms`);
  }

  // Callback usage — info-signal that the ring-buffer → prompt → pick cycle
  // is actually flowing end-to-end. Zero means callback plumbing is wired
  // but nothing is ever surfaced or the model ignores them.
  const withCallback = pickRows.filter((r) => r.d.callbackUsed != null);
  console.log(
    `  Callback usage: ${withCallback.length}/${pickRows.length}  (${pct(withCallback.length, pickRows.length)})`
  );
}

// ── Semantic anti-repeat (SET-15) health ─────────────────────────────────────

const rerollEvents = lines
  .map((l) => {
    try {
      return JSON.parse(l) as LogEntry;
    } catch {
      return null;
    }
  })
  .filter((e): e is LogEntry =>
    e !== null &&
    (e.event === "persona_reroll_flagged" ||
      e.event === "persona_reroll_cleared" ||
      e.event === "persona_reroll_injected" ||
      e.event === "persona_similarity_near_miss" ||
      e.event === "semantic_embed_error")
  );

if (rerollEvents.length > 0) {
  console.log("\n── Semantic Anti-Repeat — SET-15 health ─────────────\n");
  const byEvent: Record<string, number> = {};
  for (const e of rerollEvents) {
    byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
  }
  for (const [event, count] of Object.entries(byEvent).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${event.padEnd(32)} ${count}`);
  }

  // Full cycle check: flagged → injected → cleared. If `flagged` > 0 but
  // `injected` ≈ 0, the across-turn mechanism isn't being triggered (persona
  // never fires again, or context-injection is silently broken).
  const flagged = byEvent["persona_reroll_flagged"] ?? 0;
  const injected = byEvent["persona_reroll_injected"] ?? 0;
  const cleared = byEvent["persona_reroll_cleared"] ?? 0;
  if (flagged > 0) {
    const injectRate = injected / flagged;
    const clearRate = cleared / Math.max(1, injected);
    console.log(
      `\n  Flag→Inject rate: ${(injectRate * 100).toFixed(0)}%  (persona re-fires after being flagged)`
    );
    console.log(
      `  Inject→Clear rate: ${(clearRate * 100).toFixed(0)}%  (model finds a new angle after injection)`
    );
  }
}

// ── Unstable tail (SET-7) — does tail size correlate with SILENT rate? ──────
//
// Hypothesis: bigger unstable tail → higher silent rate when the tail
// contains the only potentially-reactable signal. This analyzer segment
// buckets ticks by tail-size quartile and reports silent-pick rate per
// bucket. If SET-7 is working the buckets should show a monotone trend
// from low → high silent rate as tail share grows.

const ticksWithTail = rows.filter(
  (r) =>
    typeof r.d.unstableTailLen === "number" &&
    typeof r.d.directorInputLen === "number" &&
    r.d.directorInputLen > 0
);

if (ticksWithTail.length > 0) {
  console.log("\n── Unstable Tail — SET-7 impact ─────────────────────\n");
  // Bucket by tail share (unstableTailLen / directorInputLen).
  const buckets = [
    { label: "tail 0-25%    ", lo: 0, hi: 0.25, ticks: [] as typeof rows },
    { label: "tail 25-50%   ", lo: 0.25, hi: 0.5, ticks: [] as typeof rows },
    { label: "tail 50-75%   ", lo: 0.5, hi: 0.75, ticks: [] as typeof rows },
    { label: "tail 75-100%  ", lo: 0.75, hi: 1.01, ticks: [] as typeof rows },
  ];
  for (const r of ticksWithTail) {
    const share = (r.d.unstableTailLen ?? 0) / Math.max(1, r.d.directorInputLen ?? 1);
    for (const b of buckets) {
      if (share >= b.lo && share < b.hi) {
        b.ticks.push(r);
        break;
      }
    }
  }
  for (const b of buckets) {
    const silent = b.ticks.filter((r) => r.d.silentPicked).length;
    const rate = b.ticks.length === 0 ? 0 : silent / b.ticks.length;
    const bar = "█".repeat(Math.round(rate * 20));
    console.log(
      `  ${b.label}  ${b.ticks.length.toString().padStart(4)} ticks  silent ${silent.toString().padStart(3)}  ${(rate * 100).toFixed(1).padStart(5)}%  ${bar}`
    );
  }
  console.log(
    `\n  Interpretation: rising silent % as tail share grows means SET-7 is`
  );
  console.log(
    `  working (router defers when the only signal lives in the unstable tail).`
  );
}

// ── Live-callback buffer population ──────────────────────────────────────────

const callbackAdds = lines.filter((l) => l.includes('"event":"live_callback_added"')).length;
if (callbackAdds > 0 || pickRows.length > 0) {
  console.log("\n── Live-Callback Buffer — SET-12 activation ─────────\n");
  console.log(
    `  live_callback_added: ${callbackAdds}  (persona responses pushed into ring)`
  );
  if (pickRows.length > 0) {
    const withCallback = pickRows.filter((r) => r.d.callbackUsed != null).length;
    const callbackUseRate = withCallback / pickRows.length;
    console.log(
      `  Router callback pickup: ${(callbackUseRate * 100).toFixed(1)}%  of picks reference a buffered phrase`
    );
  }
}

console.log("══════════════════════════════════════════════════════\n");
