/**
 * Peanut Gallery — Claim detector
 *
 * Single source of truth for "does this text contain something a producer
 * could fact-check?" Extracted from lib/persona-engine.ts so the Director
 * can gate its producer-pick on the same signal the fact-check pipeline
 * would use — closes the "Baba Booey lights up but has nothing to say"
 * UX bug where the Director fires a producer on thin content and Haiku
 * passes with `-`, leaving the UI with a dead speaking animation.
 *
 * Design contract
 * ───────────────
 * - Pure functions, no side effects, no I/O. Trivial to unit-test.
 * - Patterns + scoring are IDENTICAL to what the persona engine
 *   previously computed inline — migration is loss-less.
 * - `hasVerifiableClaim(text)` is the cheap gate used by Director.decide
 *   on every tick; `extractTopClaims(text)` returns the full ranked
 *   list for the persona engine's search pipeline (deterministic, so
 *   the Director and the engine agree on "top claim" without a second
 *   pass).
 *
 * Upgrade path
 * ────────────
 * The regex patterns here are grep-brittle but calibrated over ~30 real
 * TWiST + Howard sessions. If a pattern is added, add a corresponding
 * unit test in scripts/test-claim-detector.ts so the Director fixture
 * suite keeps its grip on behavior.
 */

/**
 * v1.7 — Two fact-check sensitivity modes.
 *
 * **strict** — Original pattern set (numbers, dates, explicit attributions,
 *  rankings, corporate-action facts, specific named-entity claims). Only
 *  triggers on hard, sourceable claims. The right mode for voices that
 *  read as careful journalists — TWiST's Molly Wood, for example. Low
 *  false-positive rate; producer stays quiet when the transcript is soft.
 *
 * **loose** — Strict patterns PLUS soft-claim cues: speculation ("I think
 *  X is Y"), predictions ("by 2030 it'll…"), confidence-stacked assertions
 *  ("everyone knows that"), historical hand-waves ("back in the day"),
 *  name-drops, unit-less statistics, etc. The right mode for voices whose
 *  character IS the over-correction — Howard's Baba Booey is the canonical
 *  "well, actually" guy. Wrong fact-checks are cheaper UX than empty
 *  speaking animations.
 *
 * Each pack declares its producer's mode via `Persona.factCheckMode`.
 * `buildFactHint` + `extractTopClaims` accept the mode; default is
 * `"strict"` for back-compat with any caller that doesn't pass one.
 */
export type FactCheckMode = "strict" | "loose";

/**
 * Hard-claim patterns. Requires either explicit numerics, named entities,
 * or direct attributions. Matches roughly the pre-v1.7 behavior of the
 * persona engine's fact-check pipeline.
 */
