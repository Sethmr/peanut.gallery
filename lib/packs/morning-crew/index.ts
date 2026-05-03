/**
 * Morning Crew pack — the default Peanut Gallery lineup.
 *
 * Four archetype personas in the morning-radio shock-jock-show format:
 *   producer  → The Producer    (sidekick / fact-checker foil)
 *   troll     → The Heckler     (composite caller / antagonist)
 *   soundfx   → The Sound Guy   (drops, zingers, impressions)
 *   joker     → The Joke Writer (setups + punchlines, signature laugh)
 *
 * This is the pack that `resolvePack(undefined)` always falls back to. Anything
 * that breaks this pack breaks the entire product's "zero-configuration" path,
 * so it should stay boringly stable.
 *
 * Renamed from "Howard Stern Show" / "howard" to "Morning Crew" / "morning-crew"
 * on 2026-05-02 as a §8C / §8A legal-hygiene pass per
 * `legal-research/BRIEF-2026-04-24.md`. Personas are now archetypal — quality,
 * not likeness. See `legal-research/CONTEXT.md` for the audit trail entry.
 */

import type { Pack } from "../types";
import { morningCrewPersonas } from "./personas";

export const morningCrewPack: Pack = {
  meta: {
    id: "morning-crew",
    name: "Morning Crew",
    description: "Four morning-radio archetypes — producer, heckler, sound guy, joke writer.",
    universe: "Morning Radio",
    updatedAt: "2026-05-02",
  },
  personas: morningCrewPersonas,
};

export { morningCrewPersonas };
