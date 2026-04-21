#!/usr/bin/env tsx
/**
 * Unit tests for lib/claim-detector.ts.
 *
 * Validates the two sensitivity modes + boundary cases so the Director's
 * producer-gate stays calibrated. Runs as part of `npm run check`.
 *
 * Design anchor: the tests encode "what Seth wants":
 *  - loose mode fires on speculation, predictions, name-drops
 *  - strict mode skips soft claims, requires hard facts
 *  - pure filler scores 0 in BOTH modes — the animation never fires
 *    with nothing to say
 */

import {
  scoreClaim,
  extractTopClaims,
  hasVerifiableClaim,
  buildFactHint,
  patternsForMode,
  CLAIM_PATTERNS_STRICT,
  CLAIM_PATTERNS_LOOSE_EXTRA,
} from "../lib/claim-detector";

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

console.log("\nclaim-detector — shape of pattern sets");

assert(
  CLAIM_PATTERNS_STRICT.length >= 6,
  `strict patterns count (${CLAIM_PATTERNS_STRICT.length}) — expected >= 6`
);
assert(
  CLAIM_PATTERNS_LOOSE_EXTRA.length >= 10,
  `loose extras count (${CLAIM_PATTERNS_LOOSE_EXTRA.length}) — expected >= 10`
);
assert(
  patternsForMode("loose").length ===
    CLAIM_PATTERNS_STRICT.length + CLAIM_PATTERNS_LOOSE_EXTRA.length,
  "loose mode = strict + extras"
);
assert(
  patternsForMode("strict").length === CLAIM_PATTERNS_STRICT.length,
  "strict mode = strict patterns only"
);

console.log("\nclaim-detector — strict vs loose: hard claims fire in both");

// Hard dollar claim: both modes must score.
assert(
  scoreClaim("They raised $47 million at a $500 million valuation.", "strict") > 0,
  "strict catches hard dollar claim"
);
assert(
  scoreClaim("They raised $47 million at a $500 million valuation.", "loose") > 0,
  "loose catches hard dollar claim"
);

// Founding year: both.
assert(
  scoreClaim("Facebook was founded in 2004.", "strict") > 0,
  "strict catches founding year"
);
assert(
  scoreClaim("Facebook was founded in 2004.", "loose") > 0,
  "loose catches founding year"
);

console.log("\nclaim-detector — loose fires on soft claims; strict does NOT");

// Speculation: loose yes, strict no.
assert(
  scoreClaim("I think AI will be smarter than humans within five years.", "loose") > 0,
  "loose catches speculation + prediction"
);
assert(
  scoreClaim("I think AI will be smarter than humans within five years.", "strict") === 0,
  "strict ignores pure speculation"
);

// "Everyone knows" as-fact.
assert(
  scoreClaim("Everyone knows that early employees get screwed on the cap table.", "loose") > 0,
  "loose catches 'everyone knows' opinion-as-fact"
);
assert(
  scoreClaim("Everyone knows that early employees get screwed on the cap table.", "strict") === 0,
  "strict ignores 'everyone knows'"
);

// Confidence stacking.
assert(
  scoreClaim("This is obviously the best strategy, without a doubt.", "loose") > 0,
  "loose catches confidence stacking"
);
assert(
  scoreClaim("This is obviously the best strategy, without a doubt.", "strict") > 0,
  "strict still catches 'best' (explicit superlative)"
);

console.log("\nclaim-detector — pure filler scores 0 in both modes");

for (const filler of [
  "Yeah.",
  "Uh huh.",
  "Right.",
  "Sure sure.",
  "And then we were talking.",
]) {
  assert(
    scoreClaim(filler, "strict") === 0,
    `strict skips filler: "${filler}"`
  );
  assert(
    scoreClaim(filler, "loose") === 0,
    `loose skips filler: "${filler}"`
  );
}

console.log("\nclaim-detector — extractTopClaims respects mode + limit");

const text =
  "Yeah so anyway. They raised $47 million at a $500M valuation last quarter. I think AI is going to change everything by 2030. Facebook was founded in 2004 I believe. So anyway.";

const strictTop = extractTopClaims(text, { mode: "strict", limit: 5 });
const looseTop = extractTopClaims(text, { mode: "loose", limit: 5 });

assert(
  strictTop.length >= 2,
  `strict finds the hard claims: got ${strictTop.length}`
);
assert(
  looseTop.length >= strictTop.length,
  `loose finds at least as many as strict (${looseTop.length} vs ${strictTop.length})`
);
assert(
  looseTop.length > strictTop.length,
  `loose finds MORE than strict thanks to speculation/prediction catches`
);

// Top claim should be the same (both modes rank by score; hard claims
// score higher than soft ones). $47M + $500M claim dominates either way.
assert(
  strictTop[0].sentence.includes("$47 million") ||
    strictTop[0].sentence.includes("$500M"),
  "strict top claim = the dollar sentence"
);

console.log("\nclaim-detector — hasVerifiableClaim is the cheap gate");

assert(
  hasVerifiableClaim("Yeah, anyway, the thing is.", "strict") === false,
  "strict: pure-filler text has no claim"
);
assert(
  hasVerifiableClaim("Yeah, anyway, the thing is.", "loose") === false,
  "loose: pure-filler text has no claim"
);
assert(
  hasVerifiableClaim(
    "They acquired Twitter for $44 billion in 2022.",
    "strict"
  ),
  "strict: hard acquisition claim qualifies"
);
assert(
  hasVerifiableClaim(
    "I believe Tesla is going to double in value by 2026.",
    "strict"
  ) === false,
  "strict: speculation alone does NOT qualify"
);
assert(
  hasVerifiableClaim(
    "I believe Tesla is going to double in value by 2026.",
    "loose"
  ),
  "loose: speculation + prediction DOES qualify"
);

console.log("\nclaim-detector — buildFactHint shape");

const hintEmpty = buildFactHint("Yeah. Right. Uh huh.", "strict");
assert(hintEmpty.hasClaim === false, "empty filler → hasClaim false");
assert(hintEmpty.topClaim === null, "empty filler → topClaim null");
assert(hintEmpty.claimCount === 0, "empty filler → claimCount 0");
assert(Array.isArray(hintEmpty.topClaims) && hintEmpty.topClaims.length === 0, "empty → topClaims empty array");
assert(hintEmpty.mode === "strict", "hint records the mode");

const hintWithClaim = buildFactHint(
  "They raised $47 million at a $500M valuation. Facebook was founded in 2004.",
  "strict"
);
assert(hintWithClaim.hasClaim === true, "real claims → hasClaim true");
assert(hintWithClaim.topClaim !== null, "real claims → topClaim set");
assert(hintWithClaim.topScore > 0, "real claims → topScore > 0");
assert(hintWithClaim.claimCount >= 1, "real claims → claimCount >= 1");
assert(hintWithClaim.topClaims.length <= 3, "topClaims capped at 3");

// Same text under loose mode should produce at least as high claimCount,
// because loose is a superset.
const hintLoose = buildFactHint(
  "They raised $47 million at a $500M valuation. Facebook was founded in 2004.",
  "loose"
);
assert(
  hintLoose.claimCount >= hintWithClaim.claimCount,
  `loose claimCount (${hintLoose.claimCount}) >= strict (${hintWithClaim.claimCount})`
);

console.log();
console.log(`${passed}/${passed + failed} unit tests passed`);
process.exit(failed === 0 ? 0 : 1);
