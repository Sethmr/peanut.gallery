/**
 * Peanut Gallery — Pack registry
 *
 * Central list of every shipping pack. `resolvePack(id)` is the SINGLE point
 * where the forward-compat promise lives — it never throws, never returns
 * undefined, and always falls back to the Morning Crew pack on missing /
 * unknown / malformed ids. That means any new client sending a `pack` field
 * to an old server, or an old client not sending one at all to a new server,
 * stays on the default-pack behavior.
 *
 * The legacy `"howard"` id is aliased to the renamed Morning Crew pack so
 * persisted user settings from before the 2026-05-02 rename still resolve
 * cleanly. New code should use `"morning-crew"`. `listPacks()` filters the
 * alias out of the visible list so the dropdown doesn't show duplicates.
 */

import type { Pack, PackMeta } from "./types";
import { morningCrewPack } from "./morning-crew";
import { twistPack } from "./twist";

const LEGACY_ALIASES: Record<string, string> = {
  // Pre-2026-05-02 pack id. Persisted in user storage.
  howard: "morning-crew",
};

export const PACKS: Record<string, Pack> = {
  "morning-crew": morningCrewPack,
  twist: twistPack,
};

export const DEFAULT_PACK_ID = "morning-crew";

/**
 * Resolve a pack id (from user input, request body, storage) into a concrete
 * Pack object. Never throws. Unknown ids fall back to the default pack.
 *
 * - `undefined` / `null` / empty string → default pack
 * - whitespace-only / unknown id → default pack
 * - lowercased + trimmed before lookup, so client casing can't mismatch
 * - legacy aliases (e.g. `"howard"`) resolve to their renamed pack
 */
export function resolvePack(id: string | undefined | null): Pack {
  if (!id || typeof id !== "string") return PACKS[DEFAULT_PACK_ID];
  const key = id.toLowerCase().trim();
  if (!key) return PACKS[DEFAULT_PACK_ID];
  const resolved = LEGACY_ALIASES[key] ?? key;
  return PACKS[resolved] ?? PACKS[DEFAULT_PACK_ID];
}

/** Lightweight list for UI dropdowns. Stable order — default pack first. */
export function listPacks(): PackMeta[] {
  const order = [DEFAULT_PACK_ID, ...Object.keys(PACKS).filter((k) => k !== DEFAULT_PACK_ID)];
  return order.map((id) => PACKS[id].meta);
}

export type { Pack, PackMeta };
