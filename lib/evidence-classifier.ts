/**
 * Peanut Gallery — Evidence classifier.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The producer persona (Baba Booey in Howard, Molly Wood in TWiST) has
 * four correction tiers in its system prompt:
 *   [FACT CHECK] — hard, sourceable correction
 *   [CONTEXT]    — adds a missing angle
 *   [HEADS UP]   — hedged, "don't quote me" flag
 *   [CALLBACK]   — contradiction with earlier show content
 *
 * Before this module, the producer chose a tier purely from the
 * search-result blob + its own judgment. The result was the
 * "confidently wrong [FACT CHECK]" pathology — Haiku would pick the
 * most impressive-sounding tier whenever the prompt left it ambiguous,
 * even when search returned a thin, unciteable snippet.
 *
 * THE FIX (design principle §3a "persona prompts are the lever")
 * ─────────────────────────────────────────────────────────────
 * We classify every fetched search result into an explicit evidence
 * strength label — STRONG / PARTIAL / WEAK / MISSING — and inject
 * that label into the producer's context right alongside the raw
 * snippets. The producer's system prompt gains a new
 * "EVIDENCE → TIER" block that maps each strength to a tier ceiling
 * (WEAK never earns [FACT CHECK]; MISSING prefers pass).
 *
 * This is a **soft** gate, not a hard veto — we score evidence for
 * the model, and the model still picks the tier. The prompt rule is
 * where the pressure lives, matching the "soft gates not vetoes"
 * design principle.
 *
 * CLASSIFICATION INPUTS
 * ─────────────────────
 * We don't have structured access to the search APIs' result shape
 * on the hot path (the engine's adapters return pre-formatted string
 * blobs for simplicity). So this module classifies by:
 *   - bullet count     — how many distinct results the adapter serialized
 *   - URL count        — parenthesized / bracketed URLs attached to bullets
 *   - token length     — degenerate empty-ish blobs classify low
 *   - "no data" cues   — the xAI adapter's synth layer sometimes prints
 *                        "no reliable data" when the search came up dry
 *
 * The classifier is PURE — no I/O, no logging, no state. All signals
 * are computed from the formatted-string argument. That makes it
 * trivially unit-testable and means we can classify historical
 * sessions from logs later.
 *
 * EVIDENCE LABELS
 * ───────────────
 *   STRONG  — Multiple high-quality signals converge: ≥2 bullets AND
 *             ≥1 URL cite AND no "no-data" language.
 *   PARTIAL — Some evidence but thin: exactly 1 result with citation,
 *             or ≥2 results without citations.
 *   WEAK    — A single uncited bullet, or results containing "no data"
 *             / "unable to verify" / "no reliable data" language.
 *   MISSING — Empty string, null, or an explicit "no results" marker.
 *
 * Thresholds are tuned from the shape of existing searchBrave /
 * searchXai outputs, not from a fresh calibration pass. If per-pack
 * feedback shows mislabeling, the thresholds live here in one place.
 */

export type EvidenceStrength = "STRONG" | "PARTIAL" | "WEAK" | "MISSING";

export interface ClassifiedEvidence {
  strength: EvidenceStrength;
  /** Number of bullet-style result lines found. */
  bulletCount: number;
  /** Distinct URLs extracted from the blob. */
  urlCount: number;
  /** Whether the blob contains a "no reliable data" signal. */
  hasNoDataSignal: boolean;
  /** Raw character length of the input. Informational; not load-bearing. */
  charLength: number;
}

/**
 * Classify the evidence strength of a single search-result blob.
 *
 * The blob shape varies per engine:
 *   - Brave → lines beginning with "• [Title] snippet"
 *   - xAI   → free-form synthesized answer, optional "(sources: URLs)" tail
 *
 * The classifier is intentionally engine-agnostic — we look at the
 * RENDERED text the producer actually sees, not provider-specific
 * metadata. If we ever add a third engine, the classifier works
 * unchanged so long as the adapter produces bullet-ish + URL-ish output.
 */
