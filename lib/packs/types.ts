/**
 * Peanut Gallery — Pack type system
 *
 * A "pack" is a swappable set of 4 persona voices that Peanut Gallery speaks
 * through. Every pack fills the same 4 archetype slots, keyed by fixed IDs:
 *
 *   producer  — the fact-checker foil           (Claude Haiku)
 *   troll     — the cynical commentator         (Groq Llama 70B)
 *   soundfx   — the sound-effects quiet genius  (Groq Llama 8B)
 *   joker     — the comedy writer               (Claude Haiku)
 *
 * The slot IDs are load-bearing: `lib/director.ts`'s `PERSONA_PATTERNS`,
 * the side-panel persona cards, the PersonaIcon component, and ~14 other
 * references are all keyed by them. Keeping the slots fixed keeps the pack
 * refactor purely content-additive — no Director changes, no UI re-keying.
 *
 * This file defines the `Pack` + `PackMeta` interfaces. The concrete packs
 * live in `lib/packs/<id>/`.
 */

import type { Persona } from "../personas";

/**
 * Shape of a pattern table: per-archetype regex groups the Director uses
 * to score a transcript chunk. Mirrors the internal shape in `lib/director.ts`
 * without coupling packs to a non-exported implementation detail.
 */
export interface PackPatterns {
  [archetypeId: string]: {
    patterns: RegExp[];
    keywords: RegExp[];
  };
}

export interface PackMeta {
  /** Machine id. Lowercase, url-safe; must match the folder name. */
  id: string;
  /** Human-facing name shown in the pack dropdown. */
  name: string;
  /** One-line description, shown as a tooltip / dropdown subtitle. */
  description: string;
  /** The show / universe this pack evokes (for the debug panel header). */
  universe: string;
  /** ISO 8601 date the pack was last edited. Useful for changelog entries. */
  updatedAt: string;
}

export interface Pack {
  meta: PackMeta;
  /** Exactly 4 personas, in slot order: producer, troll, soundfx, joker. */
  personas: Persona[];
  /**
   * OPTIONAL — if present, the Director uses these patterns instead of the
   * default set in `lib/director.ts`. Unset ⇒ use default patterns (current
   * behavior). v1.3.0 ships with this UNSET on both packs; the hook is here
   * so a future non-startup pack (e.g. general-interest talk show) can opt
   * into its own pattern table without a second refactor.
   */
  patterns?: PackPatterns;
}
