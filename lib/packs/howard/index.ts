/**
 * Howard Stern Show pack — the default Peanut Gallery lineup since v1.0.0.
 *
 * This is the pack that `resolvePack(undefined)` always falls back to. Anything
 * that breaks this pack breaks the entire product's "zero-configuration" path,
 * so it should stay boringly stable.
 */

import type { Pack } from "../types";
import { howardPersonas } from "./personas";

export const howardPack: Pack = {
  meta: {
    id: "howard",
    name: "Howard Stern Show",
    description: "Baba Booey, The Troll, Fred, Jackie — the original lineup.",
    universe: "Stern Show",
    updatedAt: "2026-04-17",
  },
  personas: howardPersonas,
};

export { howardPersonas };
