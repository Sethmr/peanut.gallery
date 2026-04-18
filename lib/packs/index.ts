/**
 * Peanut Gallery — Pack registry
 *
 * Central list of every shipping pack. `resolvePack(id)` is the SINGLE point
 * where the forward-compat promise lives — it never throws, never returns
 * undefined, and always falls back to the Howard pack on missing / unknown /
 * malformed ids. That means any new client sending a `pack` field to an old
 * server, or an old client not sending one at all to a new server, stays on
 * the pre-v1.3 behavior.
 */

import type { Pack, PackMeta } from "./types";
import { howardPack } from "./howard";
import { twistPack } from "./twist";

export const PACKS: Record<string, Pack> = {
  howard: howardPack,
  twist: twistPack,
};

export const DEFAULT_PACK_ID = "howard";

/**
 * Resolve a pack id (from user input, request body, storage) into a concrete
 * Pack object. Never throws. Unknown ids fall back to the default pack.
 *
 * - `undefined` / `null` / empty string → default pack
 * - whitespace-only / unknown id → default pack
 * - lowercased + trimmed before lookup, so client casing can't mismatch
 */
export function resolvePack(id: string | undefined | null): Pack {
  if (!id || typeof id !== "string") return PACKS[DEFAULT_PACK_ID];
  const key = id.toLowerCase().trim();
  if (!key) return PACKS[DEFAULT_PACK_ID];
  return PACKS[key] ?? PACKS[DEFAULT_PACK_ID];
}

/** Lightweight list for UI dropdowns. Stable order — default pack first. */
export function listPacks(): PackMeta[] {
  const order = [DEFAULT_PACK_ID, ...Object.keys(PACKS).filter((k) => k !== DEFAULT_PACK_ID)];
  return order.map((id) => PACKS[id].meta);
}

export type { Pack, PackMeta };