export const CLAIM_PATTERNS_STRICT: readonly RegExp[] = [
  // Founding years, launch dates
  /(?:founded|started|launched|created|began|debuted|shipped|released)\s+(?:in|around)\s+\d{4}/i,
  // Money amounts with magnitude
  /\$[\d.,]+\s*(?:billion|million|thousand|[BMK])/i,
  // Percentages, totals, user counts
  /\d+[\d.,]*\s*(?:percent|%|billion|million|thousand|users|employees|customers|subscribers|downloads)/i,
  // Attributions + quotes (verifiable because the source can be checked)
  /(?:said|claimed|announced|reported|according to|stated|told|wrote|posted|tweeted)\s/i,
  // Comparisons and rankings
  /(?:largest|biggest|first|fastest|most|only|world's|best|worst|top|leading|smallest|oldest|newest)\s/i,
  // Corporate-action facts
  /(?:acquired|merged|IPO|went public|valuation|revenue|profit|raised|funded|closed|invested|exited|dissolved)\s/i,
  // Specific fact claims (entity + role)
  /(?:is worth|was worth|valued at|market cap|founded by|CEO of|invented|created by|owned by|backed by|led by)/i,
] as const;

/**
 * Soft-claim patterns. Added on top of the strict set when
 * `factCheckMode === "loose"`. These catch speculation, predictions,
 * opinion-as-fact, hand-wavy quantification, and name-drops — cues the
 * "Baba corrects everything" archetype loves to push back on.
 */
export const CLAIM_PATTERNS_LOOSE_EXTRA: readonly RegExp[] = [
  // Predictions + future states (fact-checkable in context)
  /\b(?:will be|is going to|is gonna|will reach|will hit|by\s+20\d{2}|within\s+\d+\s+(?:years?|months?|decades?))\b/i,
  // Speculative claims ("I think X is Y")
  /\b(?:I think|I believe|I heard|I'm pretty sure|I'm fairly certain|pretty sure that)\b/i,
  // Confidence cues (often attach to wrong claims)
  /\b(?:definitely|without a doubt|of course|obviously|clearly|undeniably|without question|100%|hundred percent)\b/i,
  // Historical references (date is checkable)
  /\b(?:last (?:week|month|year|quarter)|yesterday|a (?:few|couple) (?:years|months|weeks) ago|decades? ago|back in\s+\d{4})\b/i,
  // Generic statistic cues without explicit %
  /\b(?:half of|most of|one in (?:two|three|four|five|ten)|majority of|minority of|nearly all|almost all|virtually all|a fraction of)\b/i,
  // "Everyone knows" style opinion-as-fact
  /\b(?:everyone knows|nobody knows|everyone agrees|it's obvious|common knowledge|fact is|reality is|truth is)\b/i,
  // Record / measurement claims
  /\b(?:record|world record|all-time|championship|gold medal|olympic|guinness)\b/i,
  // Geographic / origin claims (often mis-remembered)
  /\b(?:born in|from|based in|headquartered in|located in|originally from|grew up in)\b/i,
  // Award / title claims
  /\b(?:won the|winner of|nominated for|received the|awarded|named)\s+(?:[A-Z]|the\s+[A-Z])/i,
  // Generic quantification without units
  /\b(?:over|more than|less than|fewer than|upwards of|approximately|roughly|around)\s+\d/i,
  // Name + title / position (Elon, Zuck, Sam Altman — triggers "is that still true?" check)
  /\b(?:CEO|CTO|founder|president|chairman|former|ex-)\s+(?:of\s+)?[A-Z]/,
] as const;

/**
 * Resolves the active pattern set for a given mode. `"loose"` returns
 * strict + extras; `"strict"` (and any unknown value) returns strict only.
 * Callers who want the old global `CLAIM_PATTERNS` constant still work —
 * see the deprecated re-export below.
 */
export function patternsForMode(mode: FactCheckMode = "strict"): readonly RegExp[] {
  if (mode === "loose") {
    return [...CLAIM_PATTERNS_STRICT, ...CLAIM_PATTERNS_LOOSE_EXTRA];
  }
  return CLAIM_PATTERNS_STRICT;
}

/**
 * @deprecated Pre-v1.7 callers imported `CLAIM_PATTERNS` as a single
 * global. Kept as an alias for `CLAIM_PATTERNS_STRICT` so downstream code
 * (scripts, tests) that still references the old name compiles. New call
 * sites should use `patternsForMode(mode)` and thread a mode through.
 */
export const CLAIM_PATTERNS = CLAIM_PATTERNS_STRICT;

export interface ScoredClaim {
  /** Single-sentence substring of the original transcript. */
  sentence: string;
  /** Sum of pattern hits + number bonus + proper-noun bonus. Higher = more fact-checkable. */
  score: number;
}

export interface ExtractOptions {
  /** Max number of claims returned. Default 3 matches persona-engine's search fan-out. */
  limit?: number;
  /** Minimum claim score to qualify. Default 1 (any single pattern hit). */
  minScore?: number;
  /** Minimum sentence length in chars. Default 15 — shorter fragments are usually ASR noise. */
  minSentenceLength?: number;
}

/**
 * Split text into sentences using simple punctuation-boundary lookahead.
 * Not a full NLP sentence splitter — good enough for the Director budget.
 */
export function splitSentences(text: string, minLength = 15): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLength);
}

/**
 * Score a single sentence against a chosen mode's pattern set.
 *
 * - `strict` — +1 per matched pattern ONLY. No bonuses. Sentence must
 *   contain at least one hard-claim pattern to qualify. Keeps strict
 *   genuinely strict; a stray proper noun + digit (e.g. "I think Tesla
 *   by 2030") no longer inflates the score past the gate.
 * - `loose` — +1 per matched pattern + up to +2 for numeric density +
 *   up to +2 for proper-noun density. Any cue in the sentence
 *   contributes. Even sentences with no pattern hits but multiple
 *   numbers or proper nouns (e.g. a bare "Elon, Twitter, 2022") still
 *   score.
 */
