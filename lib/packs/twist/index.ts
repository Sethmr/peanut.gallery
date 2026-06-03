/**
 * Startup-Roundtable pack (internal id: "twist").
 *
 * A startup-podcast writers'-room lineup of four AI personas mapped onto the
 * fixed archetype slots:
 *   producer  → The Correspondent (veteran tech-desk reporter — fact-checker)
 *   troll     → The Host          (loud, warm founder-coach)
 *   soundfx   → The Reframer      (dry pop-culture reframe)
 *   joker     → The Quant         (data comedian)
 *
 * These are generic ARCHETYPES — quality, not likeness. The pack was
 * de-identified on 2026-06-03 (§8C / §8A legal-hygiene pass; see
 * `lib/packs/twist/personas.ts` and `legal-research/BRIEF-2026-04-24.md`):
 * no real people, no real show, no verbatim sources, no private detail.
 * The internal pack id stays "twist" (an opaque identifier wired through
 * the registry, tests, and saved configs); only display content changed.
 *
 * The Director never looks at names — it only knows the 4 archetype slots.
 */

import type { Pack } from "../types";
import { twistPersonas } from "./personas";

export const twistPack: Pack = {
  meta: {
    id: "twist",
    name: "Startup Roundtable",
    description:
      "The Correspondent, The Host, The Reframer, The Quant — a startup-podcast writers'-room lineup.",
    universe: "Startup Roundtable",
    updatedAt: "2026-06-03",
  },
  personas: twistPersonas,
};

export { twistPersonas };