export function classifyEvidence(
  blob: string | null | undefined
): ClassifiedEvidence {
  if (!blob) {
    return {
      strength: "MISSING",
      bulletCount: 0,
      urlCount: 0,
      hasNoDataSignal: false,
      charLength: 0,
    };
  }
  const charLength = blob.length;
  const trimmed = blob.trim();
  if (trimmed.length === 0) {
    return {
      strength: "MISSING",
      bulletCount: 0,
      urlCount: 0,
      hasNoDataSignal: false,
      charLength,
    };
  }

  // Count bullets. Brave adapter writes lines starting with "• ".
  // xAI's synth may write bullets as "- " or "* ". Be generous.
  const bulletMatches = trimmed.match(/^[\s]*[•\-*]\s+\S/gm);
  const bulletCount = bulletMatches ? bulletMatches.length : 0;

  // Count URLs. Matches http(s)://… up to whitespace or closing paren.
  const urlMatches = trimmed.match(/https?:\/\/[^\s)]+/g);
  const urlCount = urlMatches ? new Set(urlMatches).size : 0;

  // "No data" phrases. These come from the xAI adapter's synth prompt
  // telling it to say so if the search came up empty. Once any of
  // these fires, we cap strength at WEAK even if bullets are present
  // (the bullets may just be restating the "no data" condition).
  const lowered = trimmed.toLowerCase();
  const NO_DATA_CUES = [
    "no reliable data",
    "no relevant data",
    "no data available",
    "no reliable information",
    "no relevant information",
    "unable to verify",
    "could not verify",
    "i could not find",
    "no sources",
    "nothing conclusive",
    "inconclusive",
  ];
  const hasNoDataSignal = NO_DATA_CUES.some((c) => lowered.includes(c));

  let strength: EvidenceStrength;
  if (hasNoDataSignal) {
    strength = "WEAK";
  } else if (bulletCount >= 2 && urlCount >= 1) {
    strength = "STRONG";
  } else if (bulletCount >= 2 || urlCount >= 1) {
    strength = "PARTIAL";
  } else if (bulletCount === 1 || charLength >= 60) {
    // Single uncited bullet or a short synth paragraph — producer
    // can mention it as a hedge, but not as a [FACT CHECK] cite.
    strength = "WEAK";
  } else {
    // Tiny blob with nothing identifiable — treat as missing so the
    // producer's prompt rule pushes toward pass.
    strength = "MISSING";
  }

  return {
    strength,
    bulletCount,
    urlCount,
    hasNoDataSignal,
    charLength,
  };
}

/**
 * Aggregate per-claim evidence into a single session-level strength.
 *
 * Used to prepend an overall "OVERALL EVIDENCE: X" header so the
 * producer can see the summary at a glance before reading individual
 * blocks. Aggregation rules:
 *
 *   - Any STRONG → STRONG
 *   - Else any PARTIAL → PARTIAL
 *   - Else any WEAK → WEAK
 *   - Else → MISSING
 *
 * The rationale is "one good citation is enough to justify a
 * [FACT CHECK]" — we don't want a mix of STRONG + WEAK to downgrade
 * to PARTIAL, because the producer can always pick the specific
 * STRONG item to anchor on.
 */
export function aggregateEvidenceStrength(
  strengths: EvidenceStrength[]
): EvidenceStrength {
  if (strengths.length === 0) return "MISSING";
  if (strengths.includes("STRONG")) return "STRONG";
  if (strengths.includes("PARTIAL")) return "PARTIAL";
  if (strengths.includes("WEAK")) return "WEAK";
  return "MISSING";
}

/**
 * Short human-readable label matched 1:1 to the producer prompt's
 * EVIDENCE → TIER mapping. Exported so the persona-engine's search
 * formatter can emit the same strings the prompt references.
 */
export function evidenceLabel(strength: EvidenceStrength): string {
  return strength; // Stable, uppercase, matches prompt literals.
}

/**
 * Build the evidence-block preamble the persona engine prepends to the
 * SEARCH RESULTS section. Renders a one-line overall label plus an
 * instructive sentence that points the producer at the tier mapping.
 *
 * Kept here (not in the engine) so tests can snapshot the exact
 * string the producer will see.
 */
export function buildEvidencePreamble(overall: EvidenceStrength): string {
  const hint = (() => {
    switch (overall) {
      case "STRONG":
        return "Multiple sources align — a [FACT CHECK] or [CONTEXT] tier is earned if you can cite a specific number/date/quote from the results.";
      case "PARTIAL":
        return "Some evidence, but thin. [HEADS UP] is the right tier unless you can anchor to a specific citation below.";
      case "WEAK":
        return "Evidence is weak or unclear. Stay in [HEADS UP] with an explicit hedge (\"don't quote me\") or pass with \"-\".";
      case "MISSING":
        return "No usable evidence came back. Prefer \"-\" (pass); if you speak, stay in [HEADS UP] and explicitly hedge from memory.";
    }
  })();
  return `OVERALL EVIDENCE: ${overall}\n${hint}`;
}