export function scoreClaim(sentence: string, mode: FactCheckMode = "strict"): number {
  let patternScore = 0;
  for (const pattern of patternsForMode(mode)) {
    if (pattern.test(sentence)) patternScore++;
  }

  // In strict mode, no bonuses — only pattern hits count. This prevents
  // "I think Tesla will 2x by 2026" from scoring on the proper-noun +
  // number bonuses alone.
  if (mode === "strict") return patternScore;

  let score = patternScore;
  const numberMatches = sentence.match(/\d+/g);
  if (numberMatches) score += Math.min(numberMatches.length, 2);
  // Proper nouns: capitalized word NOT at sentence start. Leading-space
  // match gives a cheap "mid-sentence capital" heuristic without needing
  // POS tagging.
  const properNouns = sentence.match(/\s[A-Z][a-z]+/g);
  if (properNouns) score += Math.min(properNouns.length, 2);
  return score;
}

/**
 * Extract top-K verifiable claims from a transcript window, ranked by
 * score descending. Empty array = Director should NOT pick producer.
 */
export function extractTopClaims(
  text: string,
  opts: ExtractOptions & { mode?: FactCheckMode } = {}
): ScoredClaim[] {
  const mode = opts.mode ?? "strict";
  const minScore = opts.minScore ?? 1;
  const limit = opts.limit ?? 3;
  // Loose mode relaxes sentence-length filtering too — "Obviously." at 10
  // chars still carries a confidence cue worth poking at. Strict mode
  // keeps the old 15-char floor because low-length sentences under strict
  // rules rarely have enough context for a good fact-check query.
  const minSentenceLength =
    opts.minSentenceLength ?? (mode === "loose" ? 8 : 15);
  const sentences = splitSentences(text, minSentenceLength);
  if (sentences.length === 0) return [];

  const scored: ScoredClaim[] = [];
  for (const sentence of sentences) {
    const score = scoreClaim(sentence, mode);
    if (score >= minScore) {
      scored.push({ sentence, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Cheap boolean gate — does the text contain at least one claim worth
 * fact-checking under the given mode? Short-circuits after the first hit.
 */
export function hasVerifiableClaim(
  text: string,
  mode: FactCheckMode = "strict",
  minScore = 1
): boolean {
  if (!text) return false;
  const minLen = mode === "loose" ? 8 : 15;
  const sentences = splitSentences(text, minLen);
  for (const sentence of sentences) {
    if (scoreClaim(sentence, mode) >= minScore) return true;
  }
  return false;
}

/**
 * The shape Director publishes alongside a TriggerDecision when a
 * producer-eligible claim exists. The route threads this into the
 * persona engine's fire pipeline so the producer persona's search is
 * pre-seeded with the exact sentence the Director spotted.
 */
export interface FactHint {
  /** True iff at least one sentence scored ≥ minScore. */
  hasClaim: boolean;
  /** Top-scoring sentence, or null when hasClaim is false. */
  topClaim: string | null;
  /** Score of the top claim. 0 when hasClaim is false. */
  topScore: number;
  /** How many sentences cleared the threshold. */
  claimCount: number;
  /** Full ranked list of qualifying claims (up to 3). Fed into search. */
  topClaims: ScoredClaim[];
  /** Which sensitivity mode produced the hint. Logged for canary triage. */
  mode: FactCheckMode;
}

/**
 * Convenience: build the hint shape the Director publishes. Keeps the
 * Director's `decide` method free of claim-extraction mechanics.
 *
 * Pass the mode declared by the active pack's producer
 * (`persona.factCheckMode`). Defaults to `"strict"` for back-compat.
 */
export function buildFactHint(
  text: string,
  mode: FactCheckMode = "strict"
): FactHint {
  const top = extractTopClaims(text, { mode, limit: 3 });
  if (top.length === 0) {
    return {
      hasClaim: false,
      topClaim: null,
      topScore: 0,
      claimCount: 0,
      topClaims: [],
      mode,
    };
  }
  // Fast follow-up scan to count total eligible claims at a wider limit.
  // Cheap — splitSentences is O(n) and pattern-matching is already bounded.
  const all = extractTopClaims(text, { mode, limit: 100 });
  return {
    hasClaim: true,
    topClaim: top[0].sentence,
    topScore: top[0].score,
    claimCount: all.length,
    topClaims: top,
    mode,
  };
}
