/**
 * Peanut Gallery — Director
 *
 * The "booth producer" that decides WHO speaks and WHEN.
 *
 * Instead of all 4 personas firing simultaneously every 60 seconds (which feels
 * like a wall of text), the Director creates natural morning-radio dynamics:
 *
 *   1. Reads each chunk of transcript
 *   2. Scores it against each persona's specialty (facts → Producer, hype → Heckler, etc.)
 *   3. Picks the ONE best persona for this moment
 *   4. After that persona responds, rolls the dice for a cascade:
 *      - 50% chance a second persona reacts to the first's response
 *      - 35% chance a third chimes in
 *      - 20% chance the fourth gets the last word
 *   5. 2-4 second delays between cascade responses (feels like real conversation)
 *
 * The result: some moments get 1 response, some get 2-3, and occasionally all 4
 * pile on — just like the real show. Pauses work the same way: one persona reacts,
 * maybe one more cascades, never a wall of 4 simultaneous pause reactions.
 *
 * NO LLM CALL for the director itself — it's pure pattern matching + randomness.
 * The LLM budget goes entirely to persona responses.
 */

import { logPipeline } from "./debug-logger";
import { buildFactHint, type FactHint, type FactCheckMode } from "./claim-detector";

// ──────────────────────────────────────────────────────
// PERSONA CONTENT PATTERNS
// Each persona has patterns that indicate "this is MY moment"
// ──────────────────────────────────────────────────────

