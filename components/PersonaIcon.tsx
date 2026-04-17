"use client";

/**
 * Peanut Gallery — Persona Icon
 *
 * Minimalist archetype glyphs that replace the persona emoji in the UI.
 * Each persona is represented by a single iconic object rather than their
 * likeness — clipboard for the fact-checker, flame for the troll, headphones
 * for the sound guy, microphone for the joke writer. Safer legal posture
 * than caricaturing real people, and more polished than flat emoji.
 *
 * Usage:
 *   <PersonaIcon personaId="producer" fallbackEmoji="🎯" color="#3b82f6" />
 *   <PersonaIcon personaId="producer" fallbackEmoji="🎯" firing />
 *
 * - `personaId` drives which SVG to render. Unknown/missing id falls back
 *   to the emoji string, so existing call sites stay visually stable even
 *   if the id pipeline isn't plumbed through yet.
 * - `color` tints the stroke via `currentColor`. Omit to inherit.
 * - `size` is a CSS length (default `1.3em`) so the glyph auto-scales with
 *   the parent's font-size — matches how the emoji behaved before.
 * - `firing` crossfades the glyph to a rotating ring spinner. Intended to
 *   be driven by a parent "awaiting response" state; clear it when the
 *   matching persona_done event arrives.
 *
 * Future growth: swap any id → src of a PNG/WebP render to upgrade to
 * 3D bobbleheads without touching any call site. The data contract
 * (`personaId` + `fallbackEmoji`) stays the same.
 */

import type { CSSProperties } from "react";

/** SVG path data for each persona archetype. 24×24 viewBox, stroke-only. */
export const PERSONA_ICON_PATHS: Record<string, string> = {
  // Clipboard with checkmark — the fact-checker's tool
  producer:
    "M9 3h6a1 1 0 0 1 1 1v1h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V4a1 1 0 0 1 1-1z M8.5 13l2.5 2.5 4.5-5",
  // Flame — the cynic's energy
  troll:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  // Headphones — the sound guy's gear
  soundfx:
    "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-6a9 9 0 0 1 18 0v6a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
  // Microphone on a stand — the joke writer's mic
  joker:
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8",
};

export interface PersonaIconProps {
  /** Persona id (producer/troll/soundfx/joker). Unknown → emoji fallback. */
  personaId?: string;
  /** Emoji string to render when the persona id is not recognized. */
  fallbackEmoji: string;
  /** Stroke color. Falls back to `currentColor` (parent CSS color). */
  color?: string;
  /** CSS length for both width and height. Default `1.3em` (scales with font-size). */
  size?: string;
  /** SVG stroke width. Default 2. */
  strokeWidth?: number;
  /** When true, crossfades the glyph out and an animated spinner in. */
  firing?: boolean;
  style?: CSSProperties;
  className?: string;
}

/**
 * Renders the persona's archetype glyph, or falls back to the emoji string.
 * When `firing` is true, layers a spinner on top and crossfades — matches the
 * "awaiting response" affordance on the main React button.
 */
export default function PersonaIcon({
  personaId,
  fallbackEmoji,
  color,
  size = "1.3em",
  strokeWidth = 2,
  firing = false,
  style,
  className,
}: PersonaIconProps) {
  const path = personaId ? PERSONA_ICON_PATHS[personaId] : undefined;
  const mergedStyle: CSSProperties = {
    ...(color ? { color } : {}),
    width: size,
    height: size,
    ...style,
  };

  const glyph = path ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  ) : (
    <span aria-hidden="true">{fallbackEmoji}</span>
  );

  return (
    <span
      className={`persona-icon-stack${firing ? " firing" : ""}${className ? ` ${className}` : ""}`}
      style={mergedStyle}
      aria-busy={firing || undefined}
      aria-label={firing ? "Waiting for response" : undefined}
    >
      <span className="persona-icon-layer persona-icon-glyph">{glyph}</span>
      <span className="persona-icon-layer persona-icon-spinner" aria-hidden="true">
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth={strokeWidth}
          />
          <path
            d="M12 3a9 9 0 0 1 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}
