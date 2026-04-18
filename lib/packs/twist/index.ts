/**
 * TWiST pack — This Week in Startups lineup.
 *
 * v1.3.0 Phase 2 made this real. Until v1.3.0 Phase 1 this file shipped as a
 * placeholder that re-exported the Howard personas under a TWiST PackMeta so
 * the registry and the test harness could compile. Phase 2 replaces that with
 * the actual TWiST lineup (Molly / Jason / Lon / Alex), authored in full voice
 * from the characterization notes in `docs/packs/twist/RESEARCH.md`.
 *
 * Role mapping (archetype slot → real person):
 *   producer  → Molly Wood
 *   troll     → Jason Calacanis
 *   soundfx   → Lon Harris
 *   joker     → Alex Wilhelm
 *
 * The Director never looks at names — it only knows the 4 archetype slots.
 * That means the pack swap is content-only: zero Director changes, zero
 * downstream engine changes, zero schema changes.
 */

import type { Pack } from "../types";
import { twistPersonas } from "./personas";

export const twistPack: Pack = {
  meta: {
    id: "twist",
    name: "This Week in Startups",
    description: "Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm — the TWiST lineup.",
    universe: "TWiST",
    updatedAt: "2026-04-17",
  },
  personas: twistPersonas,
};

export { twistPersonas };
