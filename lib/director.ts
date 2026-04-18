/**
 * Peanut Gallery — Director
 *
 * The "booth producer" that decides WHO speaks and WHEN.
 *
 * Instead of all 4 personas firing simultaneously every 60 seconds (which feels
 * like a wall of text), the Director creates natural Stern Show dynamics:
 *
 *   1. Reads each chunk of transcript
 *   2. Scores it against each persona's specialty (facts → Baba Booey, hype → Troll, etc.)
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

// ──────────────────────────────────────────────────────
// PERSONA CONTENT PATTERNS
// Each persona has patterns that indicate "this is MY moment"
// ──────────────────────────────────────────────────────

const PERSONA_PATTERNS: Record<string, { patterns: RegExp[]; keywords: RegExp[] }> = {
  // Baba Booey: facts, numbers, claims, corrections
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

  // Fred: mood shifts, surprising moments, topic changes, quiet observations
  // NOTE: Fred was firing too rarely. His patterns are intentionally broad because
  // on the Stern Show, Fred reacts to EVERYTHING — he just does it with a sound
  // effect instead of words. His triggers should be the most generous.
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
  // Baba Booey: only speaks when he has a fact to deliver — low baseline
  producer: 0,
  // The Troll: WANTS the mic. High baseline so he wins more random-tie rounds.
  troll: 2,
  // Fred: quiet by design. Lowest baseline.
  soundfx: -1,
  // Jackie: a joke machine — medium-high baseline
  joker: 1,
};

// How many points per trigger cycle a persona has been silent
const DRY_SPELL_POINTS_PER_CYCLE = 0.8;
const DRY_SPELL_CAP = 6; // max boost, so one persona doesn't dominate forever

// Bonus multiplier for Troll cascade probability when he hasn't primary-fired
// in a while — the Troll should be the show's pressure valve.
const TROLL_CASCADE_FLOOR = 0.75;

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
   *   "rule" — the legacy pattern-match scorer (default, always safe).
   *   "llm"  — Smart Director v2 won the 400ms race.
   * Omitted on pre-v1.5 call sites that don't pass `opts`.
   */
  source?: "rule" | "llm";
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
}

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
    const personaIds = Object.keys(PERSONA_PATTERNS);

    // Score each persona
    const scores = personaIds.map((id) => ({
      id,
      score: this.scoreForPersona(recentTranscript, id),
    }));

    // Sort by score (highest first), with random tiebreaking
    scores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5; // random tiebreak
    });

    // If all scores are 0, pick randomly (everyone has equal claim)
    if (scores[0].score === 0) {
      scores.sort(() => Math.random() - 0.5);
    }

    // v1.5: Smart Director v2. If the LLM routing call won the 400ms
    // race and returned a valid archetype id, hoist it to the primary
    // slot — everything downstream (cascade roll, recency penalties,
    // cooldown updates) proceeds unchanged. If the LLM returned a slot
    // id the current pack doesn't expose we silently fall through to
    // the rule-based pick; this is the same as the timeout path.
    const llmPick = opts?.llmPick;
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
    };
  }
}
