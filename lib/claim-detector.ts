/**
 * Peanut Gallery — Claim detector
 *
 * Single source of truth for "does this text contain something a producer
 * could fact-check?" Extracted from lib/persona-engine.ts so the Director
 * can gate its producer-pick on the same signal the fact-check pipeline
 * would use — closes the "the Producer lights up but has nothing to say"
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
 * TWiST + Morning Crew sessions. If a pattern is added, add a corresponding
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
 *  character IS the over-correction — the Morning Crew's Producer is the
 *  canonical "well, actually" voice. Wrong fact-checks are cheaper UX than
 *  empty speaking animations.
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
 *
 * 2026-04-21 hardening (LiveFC / AVeriTeC-inspired): two changes aimed at
 * live-podcast ASR reality.
 *  1. Spoken numbers now match. On a live-ASR feed "three billion" is
 *     the norm and `\$[\d]+` never fires on it, leaving the Producer silent
 *     on the exact claims he was built to catch. Added a word-number rule
 *     that only fires when the spoken number is followed by a real unit
 *     (dollars / billion / percent / users / years) so we don't catch
 *     casual numeric language like "three times" or "few dozen people".
 *  2. Attribution verbs now require structure (`said that X`, `told me`,
 *     `according to X`). The raw "said" regex was the single biggest
 *     false-positive source in the Director fixture suite — every
 *     dialogue tag in a podcast ("and he said, like…") was passing the
 *     gate with nothing to check. Structural anchors drop that noise
 *     without losing quote-style claims.
 *  3. Funding-round claims ("Series B at $400M", "seed round") are
 *     first-class — they're the most common startup-podcast claim and
 *     they often hide inside sentences that don't clear any other rule.
 */