const PERSONA_PATTERNS: Record<string, { patterns: RegExp[]; keywords: RegExp[] }> = {
  // The Producer: facts, numbers, claims, corrections
  producer: {
    patterns: [
      /(?:founded|started|launched|created|began)\s+(?:in|around)\s+\d{4}/i,
      /\$[\d.,]+\s*(?:billion|million|thousand|[BMK])/i,
      /\d+[\d.,]*\s*(?:percent|%|billion|million|thousand|users|employees|customers)/i,
      /(?:said|claimed|announced|reported|according to)\s/i,
      /(?:acquired|merged|IPO|went public|valuation|revenue|profit|raised)\s/i,
      /(?:is worth|was worth|valued at|market cap|founded by|CEO of)/i,
      /(?:largest|biggest|first|fastest|most|only|world's|best)\s/i,
    ],
    keywords: [
      /\b(?:actually|technically|incorrect|wrong|fact|true|false|number|statistic|data|study|research|survey|report)\b/i,
    ],
  },

  // The Troll: hype, buzzwords, self-congratulation, BS, confident claims, preach-y takes
  // EXPANDED: the old patterns missed most normal podcast conversation. The Troll should
  // be able to latch onto confident opinions, name-drops, self-promotion, and the
  // everyday rhythm of tech-bro speech — not just the blockchain-era buzzword soup.
  troll: {
    patterns: [
      // Classic tech buzzwords
      /\b(?:disrupt|revolutionary|game.?chang|paradigm|synergy|leverage|ecosystem|scalable|vertical|horizontal)\b/i,
      /\b(?:AI.?native|AI.?first|AI.?powered|web3|blockchain|metaverse|crypto|NFT|token|LLM)\b/i,
      /\b(?:unicorn|decacorn|10x|100x|moonshot|rocket.?ship|hockey.?stick)\b/i,
      /\b(?:pivot|iterate|move fast|break things|hustle|grind|ship it|default alive)\b/i,
      // Confident-opinion cues — The Troll LIVES for these
      /\b(?:everyone|nobody|every single|literally the|the only way|the best|the worst)\b/i,
      /\b(?:trust me|believe me|take it from me|I promise you|guaranteed)\b/i,
      /\b(?:obviously|clearly|undeniably|without question)\b/i,
      // Self-promotion cues
      /\b(?:my company|my firm|my fund|at my|I built|I founded|I created|I invested in|I was early)\b/i,
      /\b(?:bought|sold|exited|flipped|acquired)\s+(?:at|for)\b/i,
      // Podcast-tic phrases (these show up constantly on TWiST)
      /\b(?:by the way|so look|here's the thing|at the end of the day|the reality is)\b/i,
    ],
    keywords: [
      // Hype adjectives
      /\b(?:amazing|incredible|exciting|unprecedented|historic|massive|huge|insane|crazy|wild|unbelievable|phenomenal|genius|brilliant)\b/i,
      // Hedging / filler / posturing
      /\b(?:honestly|frankly|to be fair|to be honest|look|listen|I mean|you know what|quite frankly)\b/i,
      // Money signals
      /\b(?:billion|million|valuation|funding|raised|Series [A-F]|seed round|IPO|ARR|MRR|runway|burn)\b/i,
      // Big-name drops (any of these = Troll moment)
      /\b(?:Elon|Zuck|Bezos|Sam Altman|Sequoia|Andreessen|a16z|YC|Y Combinator|Tiger|SoftBank)\b/i,
    ],
  },

  // The Sound Guy: mood shifts, surprising moments, topic changes, quiet observations
  // NOTE: this slot was firing too rarely. Its patterns are intentionally broad
  // because the morning-radio sound-effects archetype reacts to EVERYTHING — it
  // just does it with a sound cue instead of words. Its triggers should be the
  // most generous.
  soundfx: {
    patterns: [
      /\b(?:awkward|silence|pause|wait|hold on|actually|um|uh)\b/i,
      /\b(?:wrong|mistake|oops|whoops|failed|bankrupt|shut down|dead|killed|crashed|collapsed)\b/i,
      /\b(?:breaking|just announced|news|update|happening now)\b/i,
      /\b(?:fun fact|did you know|interesting|surprisingly|plot twist)\b/i,
      /\b(?:wow|whoa|insane|crazy|wild|unbelievable|incredible|amazing)\b/i,
      /\b(?:money|dollars|billion|million|profit|loss|cost|expensive|cheap|free)\b/i,
      /\b(?:new|launch|release|ship|build|deploy|announce)\b/i,
      /\b(?:but|however|although|except|unless|unfortunately)\b/i,
    ],
    keywords: [
      /\b(?:music|song|band|album|movie|film|show|culture|history|war|president|election)\b/i,
      /\b(?:science|physics|space|NASA|Mars|moon|quantum|nuclear)\b/i,
      /\b(?:company|startup|founder|CEO|CTO|engineer|developer|team)\b/i,
      /\b(?:Google|Apple|Microsoft|Amazon|Meta|OpenAI|Anthropic|Tesla|SpaceX)\b/i,
    ],
  },

  // Jackie: joke setups, absurdity, comparisons, self-deprecation
  joker: {
    patterns: [
      /\b(?:like|similar to|reminds me of|compared to|same as|equivalent)\b/i,
      /\b(?:never|always|every time|nobody|everybody|literally)\b/i,
      /\b(?:imagine|picture this|what if|hypothetically|in theory)\b/i,
    ],
    keywords: [
      /\b(?:funny|hilarious|joke|laugh|ridiculous|absurd|ironic|irony)\b/i,
      /\b(?:old|young|wife|husband|marriage|dating|money|cheap|expensive|rich|poor)\b/i,
      /\b(?:app|startup|founder|CEO|investor|pitch|deck|demo)\b/i,
    ],
  },
};

// ──────────────────────────────────────────────────────
// CASCADE PROBABILITIES
// After persona N fires, probability that persona N+1 fires
// ──────────────────────────────────────────────────────

const CASCADE_PROBABILITY = [
  1.0,   // Primary persona: always fires
  0.60,  // Second persona: bumped from 0.50 — conversations feel richer
  0.40,  // Third persona: bumped from 0.35
  0.22,  // Fourth persona: nudged from 0.20
];

// Delay in ms between cascade responses (randomized within range)
const CASCADE_DELAY_MIN_MS = 2000;
const CASCADE_DELAY_MAX_MS = 4000;

// ──────────────────────────────────────────────────────
// BASELINE + DRY-SPELL BOOSTS
// Each persona has a baseline "eagerness" score added on top of content
// matching, plus a dry-spell boost that grows the longer they've been silent.
// This keeps quiet stretches interesting — if nobody has a pattern hit, the
// personas with the hungriest personality still get a shot.
// ──────────────────────────────────────────────────────

const BASELINE_SCORE: Record<string, number> = {
  // The Producer: only speaks when he has a fact to deliver — low baseline
  producer: 0,
  // The Heckler: WANTS the mic. High baseline so he wins more random-tie rounds.
  troll: 2,
  // The Sound Guy: quiet by design. Lowest baseline.
  soundfx: -1,
  // The Joke Writer: a joke machine — medium-high baseline
  joker: 1,
};

// How many points per trigger cycle a persona has been silent
const DRY_SPELL_POINTS_PER_CYCLE = 0.8;
const DRY_SPELL_CAP = 6; // max boost, so one persona doesn't dominate forever

// Bonus multiplier for Troll cascade probability when he hasn't primary-fired
// in a while — the Troll should be the show's pressure valve.
const TROLL_CASCADE_FLOOR = 0.75;

// v1.7: when the claim-detector says "no verifiable claim in this tick's
// transcript," the producer's rule-based score gets knocked down by this
// amount. It's a soft penalty, not a veto — dry-spell boost + cascade
// rolls + LLM routing can still bring the producer forward, which
// preserves the character balance Seth wants. Tuned so a steady drumbeat
// of non-factual transcript still lets the producer fire on dry-spell
// tiebreakers (score ~ 2 after penalty) but loses most head-to-heads
// against a real content-match on another slot.
const PRODUCER_NO_CLAIM_PENALTY = 3;

// v1.7.1 — CLAIM-DENSITY BOOST (producer only).
//
// Pre-1.7.1 the producer's factHint input was binary: has-claim → 0 swing,
// no-claim → -3 penalty. That collapses "dense AVeriTeC-style sentence with
// 5 pattern hits" and "single-pattern hit on 'largest X'" into the same
// bonus (zero). The claim-detector's new compound-claim bonus means
// `factHint.topScore` is now a useful density signal — 5+ is a
// multi-pattern sentence almost always on the producer's beat (funding
// round + amount + year + attribution in one clause), 1 is a single hit.
//
// We add a small proportional boost for scores ≥ 2, capped at +2, so
// dense claims break ties in the producer's favour without letting them
// dominate. Cap is deliberate: dry-spell boost maxes at +6 and baseline
// troll/joker baselines are already 2/1, so +2 can't push producer out
// of rotation on a neutral tick — it just means a genuinely juicy
// fact-check claim gets a fair shot against troll's content matches.
//
// Why bother at all: the research (AVeriTeC / LiveFC) is consistent that
// dense claims are both more checkable AND more likely to contain a
// specific error — the exact signal you want a rule-based scorer to
// surface. This feeds the signal the claim-detector already computes
// into the Director without introducing new heuristics.
const PRODUCER_CLAIM_DENSITY_CAP = 2;
// Score points per factHint.topScore step above 1. Topscore 2 → +0.5,
// topscore 3 → +1, topscore 5 (dense) → +2 (cap). Tuned so the boost is
// meaningful enough to break a tie against troll but never enough to
// sideline another persona who has their own pattern match.
const PRODUCER_CLAIM_DENSITY_SCALE = 0.5;

// v1.7: per-point penalty applied to a persona's rule-based score for
// every recent fallback on their tally. The PersonaEngine increments
// `recentFallbacks[personaId]` on every fallback fire and decays by 1
// on every successful non-fallback fire, so a persona who's been
// missing lately drops out of contention until the transcript presents
// something they CAN speak to. Pairs with the soft-gate invariant
// (rule #2 in docs/DESIGN-PRINCIPLES.md): feedback signal, not a veto.
// Tuned so 1 recent fallback ≈ PRODUCER_NO_CLAIM_PENALTY — roughly
// "one failed tick suppresses producer as hard as 'no claim to check.'"
const RECENT_FALLBACK_PENALTY = 2;

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────

export interface TriggerDecision {
  /** Ordered list of persona IDs to fire (primary first, then cascade) */
  personaIds: string[];
  /** Why the primary was chosen (for logging) */
  reason: string;
  /** Delays in ms before each persona fires (first is always 0) */
  delays: number[];
  // ── v1.2: richer telemetry for debug panel + structured logs. ──
  // All optional for backwards compatibility with pre-v1.2 consumers
  // that only destructure { personaIds, reason, delays }.
  /** Final score for the primary (picked) persona */
  score?: number;
  /** Top-3 scored personas (sorted desc), always includes pick at [0] */
  top3?: Array<{ id: string; score: number }>;
  /** Per-persona ms since last fire at decision time. Key covers all 4 personas. */
  cooldownsMs?: Record<string, number>;
  /**
   * v1.5: which routing path produced the primary.
   *   "rule"       — the legacy pattern-match scorer (default, always safe).
   *   "llm"        — Smart Director v2 won the 400ms race.
   *   "silent-llm" — Smart Director v3 actively chose silence (empty chain).
   * Omitted on pre-v1.5 call sites that don't pass `opts`.
   */
  source?: "rule" | "llm" | "silent-llm";
  /**
   * v1.5: what the pattern-match scorer would have picked ABSENT the LLM
   * hoist. Same as `personaIds[0]` when `source === "rule"`. When
   * `source === "llm"` and `rulePrimary !== personaIds[0]`, the LLM
   * overrode the rule-based pick — the canary telemetry in
   * `/api/transcribe` (event: `director_v2_compare`) uses this to
   * compute an agreement rate across ticks.
   */
  rulePrimary?: string;
  /**
   * v1.7: fact-check hint computed on this tick's transcript using the
   * active pack's producer `factCheckMode`. Threaded through the route
   * into the persona engine so the producer's fire starts from the
   * exact sentence the Director spotted — no redundant re-extraction,
   * and Baba's fact-check is guaranteed to have SOMETHING concrete to
   * anchor to (no more empty speaking animations when Haiku passes with
   * "-" because the local claim-extractor found nothing). When the hint
   * says `hasClaim: false` the producer's score is penalized but not
   * vetoed — dry-spell / cascade / LLM path still balance characters.
   */
  factHint?: FactHint;
}

/**
 * v1.5: optional inputs to `Director.decide`. The Smart Director v2
 * orchestrator (transcribe route) races a short LLM routing call against
 * a 400ms budget, then hands the winner (or null) to `decide` via this
 * object. When `llmPick` is provided it substitutes the primary persona;
 * cascade + cooldown + recency bookkeeping is unchanged.
 *
 * Adding fields here is the extension point for future routing layers
 * (e.g. retrieval-augmented picks, human-in-the-loop overrides).
 */
export interface DecideOptions {
  /** LLM-chosen primary, or null if the LLM lost the race / returned nothing. */
  llmPick?: { personaId: string; rationale: string } | null;
  /**
   * v1.7 (Smart Director v3, experimental): the v2 router can return
   * "silent" as a valid pick. When personaId === "silent", the Director
   * returns an empty chain (no cascade, nobody fires) and stamps
   * `source = "silent-llm"`. This is a positive, skilled pick — not a
   * fallback — per the 2026-04 research brief.
   *
   * If this field is set AND llmPick is set, `llmPickV2` wins. Keep the
   * two fields distinct so the route can thread v3's richer shape
   * (confidence + callbackUsed) without disturbing v1.5's v2 path.
   */
  llmPickV2?: {
    personaId: "producer" | "troll" | "soundfx" | "joker" | "silent";
    rationale: string;
    callbackUsed?: string | null;
  } | null;
  /**
   * v1.7: sensitivity mode for the claim-detector. Pulled from the active
   * pack's producer persona (`persona.factCheckMode`). Defaults to
   * `"strict"` when omitted — back-compat with pre-v1.7 call sites.
   * Only the producer persona cares about this field; other slots ignore it.
   */
  producerFactCheckMode?: FactCheckMode;
  /**
   * v1.7: per-persona count of recent fallback fires, threaded from
   * `PersonaEngine.getRecentFallbackCounts()`. The Director subtracts
   * `RECENT_FALLBACK_PENALTY * count` from each persona's rule-based
   * score so a persona who's been hitting the safety-net lately drops
   * out of rotation until they can speak to real content again.
   * Self-correcting feedback loop: decays 1 per successful non-fallback
   * fire (on the engine side), so sustained missing isn't permanent.
   * Missing values (persona absent from the map) contribute zero — older
   * call sites that don't pass this opt into the pre-v1.7 scoring.
   */
  recentFallbackCounts?: Record<string, number>;
  /**
   * v1.7: global sensitivity. Scales cascade probability so the
   * whole panel feels quieter or rowdier without retuning every
   * persona. "quiet" halves cascade rolls (primary fires normally;
   * pile-ons rare). "rowdy" multiplies them by 1.5 (pile-ons
   * expected). "normal" (default) is unchanged from pre-v1.7. User-
   * facing knob lives in the Critics drawer as a three-way
   * segmented control. Missing / unknown value = "normal".
   */
  sensitivity?: "quiet" | "normal" | "rowdy";
}

/**
 * Cascade-probability multiplier by sensitivity level. Applied against
 * `CASCADE_PROBABILITY[i]` per slot in the cascade roll. Kept as a named
 * constant so the math is grep-sharp during future tuning.
 */
const SENSITIVITY_CASCADE_SCALE: Record<
  NonNullable<DecideOptions["sensitivity"]>,
  number
> = {
  quiet: 0.5,
  normal: 1.0,
  rowdy: 1.5,
};

// ──────────────────────────────────────────────────────
// DIRECTOR
// ──────────────────────────────────────────────────────

export class Director {
  // Track who fired recently to avoid repetition
  private recentFirings: string[] = [];
  private readonly RECENCY_WINDOW = 4; // remember last 4 firings

  // Per-persona dry-spell counter: incremented every cycle they DON'T fire,
  // reset to 0 when they do. Prevents one persona from monopolizing the mic.
  private cyclesSinceFire: Record<string, number> = {
    producer: 0,
    troll: 0,
    soundfx: 0,
    joker: 0,
  };

  // v1.2: per-persona timestamp of last fire, for cooldownsMs in the
  // director_decision telemetry. Seeded to the Director's construction
  // time so "never fired" reads as "cold since session start" instead of
  // a 54-year-old Unix epoch cooldown in the debug panel.
  private lastFiredAt: Record<string, number> = ((): Record<string, number> => {
    const t0 = Date.now();
    return { producer: t0, troll: t0, soundfx: t0, joker: t0 };
  })();

  // v1.7 (experimental): ring buffer of "live callback candidates" —
  // notable phrases the cast has uttered in the last 3-5 minutes. Surface
  // up to 3 to the Smart Director v3 routing call; pick gets rewarded for
  // heightening them (Del Close / UCB Manual: callbacks are the Harold's
  // payoff beat). Capped to 8 entries to bound prompt size; oldest drops
  // off when a new one is pushed.
  private liveCallbacks: string[] = [];
  private readonly CALLBACK_BUFFER_MAX = 8;

  /**
   * v1.5: read-only view of recent firings (oldest → newest). Used by the
   * Smart Director v2 orchestrator to build context for the LLM routing
   * call. A getter rather than a public field keeps the internal list
   * mutable without exposing write access.
   */
  getRecentFirings(): string[] {
    return [...this.recentFirings];
  }

  /**
   * v1.5: per-persona ms since last fire at the moment of the call.
   * Mirrors the `cooldownsMs` field on TriggerDecision but available
   * BEFORE `decide()` runs — so the routing LLM can factor dry spells
   * into its pick.
   */
  getCooldownsMs(): Record<string, number> {
    const now = Date.now();
    const out: Record<string, number> = {};
    for (const id of Object.keys(this.lastFiredAt)) {
      out[id] = now - this.lastFiredAt[id];
    }
    return out;
  }

  /**
   * v1.7: push a notable phrase onto the live-callback ring buffer.
   * Intended to be called by the persona engine after a persona drops a
   * punchline / proper-noun / memorable metaphor. Silently ignores
   * empty/whitespace-only input.
   */
  addLiveCallback(phrase: string): void {
    const trimmed = phrase?.trim();
    if (!trimmed) return;
    // Dedupe: if the same (or very similar) phrase is already in the buffer,
    // don't stack it — move it to the newest slot instead.
    const existing = this.liveCallbacks.indexOf(trimmed);
    if (existing >= 0) this.liveCallbacks.splice(existing, 1);
    const stored = trimmed.slice(0, 160);
    this.liveCallbacks.push(stored);
    let evicted: string | null = null;
    while (this.liveCallbacks.length > this.CALLBACK_BUFFER_MAX) {
      evicted = this.liveCallbacks.shift() ?? null;
    }
    // Debug-level event so the v3-canary run can verify the buffer is
    // populating in production. At info this would be too chatty (fires on
    // every cascade response); debug is grep-sharp but off by default.
    logPipeline({
      event: "live_callback_added",
      level: "debug",
      data: {
        preview: stored.slice(0, 80),
        bufferSize: this.liveCallbacks.length,
        replaced: existing >= 0,
        evicted: evicted ? evicted.slice(0, 80) : null,
      },
    });
  }

  /** v1.7: read-only view of the ring buffer, oldest → newest. */
  getLiveCallbacks(): string[] {
    return [...this.liveCallbacks];
  }

  /**
   * Score a transcript chunk for a specific persona.
   * Higher score = more relevant to that persona's specialty.
   *
   * score = baseline + content_matches + dry_spell_boost - recency_penalty
   */
  private scoreForPersona(text: string, personaId: string): number {
    const config = PERSONA_PATTERNS[personaId];
    if (!config) return 0;

    // Start with this persona's baseline eagerness
    let score = BASELINE_SCORE[personaId] ?? 0;

    // Pattern matches (strong signal)
    for (const pattern of config.patterns) {
      const matches = text.match(new RegExp(pattern, "gi"));
      if (matches) score += matches.length * 2;
    }

    // Keyword matches (weak signal)
    for (const kw of config.keywords) {
      const matches = text.match(new RegExp(kw, "gi"));
      if (matches) score += matches.length;
    }

    // Dry-spell boost: the longer this persona has been silent, the more
    // likely they are to fire. Cap so one quiet persona doesn't freeze the mic.
    const silentCycles = this.cyclesSinceFire[personaId] ?? 0;
    const drySpellBoost = Math.min(
      silentCycles * DRY_SPELL_POINTS_PER_CYCLE,
      DRY_SPELL_CAP
    );
    score += drySpellBoost;

    // Recency penalty: if this persona fired in the last RECENCY_WINDOW,
    // knock their score. Stacks against consecutive cascades.
    const recencyIndex = this.recentFirings.lastIndexOf(personaId);
    if (recencyIndex !== -1) {
      const howRecent = this.recentFirings.length - recencyIndex;
      score -= Math.max(0, 4 - howRecent);
    }

    return score;
  }

  /**
   * Decide who speaks for this transcript chunk.
   * Returns an ordered list of personas with staggered delays.
   *
   * @param sessionId Optional. When provided, attached to the structured
   *   director_decision log line so entries correlate with the session.
   *   Pre-v1.2 callers that omit it still work — the log just lacks sessionId.
   */
  decide(
    recentTranscript: string,
    isSilence = false,
    sessionId?: string,
    opts?: DecideOptions
  ): TriggerDecision {
    // v1.7 (Smart Director v3): SILENT short-circuit. If the v3 router
    // returned a positive "silent" pick, we emit an empty-chain decision
    // and advance every persona's dry-spell counter by one cycle (so
    // nobody's sticky penalty bleeds into the next tick). Cooldowns /
    // lastFiredAt are NOT touched because no one fired.
    const v2 = opts?.llmPickV2;
    if (v2 && v2.personaId === "silent") {
      const now = Date.now();
      const cooldownsMs: Record<string, number> = {};
      for (const id of Object.keys(this.lastFiredAt)) {
        cooldownsMs[id] = now - this.lastFiredAt[id];
      }
      // Every persona not firing this cycle: dry-spell++.
      for (const id of Object.keys(this.cyclesSinceFire)) {
        this.cyclesSinceFire[id]++;
      }
      const reason = `LLM routing chose SILENT: ${v2.rationale}`;
      logPipeline({
        event: "director_decision",
        level: "info",
        sessionId,
        data: {
          pick: null,
          score: 0,
          top3: [],
          chainIds: [],
          delays: [],
          cascadeLen: 0,
          cooldownsMs,
          source: "silent-llm",
          chain: "",
          reason,
          cascadeCount: 0,
          isSilence,
          drySpells: { ...this.cyclesSinceFire },
        },
      });
      return {
        personaIds: [],
        reason,
        delays: [],
        score: 0,
        top3: [],
        cooldownsMs,
        source: "silent-llm",
        rulePrimary: undefined,
      };
    }

    const personaIds = Object.keys(PERSONA_PATTERNS);

    // v1.7: compute the fact-check hint for this tick. The hint feeds two
    // downstream consumers:
    //   1. Score penalty on producer when hasClaim is false (below) — soft
    //      gate, not a veto. Dry-spell / cascade / LLM routing can still
    //      surface the producer when the Director pattern-matching is soft.
    //   2. TriggerDecision.factHint — the route threads this to the persona
    //      engine so the producer's search is pre-seeded with the Director's
    //      sentence (no double-extraction, no drift between what the
    //      Director saw and what the Producer searches for).
    const factMode: FactCheckMode = opts?.producerFactCheckMode ?? "strict";
    const factHint = buildFactHint(recentTranscript, factMode);

    // Score each persona
    const scores = personaIds.map((id) => ({
      id,
      score: this.scoreForPersona(recentTranscript, id),
    }));

    // v1.7: soft-gate producer on claim presence. Applied AFTER the base
    // score so dry-spell boost + pattern hits can still lift the producer
    // into contention even on a low-claim tick.
    if (!factHint.hasClaim) {
      const producerEntry = scores.find((s) => s.id === "producer");
      if (producerEntry) {
        producerEntry.score -= PRODUCER_NO_CLAIM_PENALTY;
      }
    } else if (factHint.topScore >= 2) {
      // v1.7.1 — claim-density boost. The claim-detector's topScore is
      // a graded density signal now (compound-claim bonus + spoken-number
      // matching + structural attribution all stack). Give the producer
      // a proportional, capped positive bump so a genuinely dense
      // fact-check claim wins ties against troll / joker content matches.
      // Cap keeps character balance intact — see constant comments.
      const producerEntry = scores.find((s) => s.id === "producer");
      if (producerEntry) {
        const bump = Math.min(
          (factHint.topScore - 1) * PRODUCER_CLAIM_DENSITY_SCALE,
          PRODUCER_CLAIM_DENSITY_CAP
        );
        producerEntry.score += bump;
      }
    }

    // v1.7: recent-fallback penalty. Each point on a persona's recent
    // fallback tally costs them RECENT_FALLBACK_PENALTY in the scorer.
    // The PersonaEngine maintains the tally (incremented on every
    // fallback fire, decayed on every successful non-fallback fire) and
    // threads it through the route. Missing / empty map = no penalty
    // applied, which matches pre-v1.7 behavior for callers that don't
    // plumb fallback counts yet.
    const fbCounts = opts?.recentFallbackCounts;
    if (fbCounts) {
      for (const entry of scores) {
        const count = fbCounts[entry.id] ?? 0;
        if (count > 0) entry.score -= count * RECENT_FALLBACK_PENALTY;
      }
    }

    // Sort by score (highest first), with random tiebreaking
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5; // random tiebreak
    });

    // If all scores are 0, pick randomly (everyone has equal claim)
    if (scores[0].score === 0) {
      scores.sort(() => Math.random() - 0.5);
    }

    // v1.5: capture the rule-based primary BEFORE any LLM hoist so the
    // route's `director_v2_compare` telemetry can answer "what would the
    // scorer have picked here?" even on ticks the LLM won.
    const rulePrimary = scores[0].id;

    // v1.5: Smart Director v2. If the LLM routing call won the 400ms
    // race and returned a valid archetype id, hoist it to the primary
    // slot — everything downstream (cascade roll, recency penalties,
    // cooldown updates) proceeds unchanged. If the LLM returned a slot
    // id the current pack doesn't expose we silently fall through to
    // the rule-based pick; this is the same as the timeout path.
    //
    // v1.7 compat: a non-silent v3 pick converts to the v2 shape so the
    // existing hoist logic applies unchanged. (The silent case already
    // short-circuited above.)
    const llmPick =
      opts?.llmPickV2 && opts.llmPickV2.personaId !== "silent"
        ? {
            personaId: opts.llmPickV2.personaId,
            rationale: opts.llmPickV2.rationale,
          }
        : opts?.llmPick;
    let source: "rule" | "llm" = "rule";
    let llmRationale: string | undefined;
    if (llmPick && typeof llmPick.personaId === "string") {
      const idx = scores.findIndex((s) => s.id === llmPick.personaId);
      if (idx > 0) {
        const picked = scores.splice(idx, 1)[0];
        scores.unshift(picked);
        source = "llm";
        llmRationale = llmPick.rationale;
      } else if (idx === 0) {
        // LLM agreed with the rule-based scorer. Still annotate source
        // as "llm" so telemetry correctly credits the routing layer.
        source = "llm";
        llmRationale = llmPick.rationale;
      }
      // idx === -1: unknown archetype id. Stay with the rule-based pick.
    }

    logPipeline({
      event: "director_scores",
      level: "debug",
      data: {
        scores: Object.fromEntries(scores.map((s) => [s.id, s.score])),
        isSilence,
        textPreview: recentTranscript.slice(-100),
        source,
      },
    });

    // Primary persona always fires
    const chain: string[] = [scores[0].id];
    const delays: number[] = [0];

    // Roll the cascade for remaining personas
    const remaining = scores.slice(1);

    // Shuffle remaining so cascades aren't always in score order
    // (The Troll shouldn't always be second just because they scored second)
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    // v1.7: pull the sensitivity scale once so it's applied uniformly to
    // every cascade slot (including the Troll floor). "quiet" halves the
    // whole cascade; "rowdy" 1.5×'s it; "normal" passes through.
    const sensitivityScale = SENSITIVITY_CASCADE_SCALE[opts?.sensitivity ?? "normal"];

    let cumulativeDelay = 0;
    for (let i = 0; i < remaining.length; i++) {
      let prob = CASCADE_PROBABILITY[i + 1]; // +1 because index 0 is primary

      // Troll floor: if the Troll is being considered and he's been silent
      // for 2+ cycles, his cascade probability floor kicks in. The Troll is
      // the pressure valve — he should show up more than the math would
      // otherwise dictate.
      const personaId = remaining[i].id;
      const silent = this.cyclesSinceFire[personaId] ?? 0;
      if (personaId === "troll" && silent >= 2) {
        prob = Math.max(prob, TROLL_CASCADE_FLOOR);
      }

      // Apply sensitivity scale AFTER the troll-floor bump so "quiet" still
      // suppresses the troll floor (the floor ensures the troll shows up;
      // quiet mode says the user wants less overall; the user wins).
      prob *= sensitivityScale;

      if (Math.random() < prob) {
        const delay = CASCADE_DELAY_MIN_MS + Math.random() * (CASCADE_DELAY_MAX_MS - CASCADE_DELAY_MIN_MS);
        cumulativeDelay += delay;
        chain.push(personaId);
        delays.push(Math.round(cumulativeDelay));
      }
    }

    // If it's a silence reaction, cap the cascade more aggressively (max 2
    // responses). Dead air shouldn't get a 4-way pile-on — one sharp crickets
    // line + maybe a follow-up is the right rhythm.
    if (isSilence && chain.length > 2) {
      chain.length = 2;
      delays.length = 2;
    }

    // v1.5: when the LLM picked, its one-liner wins the reason field so
    // the debug panel shows the routing brain's actual justification. We
    // still include the rule-based score for side-by-side comparison.
    const ruleReason =
      scores[0].score > 0
        ? `${scores[0].id} scored highest (${scores[0].score.toFixed(1)}) for content match`
        : `random pick (no strong content match)`;
    const reason =
      source === "llm" && llmRationale
        ? `LLM routing: ${llmRationale} (rule scorer: ${ruleReason})`
        : ruleReason;

    // v1.2 telemetry — assembled BEFORE the lastFiredAt/cyclesSinceFire update
    // so cooldownsMs + drySpells reflect the state at decision time, not
    // after-the-fact. The debug panel reads top3 + cooldownsMs to show why
    // this pick beat the alternatives.
    const now = Date.now();
    const top3 = scores.slice(0, 3).map((s) => ({ id: s.id, score: s.score }));
    const cooldownsMs: Record<string, number> = {};
    for (const id of Object.keys(this.lastFiredAt)) {
      cooldownsMs[id] = now - this.lastFiredAt[id];
    }

    logPipeline({
      event: "director_decision",
      level: "info",
      sessionId,
      data: {
        // ── v1.2 enriched fields (new) ──
        pick: chain[0],
        score: scores[0].score,
        top3,
        chainIds: chain,
        delays,
        cascadeLen: chain.length,
        cooldownsMs,
        // ── v1.5 ──
        source,
        // ── preserved for back-compat with pre-v1.2 log consumers ──
        chain: chain.join(" → "),
        reason,
        cascadeCount: chain.length,
        isSilence,
        drySpells: { ...this.cyclesSinceFire },
      },
    });

    // Update dry-spell tracking: every persona in the chain gets reset to 0,
    // every persona NOT in the chain gets +1.
    const firedSet = new Set(chain);
    for (const id of Object.keys(this.cyclesSinceFire)) {
      if (firedSet.has(id)) {
        this.cyclesSinceFire[id] = 0;
      } else {
        this.cyclesSinceFire[id]++;
      }
    }

    // v1.2: stamp lastFiredAt for every persona in the chain. Cooldowns
    // reset for them on the next decision.
    for (const id of chain) {
      this.lastFiredAt[id] = now;
    }

    // Track ALL personas in the chain (not just primary) to prevent domination
    for (const id of chain) {
      this.recentFirings.push(id);
    }
    while (this.recentFirings.length > this.RECENCY_WINDOW) {
      this.recentFirings.shift();
    }

    return {
      personaIds: chain,
      reason,
      delays,
      score: scores[0].score,
      top3,
      cooldownsMs,
      source,
      rulePrimary,
      factHint,
    };
  }
}