export const CLAIM_PATTERNS_STRICT: readonly RegExp[] = [
  // Founding years, launch dates
  /(?:founded|started|launched|created|began|debuted|shipped|released)\s+(?:in|around)\s+\d{4}/i,
  // Money amounts with magnitude — dollar-prefixed (written form)
  /\$[\d.,]+\s*(?:billion|million|thousand|[BMK])/i,
  // Spoken-form numeric claims that never clear the `$` filter — "three
  // billion dollars", "forty-seven million users", "two hundred thousand
  // subscribers". Word-number token(s) followed by a real unit. The
  // trailing-unit requirement keeps casual phrasing ("three times",
  // "couple years", "few hundred") out of the match unless the unit
  // actually makes it a claim ("couple hundred million users" does).
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine|hundred|thousand|million|billion|trillion))*\s+(?:dollars?|billion|million|thousand|percent|users?|employees?|customers?|subscribers?|downloads?|people|companies|startups?)\b/i,
  // Percentages, totals, user counts (digit form)
  /\d+[\d.,]*\s*(?:percent|%|billion|million|thousand|users|employees|customers|subscribers|downloads)/i,
  // Direct quote marks → a specific attributed statement. Robust to
  // straight OR curly quotes; min inner length filters out stray "hi".
  /["“][^"”]{6,}["”]/,
  // Structured attributions — require a complement ("that", "to X",
  // "reporters"), an attribution preposition ("according to"), or a
  // proper-noun neighbour. Drops bare-"said" false positives.
  /\b(?:said|claimed|announced|stated|told|wrote|posted|tweeted)\s+(?:that|on|to|in|the|reporters|us|me|him|her|them|press|an?\s)/i,
  // NOTE: deliberately not using the /i flag — we want "according to" in
  // either case but the trailing class MUST stay upper-case-or-digit
  // (the source name). With /i, [A-Z] degrades to [A-Za-z] and every
  // "according to anyone" falsely matches.
  /\b[Aa]ccording to\s+[A-Z\d]/,
  /\b(?:[Pp]er|[Aa]s reported by|[Ss]ources told|[Cc]onfirmed (?:to|by))\s+[A-Z]/,
  // Comparisons and rankings
  /(?:largest|biggest|first|fastest|most|only|world's|best|worst|top|leading|smallest|oldest|newest)\s/i,
  // Corporate-action facts — require a complement (the thing that was
  // acted on), so "we merged into this" doesn't trip.
  /(?:acquired|merged with|went public|IPO(?:'d)?|raised|funded|invested|exited|dissolved)\s+[A-Za-z0-9$]/i,
  /\b(?:valuation of|revenue of|profit of|ARR of|MRR of|market cap of|burn rate of)\s+[\$\w]/i,
  // Funding-round claims — Series A-F or seed/pre-seed/bridge, anchored
  // to a neighboring keyword so random "series" in conversation doesn't
  // match ("series of unfortunate events").
  /\b(?:Series\s+[A-F]|seed round|pre[\s-]?seed|bridge round|angel round|crossover round)\b/i,
  // Specific fact claims (entity + role)
  /(?:is worth|was worth|valued at|market cap|founded by|CEO of|CTO of|founder of|invented|created by|owned by|backed by|led by)/i,
] as const;

/**
 * Soft-claim patterns. Added on top of the strict set when
 * `factCheckMode === "loose"`. These catch speculation, predictions,
 * opinion-as-fact, hand-wavy quantification, and name-drops — cues the
 * "Producer corrects everything" archetype loves to push back on.
 *
 * 2026-04-21: added a handful of cues that the Producer's loose mode was
 * missing in practice — tech-history rhymes ("back in the dot-com
 * days"), sponsor/ad numeric claims ("saves you X hours"), and
 * personal-history tells ("my first company") that are often
 * mis-remembered on a live show.
 */
export const CLAIM_PATTERNS_LOOSE_EXTRA: readonly RegExp[] = [
  // Predictions + future states (fact-checkable in context)
  /\b(?:will be|is going to|is gonna|will reach|will hit|by\s+20\d{2}|within\s+\d+\s+(?:years?|months?|decades?))\b/i,
  // Speculative claims ("I think X is Y")
  /\b(?:I think|I believe|I heard|I'm pretty sure|I'm fairly certain|pretty sure that)\b/i,
  // Confidence cues (often attach to wrong claims)
  /\b(?:definitely|without a doubt|of course|obviously|clearly|undeniably|without question|100%|hundred percent)\b/i,
  // Historical references (date is checkable)
  /\b(?:last (?:week|month|year|quarter)|yesterday|a (?:few|couple) (?:years|months|weeks) ago|decades? ago|back in\s+\d{4}|back in the (?:dot[\s-]?com|bubble|(?:80|90|70|00|10|20)s))\b/i,
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
  // Sponsor/ad-style numeric promises — "saves you 10 hours a week",
  // "cuts your costs by 40%". Different shape than a normal claim,
  // often misheard or inflated in live reads.
  /\b(?:saves? you|cuts?|reduces?|boosts?|grows?|increases?|doubles?|triples?)\s+(?:your|their|our)?\s*\w*\s*(?:by\s+)?\d+/i,
  // Personal-history tells ("my first company", "when I was at Google")
  /\b(?:my first|my last|back when I|when I was at|I used to work|I was employee|I co[\s-]?founded|I invested in)\s+[A-Z\w]/,
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
 *
 * On live-ASR transcripts the puncutation is unreliable (Whisper drops
 * periods mid-stream, Deepgram emits long comma-glued runs). Fall-back
 * behaviour: if the naive split yields ≤1 segment but the input is
 * long, chunk on commas/semicolons too. This prevents a 400-char
 * comma-joined run from being treated as a single un-scorable sentence.
 */
export function splitSentences(text: string, minLength = 15): string[] {
  if (!text) return [];
  const primary = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLength);
  if (primary.length >= 2 || text.length < 180) return primary;
  // Fallback: comma/semicolon chunking for punctuation-poor ASR output.
  // We still apply the length filter so "uh, yeah," doesn't survive.
  return text
    .split(/[,;]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLength);
}

/**
 * Normalize spoken-form numbers + currency words into a compact form
 * that's friendlier to both the claim-detector's digit-aware patterns
 * and downstream search queries. Pure preprocessing — no semantic
 * change. "three billion dollars" → "3 billion dollars"; "forty two
 * million" → "42 million". Conservative on scope: only handles the
 * common spoken magnitudes a podcast actually uses. Anything we miss
 * still flows through unchanged, so this is additive-safe.
 */
const _ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const _TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

export function normalizeSpokenNumbers(text: string): string {
  if (!text) return text;
  // Collapse "twenty-four" / "forty two" before magnitude substitution.
  const joined = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (_, t: string, o: string) =>
      String(_TENS[t.toLowerCase()] + _ONES[o.toLowerCase()])
  );
  // "three hundred" / "two hundred million" — convert the leading one/
  // ten token to a digit so patterns like `\d+\s+million` fire.
  return joined.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(hundred|thousand|million|billion|trillion|percent|dollars?|users?)\b/gi,
    (_, n: string, unit: string) => {
      const k = n.toLowerCase();
      const v = _ONES[k] ?? _TENS[k];
      return v !== undefined ? `${v} ${unit}` : `${n} ${unit}`;
    }
  );
}

/**
 * Cheap proper-noun heuristic. Counts capitalized multi-letter tokens
 * that are NOT at an absolute sentence start. Catches names after
 * commas, dashes, quote marks, etc. — the pre-hardening version (`\s[A-Z]`)
 * only matched names after a plain space, which missed "said, 'Sam Altman
 * is…'" and "—Musk posted…". Two-letter words are rejected to cut down on
 * spurious matches on casual-sentence-middle capitalizations
 * ("Hi" / "OK" at a clause start).
 */
function countProperNouns(sentence: string): number {
  if (sentence.length === 0) return 0;
  const firstSpace = sentence.indexOf(" ");
  const body = firstSpace === -1 ? "" : sentence.slice(firstSpace);
  const matches = body.match(/[^A-Za-z0-9][A-Z][a-z]{2,}/g);
  return matches ? matches.length : 0;
}

/**
 * Score a single sentence against a chosen mode's pattern set.
 *
 * - `strict` — +1 per matched pattern. No per-sentence bonuses beyond
 *   the compound-claim tie-breaker (a sentence with 3+ distinct
 *   pattern hits gets +1, so AVeriTeC-style dense claims ("Facebook
 *   was founded in 2004 and raised at a $500M valuation") rank above
 *   single-signal ones). Keeps strict genuinely strict; a stray
 *   proper noun + digit (e.g. "I think Tesla by 2030") no longer
 *   inflates the score past the gate.
 * - `loose` — +1 per matched pattern + up to +2 for numeric density +
 *   up to +2 for proper-noun density + compound-claim bonus. Any cue
 *   in the sentence contributes. Even sentences with no pattern hits
 *   but multiple numbers or proper nouns (e.g. "Elon, Twitter, 2022")
 *   still score.
 */
export function scoreClaim(sentence: string, mode: FactCheckMode = "strict"): number {
  let patternScore = 0;
  for (const pattern of patternsForMode(mode)) {
    if (pattern.test(sentence)) patternScore++;
  }

  // Compound-claim bonus — a sentence that trips 3+ distinct patterns is
  // almost always denser than a 1-pattern hit, and the AVeriTeC
  // evaluation repeatedly shows dense claims are both more checkable
  // and more likely to contain a specific error. +1 flat bonus applied
  // in both modes so the top-ranked claim fed to search is more
  // likely to be the juicy one.
  if (patternScore >= 3) patternScore += 1;

  // In strict mode, no additional bonuses — only pattern hits count.
  // This prevents "I think Tesla will 2x by 2026" from scoring on the
  // proper-noun + number bonuses alone.
  if (mode === "strict") return patternScore;

  let score = patternScore;
  const numberMatches = sentence.match(/\d+/g);
  if (numberMatches) score += Math.min(numberMatches.length, 2);
  score += Math.min(countProperNouns(sentence), 2);
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
    // Score against the spoken-number-normalized form so "three billion
    // dollars" trips the digit-aware patterns the same way "$3 billion"
    // would. The ORIGINAL sentence is still what we store + hand to
    // search — the normalization is purely a scoring aid so we don't
    // silently rewrite what the producer sees.
    const score = scoreClaim(normalizeSpokenNumbers(sentence), mode);
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
    if (scoreClaim(normalizeSpokenNumbers(sentence), mode) >= minScore) {
      return true;
    }
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
