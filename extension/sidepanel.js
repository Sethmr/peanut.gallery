/**
 * Peanut Gallery — Side Panel
 *
 * The main UI. Shows transcript + persona reactions in a sidebar
 * next to the YouTube video. Receives events from the offscreen
 * document via chrome.runtime.onMessage.
 */

// ── Persona pack definitions (must match lib/packs/* on the server) ──
//
// The extension is intentionally un-bundled, so pack metadata is duplicated
// here as a plain object. Archetype slot IDs (producer/troll/soundfx/joker)
// are LOAD-BEARING — they match the server's Director output and every DOM
// lookup below keys off them. NAMES, emojis, and colors change per pack.
//
// Adding a new pack: add an entry to PACKS_CLIENT (same 4 slot ids, any
// names/emojis/colors), then add a matching <option> to sidepanel.html's
// packSelect. The server resolves unknown pack ids to "howard" via
// resolvePack(), so an older server won't reject a newer client's choice —
// the UI will simply show different names than the personas that speak.
const PACKS_CLIENT = {
  howard: [
    { id: "producer", name: "Baba Booey", role: "Fact-Checker", emoji: "🎯", color: "#3b82f6" },
    { id: "troll", name: "The Troll", role: "Cynical Commentator", emoji: "🔥", color: "#ef4444" },
    { id: "soundfx", name: "Fred", role: "Sound Effects", emoji: "🎧", color: "#a855f7" },
    { id: "joker", name: "Jackie", role: "Comedy Writer", emoji: "😂", color: "#f59e0b" },
  ],
  twist: [
    { id: "producer", name: "Molly", role: "Fact-Checker", emoji: "📓", color: "#3b82f6" },
    { id: "troll", name: "Jason", role: "Provocateur", emoji: "🎙️", color: "#ef4444" },
    { id: "soundfx", name: "Lon", role: "The Reframe", emoji: "🎬", color: "#a855f7" },
    { id: "joker", name: "Alex", role: "Data Comedian", emoji: "📊", color: "#f59e0b" },
  ],
};
const DEFAULT_PACK_ID = "howard";

// Short display names for the trace panel's pack label. Kept separate from
// PACKS_CLIENT (which is only personas) so the sidebar header doesn't have
// to inline a longer name like "This Week in Startups". Falls back to the
// pack id for anything not listed.
const PACK_DISPLAY_NAMES = {
  howard: "howard",
  twist: "twist",
};
function packDisplayName(id) {
  return PACK_DISPLAY_NAMES[id] || id || "—";
}

// Pretty-print label for the masthead pack badge (the little tag that sits
// under the nameplate). Kept separate from PACK_DISPLAY_NAMES (which is
// the lowercased trace-panel label) so the masthead can show a more
// "newsstand" version — "Howard" / "TWiST" — without reshaping the trace.
const PACK_BADGE_NAMES = {
  howard: "Howard",
  twist: "TWiST",
};
function packBadgeName(id) {
  return PACK_BADGE_NAMES[id] || id || "—";
}

// Map archetype slot → tabloid role tag. These are LOAD-BEARING for the
// feed-entry CSS classes (fact/dunk/cue/bit each have their own tag color
// in sidepanel.html) and the footer filter pills. Every pack uses the same
// four slots, so one map serves all packs.
const ROLE_FOR_SLOT = {
  producer: "fact",
  troll: "dunk",
  soundfx: "cue",
  joker: "bit",
};
function roleForSlot(id) {
  return ROLE_FOR_SLOT[id] || "bit";
}

// Compute the block-letter initials shown on a mug avatar. Takes the first
// letter of each whitespace-separated token in the persona name, caps at
// 2 characters, uppercases the result. Falls back to "PG" for anything
// empty so the mug never renders as a void.
function personaInitials(name) {
  if (!name || typeof name !== "string") return "PG";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PG";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Mutable reference to the active pack's persona array. The server picks up
// the pack id from the /api/transcribe body and never reads names — so any
// mismatch between client names and server personas degrades to "unknown
// pack → Howard on the server" while the UI still renders its chosen labels.
let currentPackId = DEFAULT_PACK_ID;

// Pack id committed to the currently-running session. Captured at Start
// Listening time and cleared on showIdle. Distinct from currentPackId
// because the dropdown can drift mid-session (the hint explicitly says
// "new pack applies the next time you hit Start Listening"). The trace
// label surfaces THIS value when capturing — otherwise reading a decision
// row while the dropdown shows a different pack would be confusing.
let sessionPackId = null;
function currentPersonas() {
  return PACKS_CLIENT[currentPackId] || PACKS_CLIENT[DEFAULT_PACK_ID];
}

// Legacy alias — older code paths read `PERSONAS` directly. Route them all
// through a getter so pack swaps take effect immediately. The getter keeps
// call sites unchanged (`PERSONAS.find`, `for (const p of PERSONAS)`) so
// v1.2 call sites don't need a sweep; they just pick up the active pack.
const PERSONAS = new Proxy(
  {},
  {
    get(_t, prop) {
      const arr = currentPersonas();
      const val = arr[prop];
      return typeof val === "function" ? val.bind(arr) : val;
    },
    has(_t, prop) {
      return prop in currentPersonas();
    },
  }
);

// ── Persona archetype glyphs ──
// Minimalist monoline SVG paths — clipboard, flame, headphones, mic — drawn
// in a 24×24 viewBox. These used to mirror the React PersonaIcon component
// in the web app, but the /watch surface was retired in the v1.5 legacy
// cleanup; the glyphs now only live here.
const PERSONA_ICON_PATHS = {
  producer:
    "M9 3h6a1 1 0 0 1 1 1v1h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V4a1 1 0 0 1 1-1z M8.5 13l2.5 2.5 4.5-5",
  troll:
    "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
  soundfx:
    "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-6a9 9 0 0 1 18 0v6a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
  joker:
    "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8",
};

/**
 * Render the persona's archetype glyph as an HTML string. Falls back to the
 * emoji when the persona id is unrecognized. `size` is any CSS length
 * (default "1.3em" — scales with parent font-size). `color` sets the stroke;
 * omit to inherit via currentColor.
 *
 * When `withSpinner` is true, wraps the glyph in a two-layer `.persona-icon-stack`
 * and adds a spinner layer underneath — CSS crossfades between them when the
 * stack gets a `.firing` class. Used on the avatars so tapping one fades the
 * icon to a spinner until the matching persona_done event returns.
 */
function personaGlyphHTML(p, size = "1.3em", color = null, withSpinner = false) {
  const path = PERSONA_ICON_PATHS[p.id];
  const stroke = color || "currentColor";
  const glyph = path
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="${size}" height="${size}" aria-hidden="true"><path d="${path}"/></svg>`
    : `<span>${p.emoji}</span>`;

  if (!withSpinner) return glyph;

  // Spinner: muted ring + partial arc, same shape as the web app version.
  const spinner = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="${stroke}" stroke-opacity="0.2" stroke-width="2"/><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `<span class="persona-icon-stack" style="width:${size}; height:${size}"><span class="persona-icon-layer persona-icon-glyph">${glyph}</span><span class="persona-icon-layer persona-icon-spinner">${spinner}</span></span>`;
}

// ── Peanut mascots (v1.8) ──
//
// Illustrated SVG peanuts with a signature prop per persona. Returns an SVG
// string sized to fill its container (64×64 viewBox). Returns null when no
// mascot exists — caller falls back to the initials-on-hatch mug.
//
// Shared anatomy lives in buildPeanutSVG: body, shell grooves, top highlight,
// ground shadow, eyes, and one of a few mouth shapes. Each persona provides
// only its prop markup and (optionally) extra <defs> for prop gradients.
// Gradient ids are namespaced per persona+pack so overlapping stops don't
// collide when packs swap.
const PEANUT_MOUTHS = {
  smile: `<path d="M28.5 24c1.5 1.6 5.5 1.6 7 0" fill="none" stroke="#1E1208" stroke-width="1.3" stroke-linecap="round"/>`,
  smirk: `<path d="M28 24q3 2 7 -.6" fill="none" stroke="#1E1208" stroke-width="1.4" stroke-linecap="round"/>`,
  grin:  `<path d="M27.5 23.2q4.5 3.8 9 0 -4.5 2 -9 0Z" fill="#1E1208" stroke="#1E1208" stroke-width="1" stroke-linejoin="round"/>`,
  flat:  `<path d="M29 24.2h6" fill="none" stroke="#1E1208" stroke-width="1.3" stroke-linecap="round"/>`,
  open:  `<ellipse cx="32" cy="24.2" rx="2.2" ry="1.6" fill="#1E1208"/>`,
};

function buildPeanutSVG({
  ns,
  extraDefs = "",
  face = "smile",
  prop = "",
  bodyStops = null,
  bodyStroke = "#8B5E2F",
  eyesLight = false,
}) {
  // The peanut body sits in a 64×64 viewBox with natural padding around it,
  // which reads as a floating blob at 42px. Wrapping everything in a scale
  // transform around the viewBox center fills more of the mug without
  // touching every path coordinate. 1.22 lands the body at ~85% of the
  // circle diameter — dominant but with breathing room for the ring.
  //
  // bodyStops/bodyStroke let one-off personas (Troll = boiled) swap the
  // shell color without forking the whole body path.
  // eyesLight switches to a big-white-sclera pop-eye style; used on dark
  // bodies where the default dark pupils would disappear.
  const stops = bodyStops || `
    <stop offset="0%" stop-color="#F7D9A5"/>
    <stop offset="55%" stop-color="#DFAE70"/>
    <stop offset="100%" stop-color="#B4824B"/>`;
  const eyes = eyesLight
    ? `<circle cx="27" cy="19" r="2.8" fill="#fff"/>
       <circle cx="37" cy="19" r="2.8" fill="#fff"/>
       <ellipse cx="27" cy="19.4" rx="1.3" ry="1.8" fill="#1E1208"/>
       <ellipse cx="37" cy="19.4" rx="1.3" ry="1.8" fill="#1E1208"/>
       <circle cx="27.5" cy="18.6" r=".55" fill="#fff"/>
       <circle cx="37.5" cy="18.6" r=".55" fill="#fff"/>`
    : `<ellipse cx="27" cy="19" rx="2.1" ry="2.6" fill="#1E1208"/>
       <ellipse cx="37" cy="19" rx="2.1" ry="2.6" fill="#1E1208"/>
       <circle cx="27.6" cy="18.2" r=".8" fill="#fff"/>
       <circle cx="37.6" cy="18.2" r=".8" fill="#fff"/>`;
  return `<svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mbody-${ns}" cx="38%" cy="30%" r="72%">${stops}</radialGradient>${extraDefs}
    </defs>
    <g transform="translate(32 32) scale(1.22) translate(-32 -32)">
      <ellipse cx="32" cy="60" rx="13" ry="1.8" fill="#000" fill-opacity=".22"/>
      <path d="M32 4C22 4 18 10 18 19c0 5 3 8 6 10-4 2-10 6-10 16 0 9 8 15 18 15s18-6 18-15c0-10-6-14-10-16 3-2 6-5 6-10 0-9-4-15-14-15Z" fill="url(#mbody-${ns})" stroke="${bodyStroke}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M21 14c3 1 6 1 8 0M35 14c3 1 5 1 8 0" fill="none" stroke="${bodyStroke}" stroke-width=".8" stroke-linecap="round" opacity=".5"/>
      <ellipse cx="25" cy="11" rx="5.5" ry="3" fill="#FFF5DF" opacity=".55"/>
      ${eyes}
      ${PEANUT_MOUTHS[face] || PEANUT_MOUTHS.smile}
      ${prop}
    </g>
  </svg>`;
}

function personaMascotHTML(personaId, packId) {
  const pack = packId || "howard";
  const ns = `${pack}-${personaId}`;

  // ── Howard pack ──
  if (pack === "howard" && personaId === "producer") {
    // Baba Booey — wooden clipboard with a big blue checkmark.
    return buildPeanutSVG({
      ns, face: "smile",
      extraDefs: `<linearGradient id="mclip-${ns}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#A47E4D"/><stop offset="100%" stop-color="#69482A"/></linearGradient>`,
      prop: `
        <path d="M19 39c-3 2-3 5-1 7M45 39c3 2 3 5 1 7" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="19" y="36" width="26" height="19" rx="1.8" fill="url(#mclip-${ns})" stroke="#3E2A14" stroke-width="1"/>
        <rect x="28" y="33.8" width="8" height="3.4" rx=".8" fill="#3E2A14"/>
        <circle cx="32" cy="35.5" r=".8" fill="#A8A6A0"/>
        <rect x="21" y="39" width="22" height="14" rx=".5" fill="#F6F0E2"/>
        <path d="M25 48l4 4 9-9" fill="none" stroke="#3b82f6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    });
  }
  if (pack === "howard" && personaId === "troll") {
    // The Troll — BOILED peanut. Dark wet shell, smirk, beads of moisture
    // running down the sides. No prop — the boiled state IS the character:
    // "guy's in hot water and smirking about it."
    return buildPeanutSVG({
      ns, face: "smirk",
      eyesLight: true,
      bodyStroke: "#2A1408",
      bodyStops: `
        <stop offset="0%" stop-color="#8B5530"/>
        <stop offset="55%" stop-color="#5A3018"/>
        <stop offset="100%" stop-color="#2F1608"/>`,
      prop: `
        <!-- Extra wet-sheen highlights layered on top of body -->
        <ellipse cx="40" cy="14" rx="2" ry="4" fill="#FFF" opacity=".22" transform="rotate(25 40 14)"/>
        <ellipse cx="43" cy="40" rx="2.5" ry="5" fill="#FFF" opacity=".18" transform="rotate(-18 43 40)"/>
        <!-- Moisture beads dribbling down the shell -->
        <ellipse cx="16" cy="30" rx="1.1" ry="1.5" fill="#B8CED9" opacity=".85"/>
        <ellipse cx="47" cy="38" rx="1.2" ry="1.6" fill="#B8CED9" opacity=".85"/>
        <ellipse cx="22" cy="52" rx=".9" ry="1.3" fill="#B8CED9" opacity=".8"/>
        <ellipse cx="44" cy="54" rx="1" ry="1.4" fill="#B8CED9" opacity=".8"/>
        <!-- Tiny sweat-bead at temple -->
        <ellipse cx="45" cy="20" rx=".9" ry="1.3" fill="#B8CED9" opacity=".8"/>`,
    });
  }
  if (pack === "howard" && personaId === "soundfx") {
    // Fred — big purple DJ headphones wrapped over the top lobe.
    return buildPeanutSVG({
      ns, face: "flat",
      prop: `
        <path d="M14 18Q32 2 50 18" fill="none" stroke="#3E2A14" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="15" cy="22" rx="4.5" ry="5.5" fill="#a855f7" stroke="#3E2A14" stroke-width="1.2"/>
        <ellipse cx="49" cy="22" rx="4.5" ry="5.5" fill="#a855f7" stroke="#3E2A14" stroke-width="1.2"/>
        <ellipse cx="15" cy="22" rx="2" ry="3" fill="#6B0F87"/>
        <ellipse cx="49" cy="22" rx="2" ry="3" fill="#6B0F87"/>
        <ellipse cx="14" cy="20" rx=".9" ry="1.4" fill="#fff" opacity=".4"/>
        <ellipse cx="48" cy="20" rx=".9" ry="1.4" fill="#fff" opacity=".4"/>`,
    });
  }
  if (pack === "howard" && personaId === "joker") {
    // Jackie — vintage stand mic with amber-trimmed head. Toothy grin.
    return buildPeanutSVG({
      ns, face: "grin",
      prop: `
        <path d="M22 42q-2 4 6 4M42 42q2 4 -6 4" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="30.5" y="42" width="3" height="14" rx="1" fill="#2A2A2A"/>
        <rect x="26" y="55.5" width="12" height="2" rx=".5" fill="#2A2A2A"/>
        <ellipse cx="32" cy="38" rx="6" ry="7" fill="#2A2A2A" stroke="#f59e0b" stroke-width="1.2"/>
        <path d="M28 35h8M28 38h8M28 41h8" stroke="#555" stroke-width=".6"/>
        <ellipse cx="30" cy="34.5" rx="1.2" ry="1.8" fill="#fff" opacity=".3"/>`,
    });
  }

  // ── TWiST pack ──
  if (pack === "twist" && personaId === "producer") {
    // Molly — spiral-bound reporter's notebook with blue ruled lines.
    return buildPeanutSVG({
      ns, face: "smile",
      prop: `
        <path d="M19 39q-2 3 1 7M45 39q2 3 -1 7" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="20" y="38" width="24" height="18" rx="1" fill="#F0EADA" stroke="#3E2A14" stroke-width="1"/>
        <path d="M23 37v2M27 37v2M31 37v2M35 37v2M39 37v2M43 37v2" stroke="#3E2A14" stroke-width="1" stroke-linecap="round"/>
        <line x1="23" y1="44" x2="40" y2="44" stroke="#3b82f6" stroke-width="1" stroke-linecap="round"/>
        <line x1="23" y1="47" x2="36" y2="47" stroke="#9CA3AF" stroke-width=".7" stroke-linecap="round"/>
        <line x1="23" y1="50" x2="39" y2="50" stroke="#3b82f6" stroke-width="1" stroke-linecap="round"/>
        <line x1="23" y1="53" x2="34" y2="53" stroke="#9CA3AF" stroke-width=".7" stroke-linecap="round"/>`,
    });
  }
  if (pack === "twist" && personaId === "troll") {
    // Jason — megaphone, cone pointing up-right. Open yelling mouth.
    return buildPeanutSVG({
      ns, face: "open",
      extraDefs: `<linearGradient id="mmega-${ns}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8B1010"/><stop offset="60%" stop-color="#ef4444"/><stop offset="100%" stop-color="#C11A00"/></linearGradient>`,
      prop: `
        <path d="M22 44q-3 4 2 8M42 44q4 4 -2 8" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M22 40L50 32L52 54L26 54Z" fill="url(#mmega-${ns})" stroke="#7A0000" stroke-width="1.2" stroke-linejoin="round"/>
        <ellipse cx="51" cy="43" rx="2.2" ry="10" fill="#7A0000" opacity=".85"/>
        <path d="M24 41L25 48" stroke="#FFF" stroke-width="1.2" opacity=".4" stroke-linecap="round"/>
        <path d="M55 30q4 1 5 4M56 42q4 0 6 -1M55 55q4 1 5 4" fill="none" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>`,
    });
  }
  if (pack === "twist" && personaId === "soundfx") {
    // Lon — black-and-white clapperboard with a purple "scene" tag.
    return buildPeanutSVG({
      ns, face: "flat",
      prop: `
        <path d="M19 42q-2 3 1 6M45 42q2 3 -1 6" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="19" y="42" width="26" height="14" rx=".8" fill="#2A2A2A" stroke="#000" stroke-width="1"/>
        <rect x="21" y="44" width="22" height="10" fill="#4A3E28"/>
        <line x1="21" y1="48" x2="43" y2="48" stroke="#2A2A2A" stroke-width=".5"/>
        <line x1="21" y1="51" x2="43" y2="51" stroke="#2A2A2A" stroke-width=".5"/>
        <rect x="23" y="45" width="6" height="2" rx=".3" fill="#a855f7"/>
        <rect x="19" y="37" width="26" height="5" fill="#2A2A2A"/>
        <polygon points="19,37 22,37 25,42 22,42" fill="#fff"/>
        <polygon points="25,37 28,37 31,42 28,42" fill="#fff"/>
        <polygon points="31,37 34,37 37,42 34,42" fill="#fff"/>
        <polygon points="37,37 40,37 43,42 40,42" fill="#fff"/>
        <polygon points="43,37 45,37 45,40 44,40" fill="#fff"/>`,
    });
  }
  if (pack === "twist" && personaId === "joker") {
    // Alex — three-slice pie chart, amber as the dominant segment.
    return buildPeanutSVG({
      ns, face: "smirk",
      prop: `
        <path d="M19 39q-2 3 1 7M45 39q2 3 -1 7" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="32" cy="45" r="10" fill="#F6F0E2" stroke="#3E2A14" stroke-width="1.2"/>
        <path d="M32 45L32 35A10 10 0 0 1 40.7 50Z" fill="#f59e0b"/>
        <path d="M32 45L40.7 50A10 10 0 0 1 24 49Z" fill="#ef4444"/>
        <path d="M32 45L24 49A10 10 0 0 1 32 35Z" fill="#3b82f6"/>
        <circle cx="32" cy="45" r="1.2" fill="#3E2A14"/>`,
    });
  }

  return null;
}

// ── State ──
let capturing = false;
let sessionId = null;
let transcriptFinal = "";
let transcriptInterim = "";
let feedEntries = []; // { id, personaId, role, text, timestamp }
let streamBuffers = {}; // personaId → accumulated streaming text
let streamingPersonaId = null;
let messageCount = 0;

// Per-persona mute set. Persisted in chrome.storage.local as a plain array
// under `mutedPersonas`. Client-side filter for v1 — muted personas still
// stream on the server (the pack LLM doesn't know), but their persona +
// persona_done events are suppressed from the feed + streaming UI, and
// their mug carries a `.muted` strike-through.
let mutedPersonas = new Set();

// Active theme token. "paper" (default) or "night". Applied to
// body.dataset.theme on load + on button click, persisted under `theme`.
let currentTheme = "paper";

// Footer filter state. Each role flag toggles visibility of its feed-entry
// class. Rendered into the gallery via data attribute — the CSS does the
// hiding so we don't have to churn individual entries on every flip.
const activeFilters = new Set(["fact", "dunk", "cue", "bit"]);

// React button force-state tracking.
// When the user taps 🔥 React, the button flips to a spinner until at least
// `forceReactTarget` persona_done events have come back. Safety timeout at 15s
// guarantees the UI can never get stuck in the loading state.
let forceReactActive = false;
let forceReactReceived = 0;
const FORCE_REACT_TARGET = 2;
const FORCE_REACT_TIMEOUT_MS = 15_000;
let forceReactTimeoutId = null;
let forceReactOriginalHtml = null;

// Per-persona "awaiting response" state. When the user taps a persona avatar,
// we flip that icon-stack to .firing (glyph crossfades to a spinner) until the
// matching persona_done event arrives — with a matching 15s safety timeout so
// the UI can't get stuck on a spinner if the backend falls silent.
const firingPersonaIds = Object.create(null);
const firingTimeoutIds = Object.create(null);

// The tab Peanut Gallery is currently capturing from. Set on status=started
// (populated by background via GET_CAPTURED_TAB). Lets us show a persistent
// "Listening to: …" banner even when the user switches tabs.
let capturedTabInfo = null; // { tabId, title, url, windowId }

// ── DOM refs ──
const setupSection = document.getElementById("setupSection");
const statusBar = document.getElementById("statusBar");
const statusText = document.getElementById("statusText");
const statusTime = document.getElementById("statusTime");
const statusTag = document.getElementById("statusTag");
const statusDetail = document.getElementById("statusDetail");
const episodeCard = document.getElementById("episodeCard");
const episodeCardTitle = document.getElementById("episodeCardTitle");
const episodeCardSub = document.getElementById("episodeCardSub");
const episodeCardProgressFill = document.getElementById("episodeCardProgressFill");

// ── Free-tier timer state ──
//
// Only active when the user does NOT have all three required keys in
// Settings → Backend & keys. Ticks up from 0 during capture; flips to
// CAP REACHED when it hits FREE_TIER_MAX_SECONDS or when the backend
// emits TRIAL_EXHAUSTED / INSTALL_ID_REQUIRED (per lib/free-tier-limiter.ts).
const FREE_TIER_MAX_SECONDS = 15 * 60; // 15:00 cap, matches server limiter
let freeTierIntervalId = null;
let freeTierStartMs = 0;
let freeTierCapped = false;

function hasRequiredUserKeys() {
  const dg = (deepgramKeyInput?.value || "").trim();
  const anth = (anthropicKeyInput?.value || "").trim();
  const xai = (xaiKeyInput?.value || "").trim();
  // Brave is optional — extension falls back to xAI Live Search when
  // searchEngine is "brave" but no Brave key is set.
  return !!(dg && anth && xai);
}

function formatHMS(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function startFreeTierTimer() {
  stopFreeTierTimer();
  freeTierCapped = false;
  freeTierStartMs = Date.now();
  statusBar.classList.remove("capped");
  statusTime.textContent = "00:00:00";
  if (episodeCard) {
    episodeCard.classList.add("with-progress");
    episodeCard.classList.remove("capped");
  }
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "0%";
  freeTierIntervalId = setInterval(() => {
    const elapsed = (Date.now() - freeTierStartMs) / 1000;
    if (!freeTierCapped && elapsed >= FREE_TIER_MAX_SECONDS) {
      flipToCapReached();
      return;
    }
    statusTime.textContent = formatHMS(Math.min(elapsed, FREE_TIER_MAX_SECONDS));
    // Progress bar on the episode card tracks the same elapsed/cap ratio.
    if (episodeCardProgressFill) {
      const pct = Math.min(100, (elapsed / FREE_TIER_MAX_SECONDS) * 100);
      episodeCardProgressFill.style.width = pct + "%";
    }
  }, 1000);
}

function stopFreeTierTimer() {
  if (freeTierIntervalId != null) {
    clearInterval(freeTierIntervalId);
    freeTierIntervalId = null;
  }
}

function flipToCapReached() {
  freeTierCapped = true;
  statusBar.classList.add("capped");
  statusBar.classList.remove("live", "active");
  statusText.textContent = "Cap reached";
  statusTime.textContent = formatHMS(FREE_TIER_MAX_SECONDS);
  statusTag.textContent = "PAUSED";
  statusDetail.textContent = "Daily free minutes exhausted · resets at midnight";
  // Episode-card progress bar flips to the cap treatment: yellow fill, full
  // width. Matches the status strip's dot-goes-yellow signal.
  if (episodeCard) episodeCard.classList.add("capped");
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "100%";
  stopFreeTierTimer();
}

function syncStatusDetail() {
  // Keep the secondary-row detail in sync with the captured tab title.
  // Only runs when the timer row is visible (free tier); paid users
  // don't see the secondary row at all.
  if (!statusBar.classList.contains("with-timer")) return;
  if (freeTierCapped) return; // cap message takes priority
  const title = capturedTabInfo?.title;
  statusDetail.textContent = title || "—";
}
const controlsRow = document.getElementById("controlsRow");
const personasRow = document.getElementById("personasRow");
const transcriptSection = document.getElementById("transcriptSection");
const transcriptTextEl = document.getElementById("transcriptText");
const gallery = document.getElementById("gallery");
const emptyState = document.getElementById("emptyState");
const emptyStateLg = document.getElementById("emptyStateLg");
const emptyStateDk = document.getElementById("emptyStateDk");
const emptyStateCta = document.getElementById("emptyStateCta");
const errorBanner = document.getElementById("errorBanner");
const errorText = document.getElementById("errorText");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const fireBtn = document.getElementById("fireBtn");
const serverUrlInput = document.getElementById("serverUrl");
const deepgramKeyInput = document.getElementById("deepgramKey");
const anthropicKeyInput = document.getElementById("anthropicKey");
const xaiKeyInput = document.getElementById("xaiKey");
const braveKeyInput = document.getElementById("braveKey");
// Search-engine selector — controls which backend the Producer uses for
// fact-checking. Values: "brave" (default) | "xai". Older sidepanel.html
// without this element drops through to null and we coerce to "brave".
const searchEngineSelect = document.getElementById("searchEngine");
const passthroughToggle = document.getElementById("passthroughToggle");
const outputDeviceSelect = document.getElementById("outputDevice");
// Response-rate dial (1-10, default 5). If an older build somehow loads a new
// sidepanel.js without the HTML update, the ?.value pattern below keeps us safe.
const responseRateSelect = document.getElementById("responseRate");
// Persona pack selector. Chrome side-panel DOM is created fresh each open,
// so we're guaranteed the element exists when this file runs.
const packSelect = document.getElementById("packSelect");
// Container for the two-card pack chooser shown under the (hidden) select.
// Populated by renderPackChooser() at init + on every pack change. Clicks
// on a card drive packSelect via dispatchEvent('change'), so the existing
// change-handler cascade (buildPersonaAvatars, renderMutesList, trace label)
// runs unchanged.
const packChooser = document.getElementById("packChooser");
const capturedTabBanner = document.getElementById("capturedTabBanner");
const capturedTabTitle = document.getElementById("capturedTabTitle");

// v1.4 masthead + drawer refs. Grabbed defensively — if we're running in
// an older extension context with the previous HTML, these return null
// and every handler below no-ops rather than throwing.
const footer = document.getElementById("footer");
const settingsToggleBtn = document.getElementById("settingsToggle");
const settingsDrawer = document.getElementById("settingsDrawer");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");
const drawerBackBtn = document.getElementById("drawerBackBtn");
const mutesContainer = document.getElementById("mutesContainer");
const themePaperBtn = document.getElementById("themePaperBtn");
const themeNightBtn = document.getElementById("themeNightBtn");
const exportCopyBtn = document.getElementById("exportCopyBtn");
const exportDownloadBtn = document.getElementById("exportDownloadBtn");
// Footer filter pills — one per role (fact / dunk / cue / bit). Indexed by
// data-filter. Collected once at load.
const filterPillEls = Array.from(
  document.querySelectorAll("#footer .pill[data-filter]")
);

// ── Install ID ──
// Stable per-installation UUID. Generated on first load, persisted in
// chrome.storage.local, and sent to the hosted backend as X-Install-Id so
// it can meter shared demo-key usage per install. Self-hosters never look
// at it — ENABLE_FREE_TIER_LIMIT=false on their server ignores the header.
// This is a SOFT identifier — clearing extension storage resets it. That's
// fine; the goal is fair sharing of a free pool, not anti-abuse hardening.
let installId = null;
async function ensureInstallId() {
  const { installId: existing } = await chrome.storage.local.get("installId");
  if (existing && typeof existing === "string" && existing.length >= 16) {
    installId = existing;
    return installId;
  }
  const fresh =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : // Fallback for any truly ancient Chrome — produces a 32-hex-char id.
        Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
  await chrome.storage.local.set({ installId: fresh });
  installId = fresh;
  return installId;
}

// ── Init ──
loadSettings();
ensureInstallId();
buildPersonaAvatars();
renderPackChooser();
checkStatus();
detectCurrentTab();

// Detect the current tab and show its title
function detectCurrentTab() {
  chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    const detectedTab = document.getElementById("detectedTab");
    const detectedTitle = document.getElementById("detectedTitle");
    if (response.title) {
      detectedTitle.textContent = response.title;
      detectedTab.style.display = "block";
    }
  });
}

// ── Settings ──
function loadSettings() {
  chrome.storage.local.get(
    [
      "serverUrl",
      "deepgramKey",
      "anthropicKey",
      "xaiKey",
      "braveKey",
      "searchEngine",
      "passthrough",
      "outputDeviceId",
      "responseRate",
      "packId",
      "theme",
      "mutedPersonas",
    ],
    (data) => {
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      // Key fields stay empty by default. The backend has its own demo keys
      // in env vars and will use them when the extension sends no key headers.
      // If the user pastes their own key here, the extension forwards it via
      // X-*-Key headers and the backend uses those instead.
      deepgramKeyInput.value = data.deepgramKey || "";
      anthropicKeyInput.value = data.anthropicKey || "";
      if (xaiKeyInput) xaiKeyInput.value = data.xaiKey || "";
      braveKeyInput.value = data.braveKey || "";
      // Search-engine selector. Valid values are "brave" and "xai"; anything
      // else (or missing) falls back to "brave" to mirror the backend default.
      if (searchEngineSelect) {
        const savedEngine = data.searchEngine === "xai" ? "xai" : "brave";
        searchEngineSelect.value = savedEngine;
      }

      // Audio routing defaults: passthrough ON + system default device.
      // Matches pre-v1.1 behavior exactly for existing users.
      passthroughToggle.checked = data.passthrough !== false;
      const savedDevice = data.outputDeviceId || "default";
      // Selected device is applied once enumerateOutputDevices() runs (async).
      outputDeviceSelect.dataset.pendingValue = savedDevice;

      // Response-rate dial: restore saved value (1-10). Default of 5 is
      // baked into the HTML <option selected>, so a first-time user gets
      // exactly pre-v1.2 cadence. Clamp + validate in case storage was
      // corrupted by an extension migration.
      if (responseRateSelect) {
        const raw = Number.parseInt(data.responseRate, 10);
        const clamped = Number.isFinite(raw) ? Math.max(1, Math.min(10, raw)) : 5;
        responseRateSelect.value = String(clamped);
      }

      // Persona pack: restore saved pack or fall back to the default. An
      // unknown pack id (old extension storage, manual tampering) coerces to
      // the default, and the server does the same on its end via
      // resolvePack(). First-time users land on Howard, which matches pre-v1.3
      // behavior exactly.
      const savedPack =
        typeof data.packId === "string" && data.packId in PACKS_CLIENT
          ? data.packId
          : DEFAULT_PACK_ID;
      // Theme: paper (default) or night. Applied to body.dataset.theme so
      // the CSS variable cascade flips without a class rename. Unknown
      // values coerce to paper to keep the default consistent.
      currentTheme = data.theme === "night" ? "night" : "paper";
      document.body.dataset.theme = currentTheme;

      // Muted personas — persisted as an array, rehydrated into a Set for
      // O(1) membership checks in the stream/feed hot path. Defensive
      // against an older shape or a hand-edited storage value.
      mutedPersonas = new Set(
        Array.isArray(data.mutedPersonas) ? data.mutedPersonas : []
      );

      // buildPersonaAvatars() ran synchronously at init with the default
      // pack. If the user's saved pack is different (e.g. TWiST persisted
      // from a previous session), the avatar row is currently showing the
      // wrong faces — rebuild it so the avatars, the dropdown, and the
      // packId we'll send to /api/transcribe all agree on the same pack
      // before Start. Skip the rebuild when the saved pack matches the
      // default to avoid a wasted re-render on the common path. We also
      // ALWAYS rebuild if any personas are muted, so the strike-through
      // `.muted` class lands on the right mug from the jump.
      const packChanged = savedPack !== currentPackId;
      currentPackId = savedPack;
      if (packSelect) packSelect.value = savedPack;
      if (packChanged || mutedPersonas.size > 0) buildPersonaAvatars();
      // Repaint the pack preview with the restored pack — always, so a
      // saved TWiST user sees their lineup under the dropdown without
      // having to open and close it.
      if (packChanged) renderPackChooser();
      // Mirror the restored selection in the trace header so the debug
      // panel reads correctly the first time a user opens it — even
      // before they've started a session. sessionPackId is still null
      // here, so this renders the muted pre-session style.
      updateTracePackLabel();

      // Theme buttons — reflect the restored selection visually. Safe to
      // call before the DOM refs are resolved; the helper no-ops if the
      // elements are missing (e.g. drawer not yet attached).
      syncThemeButtons();

      // Keys section stays collapsed by default — the backend handles demo
      // access, so first-time users never need to open the panel.
    }
  );
}

/**
 * Resolve the current output device id safely. Before enumerateOutputDevices
 * runs, the <select> only contains "System default" so reading .value would
 * trample a user's previously-saved device. Fall back to the pending value
 * we parked on the element from chrome.storage.
 */
function currentOutputDeviceId() {
  if (devicesEnumerated) return outputDeviceSelect.value || "default";
  return outputDeviceSelect.dataset.pendingValue || "default";
}

function saveSettings() {
  chrome.storage.local.set({
    serverUrl: serverUrlInput.value.trim(),
    deepgramKey: deepgramKeyInput.value.trim(),
    anthropicKey: anthropicKeyInput.value.trim(),
    xaiKey: xaiKeyInput ? xaiKeyInput.value.trim() : "",
    braveKey: braveKeyInput.value.trim(),
    searchEngine: searchEngineSelect?.value === "xai" ? "xai" : "brave",
    passthrough: passthroughToggle.checked,
    outputDeviceId: currentOutputDeviceId(),
    responseRate: currentResponseRate(),
    packId: currentPackId,
    theme: currentTheme,
    mutedPersonas: Array.from(mutedPersonas),
  });
}

// Resolve the currently-selected response rate as a number in [1, 10].
// Defaults to 5 if the select is missing or the value is malformed, so
// nothing downstream has to defend against NaN.
function currentResponseRate() {
  const raw = Number.parseInt(responseRateSelect?.value, 10);
  if (!Number.isFinite(raw)) return 5;
  return Math.max(1, Math.min(10, raw));
}

/**
 * Populate the output device dropdown from the browser's list. Without any
 * prior microphone grant, device labels come back empty strings — still
 * usable (we fall back to "Device 1/2/…" labels) but not friendly. We only
 * call this once the user expands the Audio section, to avoid pestering
 * Chrome's permission model on every panel open.
 */
let devicesEnumerated = false;
async function enumerateOutputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const outputs = devices.filter((d) => d.kind === "audiooutput");

    // Prefer the pending value from chrome.storage (set in loadSettings) over
    // the currently-selected option — on first enumerate, the dropdown only
    // has "System default" so reading .value would lose the saved device.
    const pending = outputDeviceSelect.dataset.pendingValue;
    const prev = pending || outputDeviceSelect.value || "default";

    outputDeviceSelect.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "default";
    defaultOpt.textContent = "System default";
    outputDeviceSelect.appendChild(defaultOpt);

    outputs.forEach((d, i) => {
      if (!d.deviceId || d.deviceId === "default") return;
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Output device ${i + 1}`;
      outputDeviceSelect.appendChild(opt);
    });

    // Restore previously selected device if it still exists.
    const values = Array.from(outputDeviceSelect.options).map((o) => o.value);
    const resolved = values.includes(prev) ? prev : "default";
    const changed = outputDeviceSelect.value !== resolved;
    outputDeviceSelect.value = resolved;
    // Once restored, clear the pending marker so subsequent re-enumerations
    // (devicechange event) prefer the current value.
    delete outputDeviceSelect.dataset.pendingValue;
    devicesEnumerated = true;
    // If the previously selected device disappeared (unplugged, etc) and we
    // fell back to default, persist + notify — the `change` event does NOT
    // fire for programmatic value assignment, so we do it manually.
    if (changed && prev !== "default") {
      saveSettings();
      sendAudioSettingsToOffscreen();
    }
  } catch (err) {
    console.warn("[PG] enumerateDevices failed:", err.message);
  }
}

function sendAudioSettingsToOffscreen() {
  // Live-update the offscreen document if a session is in progress. This is
  // a best-effort fire-and-forget — if no session is running the background
  // responds with { ok: true, note: "no offscreen" } and the settings still
  // apply to the next session via START_CAPTURE.
  chrome.runtime.sendMessage({
    type: "UPDATE_AUDIO_SETTINGS",
    passthrough: passthroughToggle.checked,
    outputDeviceId: currentOutputDeviceId(),
  }).catch(() => {});
}

// ── UI State ──
function showCapturing() {
  capturing = true;
  setupSection.style.display = "none";
  emptyState.style.display = "none";
  statusBar.style.display = "grid";
  if (episodeCard) episodeCard.style.display = "flex";
  // Free-tier timer + secondary-row tag/detail only render for users who
  // haven't pasted their own keys. Paid users get the single-line primary
  // treatment (same as pre-15-min-UI behavior).
  const freeTier = !hasRequiredUserKeys();
  statusBar.classList.toggle("with-timer", freeTier);
  if (freeTier) {
    statusTag.textContent = "LISTENING";
    statusDetail.textContent = capturedTabInfo?.title || "—";
    startFreeTierTimer();
  } else {
    stopFreeTierTimer();
  }
  controlsRow.style.display = "block";
  // Must be `grid`, not `block` — the CSS lays the strip out as a 3-col
  // grid (label | waveform | ticker clip) and `display: block` would
  // stack the children vertically, kicking the transcript onto its own
  // line below the label/wave.
  transcriptSection.style.display = "grid";
  gallery.style.display = "flex";
  if (footer) footer.classList.remove("hidden");
  // Kick off the transcript ticker's continuous-scroll loop. Stays running
  // until showIdle() tears it down on session end.
  startTickerLoop();
  // Avatar clicks only do work during a live session — promote the row
  // to the interactive visual state (pointer cursor, hover transform,
  // "Make X react now" tooltip). See .personas-row.interactive rules in
  // sidepanel.html. Also sync the title attribute on each bubble so
  // it matches the actual behavior.
  personasRow.classList.add("interactive");
  syncAvatarTitles();
  // Freeze the pack selector for the life of the session. The server
  // already locked in session.resolvedPack at Start; switching the
  // dropdown mid-session would repaint the avatar row to the new pack
  // while incoming persona responses still come from the old pack —
  // names/colors/emojis would lie about which persona actually spoke.
  // Re-enabled in showIdle() when the session ends.
  if (packSelect) packSelect.disabled = true;
  // Lock the visible pack-chooser card grid too (greys out, click-refused).
  renderPackChooser();
}

function showIdle() {
  capturing = false;
  sessionId = null;
  capturedTabInfo = null;
  // Demote the avatar row — cursor goes back to default, title attributes
  // drop off so hovering an avatar doesn't promise an action that the
  // click handler will silently refuse (it early-returns on !sessionId).
  personasRow.classList.remove("interactive");
  syncAvatarTitles();
  if (packSelect) packSelect.disabled = false;
  // Unlock the visible card grid too.
  renderPackChooser();
  // Session over — trace panel should show the dropdown's pre-session
  // selection again. updateTracePackLabel() reflects both states via the
  // .locked class toggle.
  sessionPackId = null;
  updateTracePackLabel();
  setupSection.style.display = "block";
  emptyState.style.display = "flex";
  // Reset any alert companion — a fresh idle state starts back at "Wire Quiet."
  // The variant only flips back to alert via an explicit showError(...) with a
  // category argument; showIdle is the canonical "clear everything" path.
  setEmptyStateVariant("idle");
  statusBar.style.display = "none";
  statusBar.classList.remove("with-timer", "capped", "active", "live");
  if (episodeCard) {
    episodeCard.style.display = "none";
    episodeCard.classList.remove("with-progress", "capped");
  }
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "0%";
  stopFreeTierTimer();
  freeTierCapped = false;
  controlsRow.style.display = "none";
  transcriptSection.style.display = "none";
  gallery.style.display = "none";
  if (footer) footer.classList.add("hidden");
  // Tear down the ticker loop — no more incoming transcript means no
  // reason to burn rAF ticks, and stopTickerLoop() also resets the
  // translateX back to 0 for the next session's clean slate.
  stopTickerLoop();
  // Close the drawer if it was open when capture stopped — no session
  // means the settings drawer's "wire paused" framing no longer makes
  // sense. The user can reopen it anytime via the masthead ⚙ (or the
  // footer ⚙ once they've started a new session).
  closeSettingsDrawer();
  statusBar.classList.remove("active", "live");
  // Capture stopped — make sure the React button can't be stuck spinning,
  // and no avatar can be stuck on its tap-to-fire spinner.
  if (forceReactActive) resetFireButton();
  clearAllPersonaFiring();
  updateCapturedTabBanner();

  // Reset state
  transcriptFinal = "";
  transcriptInterim = "";
  feedEntries = [];
  streamBuffers = {};
  streamingPersonaId = null;
  gallery.innerHTML = "";
  // Route through updateTranscript so the ticker's translateX resets to 0
  // along with the content — leaving a stale transform would show old
  // position until the first new update.
  updateTranscript();
  updatePersonaSpeaking(null);
}

/**
 * Refresh the "Listening to: …" banner at the top of the panel. Called on
 * status=started (to populate), on chrome.tabs activation changes (to flip
 * the Jump hint on/off), and on showIdle (to clear).
 *
 * When not capturing: banner is hidden.
 * When capturing and we have tab info: banner shows the tab title + optional
 * "Jump →" hint when the user isn't currently looking at the captured tab.
 * When the captured tab was closed: banner shows a muted "(tab closed)" line.
 */
async function updateCapturedTabBanner() {
  if (!capturing || !capturedTabInfo) {
    capturedTabBanner.classList.remove("visible", "on-tab");
    return;
  }
  const displayTitle = capturedTabInfo.title || capturedTabInfo.url || "Unknown tab";
  capturedTabTitle.textContent = capturedTabInfo.stillAlive === false
    ? `${displayTitle} (tab closed)`
    : displayTitle;
  capturedTabBanner.classList.add("visible");

  // Compare against the currently active tab to decide whether to show the
  // "Jump →" hint. If the user is already looking at the captured tab, drop
  // the hint — otherwise it looks like spam.
  try {
    const activeTabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve);
    });
    const activeId = activeTabs?.[0]?.id;
    const isOnCapturedTab = activeId && activeId === capturedTabInfo.tabId;
    capturedTabBanner.classList.toggle("on-tab", !!isOnCapturedTab);
  } catch {
    capturedTabBanner.classList.remove("on-tab");
  }
  // Mirror the title into the status strip's secondary row (free-tier only;
  // no-op when .with-timer isn't set). Keeps the strip's detail line fresh
  // as the user swaps tabs or the tab title changes mid-session.
  syncStatusDetail();
  syncEpisodeCard();
}

/**
 * Keep the episode card's title + subtitle in sync with capturedTabInfo.
 * The title shows the tab title (truncated with CSS ellipsis); the subtitle
 * shows the tab domain when we can extract it, else a dash. Called from
 * updateCapturedTabBanner whenever tab info changes.
 */
function syncEpisodeCard() {
  if (!episodeCard || !episodeCardTitle) return;
  const title = capturedTabInfo?.title || "—";
  episodeCardTitle.textContent = title;
  if (episodeCardSub) {
    let sub = "—";
    const raw = capturedTabInfo?.url;
    if (raw) {
      try {
        sub = new URL(raw).hostname.replace(/^www\./, "");
      } catch {
        sub = raw;
      }
    }
    episodeCardSub.textContent = sub;
  }
}

/**
 * Pull fresh tab info from background (which re-reads chrome.tabs, so title
 * changes like a new YouTube video in the same tab are reflected). Called on
 * status=started and after a tab-activation change.
 */
function refreshCapturedTab() {
  chrome.runtime.sendMessage({ type: "GET_CAPTURED_TAB" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (!response) { capturedTabInfo = null; updateCapturedTabBanner(); return; }
    capturedTabInfo = response;
    updateCapturedTabBanner();
  });
}

// ── Empty-state companion variants (v1.6 sub-step 5) ──
//
// The idle empty state ("Wire Quiet.") is the first thing every user sees
// if they land on the panel without an active session. For the four known
// failure modes we swap in a variant that names the problem and offers a
// one-click path to resolve it. Tied to showError categories — pass the
// category hint at the call site, not inferred from error text.
const EMPTY_STATE_VARIANTS = {
  idle: {
    lg: "Wire<br>Quiet.",
    dk: "Staff is standing by. Commentary posts here as the transcript comes in.",
    cta: null,
  },
  "needs-keys": {
    lg: "Keys<br>Missing.",
    dk: "Self-hosting requires Deepgram + Anthropic + search keys. Free tiers are linked in the Settings drawer.",
    cta: { text: "Open Settings", action: "settings:backend" },
  },
  unreachable: {
    lg: "Wire<br>Down.",
    dk: "Can't reach the backend. Check your server URL and network, then Start Listening again.",
    cta: { text: "Check Settings", action: "settings:backend" },
  },
  "mic-denied": {
    lg: "Mic<br>Quiet.",
    dk: "Audio capture needs a tab grant. Click the peanut icon in the Chrome toolbar on a YouTube tab, then come back here.",
    cta: { text: "Got it — try again", action: "dismiss" },
  },
  "no-pack": {
    lg: "Pick a<br>Pack.",
    dk: "Choose a writers' room lineup from Settings → Lineup and you're live.",
    cta: { text: "Choose Pack", action: "settings:lineup" },
  },
};

function setEmptyStateVariant(variant) {
  const v = EMPTY_STATE_VARIANTS[variant] ?? EMPTY_STATE_VARIANTS.idle;
  if (!emptyStateLg || !emptyStateDk || !emptyStateCta) return;
  emptyStateLg.innerHTML = v.lg;
  emptyStateDk.textContent = v.dk;
  if (v.cta) {
    emptyStateCta.textContent = v.cta.text;
    emptyStateCta.dataset.action = v.cta.action;
    emptyStateCta.setAttribute("aria-hidden", "false");
    emptyStateCta.removeAttribute("tabindex");
  } else {
    emptyStateCta.textContent = "";
    emptyStateCta.dataset.action = "";
    emptyStateCta.setAttribute("aria-hidden", "true");
    emptyStateCta.setAttribute("tabindex", "-1");
  }
  emptyState.dataset.variant = EMPTY_STATE_VARIANTS[variant] ? variant : "idle";
}

// Single delegated handler for the empty-state CTA. Actions are short
// colon-delimited strings so new variants don't need new event listeners.
if (emptyStateCta) {
  emptyStateCta.addEventListener("click", () => {
    const action = emptyStateCta.dataset.action || "";
    switch (action) {
      case "settings:backend":
        if (typeof openSettingsDrawer === "function") openSettingsDrawer();
        if (typeof showDrawerSection === "function") showDrawerSection("backend");
        break;
      case "settings:lineup":
        if (typeof openSettingsDrawer === "function") openSettingsDrawer();
        if (typeof showDrawerSection === "function") showDrawerSection("lineup");
        break;
      case "dismiss":
        setEmptyStateVariant("idle");
        break;
    }
  });
}

/**
 * Show a transient error banner AND optionally set the empty-state companion
 * variant so the persistent "what's wrong" card picks up where the 10s banner
 * leaves off. Call sites pass `variant` when they know the failure category;
 * bare calls with no variant leave the empty state untouched (safe default).
 */
function showError(msg, variant) {
  errorText.textContent = msg;
  errorBanner.classList.add("visible");
  setTimeout(() => errorBanner.classList.remove("visible"), 10000);
  if (variant && EMPTY_STATE_VARIANTS[variant]) {
    setEmptyStateVariant(variant);
  }
}

function checkStatus() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.capturing) {
      sessionId = response.sessionId;
      showCapturing();
      statusText.textContent = "Capturing...";
      statusBar.classList.add("active");
      // Re-opening the side panel into an existing session — rehydrate the
      // "Listening to: …" banner too.
      refreshCapturedTab();
    }
  });
}

// ── Persona avatars ──
//
// Tabloid-era mug shots: initials on a halftone-hatch ground, with the
// persona's archetype glyph overlaid in a small stack underneath. Each
// bubble's role tag (FACT/DUNK/CUE/BIT) is derived from the archetype
// slot id via ROLE_FOR_SLOT so it's guaranteed to match the feed-entry
// classes downstream.
function buildPersonaAvatars() {
  personasRow.innerHTML = "";
  for (const p of PERSONAS) {
    const el = document.createElement("div");
    el.className = "persona-bubble";
    if (mutedPersonas.has(p.id)) el.classList.add("muted");
    el.id = `bubble-${p.id}`;
    el.dataset.personaId = p.id;
    el.dataset.role = roleForSlot(p.id);
    const initials = personaInitials(p.name);
    const roleTag = roleForSlot(p.id).toUpperCase();
    // If a v1.8 peanut mascot exists for this persona+pack, render it in
    // place of the block-letter initials. Everything else about the mug
    // (ring pulse, firing overlay, muted strike, data-role coloring) stays
    // identical — the mascot just takes the face slot.
    const mascot = personaMascotHTML(p.id, currentPackId);
    const faceHTML = mascot
      ? `<span class="mascot">${mascot}</span>`
      : `<span class="initials">${escapeHtml(initials)}</span>`;
    // Title is set by syncAvatarTitles() so it tracks the interactive state.
    // The glyph stack stays for the tap-to-fire crossfade — we keep its
    // `id="stack-<personaId>"` so all the firing/cleared/force-react paths
    // below keep working without change. We tuck it into a small overlay
    // corner of the mug so the initials remain the dominant identity.
    el.innerHTML = `
      <div class="persona-avatar" id="avatar-${p.id}">
        <div class="ring"></div>
        ${faceHTML}
        <span class="persona-glyph-overlay" id="stack-${p.id}">${personaGlyphHTML(p, "1.1em", null, true)}</span>
      </div>
      <span class="persona-name">${escapeHtml(p.name)}</span>
      <span class="persona-role">${escapeHtml(roleTag)}</span>
      <span class="persona-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    `;
    el.addEventListener("click", () => {
      // Muted personas get a quick un-mute hint instead of firing. Tapping
      // a muted mug in the settings drawer is the canonical way to undo,
      // but doing it here would break the "tap mug = make X react" mental
      // model — so we just silently decline.
      if (mutedPersonas.has(p.id)) return;
      firePersona(p.id);
    });
    personasRow.appendChild(el);
  }
  // Sync the title attribute with the current interactive state — a fresh
  // build picks up whatever showCapturing/showIdle last set on the row.
  syncAvatarTitles();
}

/**
 * Keep each bubble's `title` attribute honest about what a click will do.
 * During a live session the row has .interactive and bubbles promise
 * "Make X react now". When idle the attribute is removed entirely so
 * hovering doesn't tease an action the click handler would refuse.
 * Called from buildPersonaAvatars (covers initial render + pack swap) and
 * from showCapturing/showIdle (covers session state transitions).
 */
function syncAvatarTitles() {
  const isInteractive = personasRow.classList.contains("interactive");
  for (const p of PERSONAS) {
    const bubble = document.getElementById(`bubble-${p.id}`);
    if (!bubble) continue;
    if (isInteractive) {
      bubble.title = `Make ${p.name} react now`;
    } else {
      bubble.removeAttribute("title");
    }
  }
}

function updatePersonaSpeaking(activeId) {
  for (const p of PERSONAS) {
    // Toggle on the bubble — v1.4 tabloid CSS targets
    // `.persona-bubble.speaking .persona-avatar .ring` for the red-ring
    // pulse, and `.persona-bubble.speaking .persona-avatar` for the
    // stamp-red hatch backdrop swap.
    const bubble = document.getElementById(`bubble-${p.id}`);
    const avatar = document.getElementById(`avatar-${p.id}`);
    const speaking = p.id === activeId;
    if (bubble) bubble.classList.toggle("speaking", speaking);
    // Mirror on the avatar too — any legacy rules that keyed off
    // `.persona-avatar.speaking` still work without a sweep.
    if (avatar) avatar.classList.toggle("speaking", speaking);
  }
}

/**
 * Flip the persona's icon-stack into the firing state (glyph fades out,
 * spinner fades in). Clears automatically on persona_done, on clearPersonaFiring,
 * or after FORCE_REACT_TIMEOUT_MS as a safety net.
 */
function setPersonaFiring(personaId) {
  const stack = document.getElementById(`stack-${personaId}`);
  const inner = stack?.querySelector(".persona-icon-stack");
  if (inner) inner.classList.add("firing");
  firingPersonaIds[personaId] = true;
  if (firingTimeoutIds[personaId]) clearTimeout(firingTimeoutIds[personaId]);
  firingTimeoutIds[personaId] = setTimeout(
    () => clearPersonaFiring(personaId),
    FORCE_REACT_TIMEOUT_MS
  );
}

function clearPersonaFiring(personaId) {
  const stack = document.getElementById(`stack-${personaId}`);
  const inner = stack?.querySelector(".persona-icon-stack");
  if (inner) inner.classList.remove("firing");
  delete firingPersonaIds[personaId];
  if (firingTimeoutIds[personaId]) {
    clearTimeout(firingTimeoutIds[personaId]);
    delete firingTimeoutIds[personaId];
  }
}

function clearAllPersonaFiring() {
  for (const pid of Object.keys(firingPersonaIds)) clearPersonaFiring(pid);
}

// ── Gallery feed ──
//
// Tabloid wire-service rows: time · role tag · "Persona — text". Role
// (fact/dunk/cue/bit) is derived from the archetype slot via ROLE_FOR_SLOT
// so it always agrees with the corresponding mug. Muted personas drop out
// here — the gallery never receives their entries — and the streaming
// buffer for that persona is left intact server-side; we just don't paint.
function addFeedEntry(personaId, text) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) return;
  if (mutedPersonas.has(personaId)) return;

  const role = roleForSlot(personaId);
  const id = `${personaId}-${messageCount++}`;
  const now = Date.now();
  feedEntries.push({ id, personaId, role, text, timestamp: now });

  const el = document.createElement("div");
  el.className = `feed-entry ${role}`;
  el.id = `feed-${id}`;
  el.dataset.role = role;
  el.innerHTML = `
    <span class="ts">${escapeHtml(formatTime(now))}</span>
    <span class="tag">${escapeHtml(role.toUpperCase())}</span>
    <span class="msg"><span class="nm">${escapeHtml(p.name)}</span> ${escapeHtml(text)}</span>
  `;

  gallery.appendChild(el);
  gallery.scrollTop = gallery.scrollHeight;
}

function updateStreamingEntry(personaId, text) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) return;
  if (mutedPersonas.has(personaId)) return;

  const role = roleForSlot(personaId);
  let el = document.getElementById("feed-streaming");
  if (!el) {
    el = document.createElement("div");
    el.className = `feed-entry feed-streaming ${role}`;
    el.id = "feed-streaming";
    el.dataset.role = role;
    gallery.appendChild(el);
  } else {
    // Persona switched mid-stream (rare): retag the row so role styling and
    // dataset.role stay consistent with whatever's actually streaming.
    el.className = `feed-entry feed-streaming ${role}`;
    el.dataset.role = role;
  }

  el.innerHTML = `
    <span class="ts">live</span>
    <span class="tag">${escapeHtml(role.toUpperCase())}</span>
    <span class="msg"><span class="nm">${escapeHtml(p.name)}</span> ${escapeHtml(text)}</span>
  `;

  gallery.scrollTop = gallery.scrollHeight;
}

function finalizeStreamingEntry() {
  const el = document.getElementById("feed-streaming");
  if (el) el.remove();
}

// ── Message Handler (SSE events from the offscreen doc via background) ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "SSE_EVENT") return;

  const { event, data } = message;

  switch (event) {
    case "transcript":
      if (data.isFinal) {
        transcriptFinal = (transcriptFinal + " " + data.text).trim().slice(-500);
        transcriptInterim = "";
      } else {
        transcriptInterim = data.text;
      }
      updateTranscript();
      // Flip the status-bar dot from .active (yellow) to .live (red) on
      // the first transcript arrival. "Live" here means "transcription
      // is flowing" — previously we only flipped on live_detected+isLive,
      // which missed recorded videos entirely and left the dot stuck
      // yellow for the whole session.
      if (statusBar.classList.contains("active")) {
        statusBar.classList.add("live");
        statusBar.classList.remove("active");
      }
      break;

    case "persona": {
      const pid = data.personaId;
      // Muted critic — discard incoming chunks entirely. We don't even
      // accumulate into streamBuffers, so an unmute mid-burst won't dump
      // a partial reply into the feed (which would be confusing). The
      // server has no idea about mutes; the LLM still ran, that's fine.
      if (mutedPersonas.has(pid)) break;
      if (!streamBuffers[pid]) streamBuffers[pid] = "";
      streamBuffers[pid] += data.text;
      streamingPersonaId = pid;
      updatePersonaSpeaking(pid);
      updateStreamingEntry(pid, streamBuffers[pid]);
      break;
    }

    case "persona_done": {
      const pid = data.personaId;
      const finalText = streamBuffers[pid] || "";
      streamBuffers[pid] = "";
      streamingPersonaId = null;
      updatePersonaSpeaking(null);
      // Always clear the tap-to-fire spinner on this persona — even if the
      // response was empty, the round-trip is done and the spinner shouldn't
      // linger on the avatar.
      clearPersonaFiring(pid);
      finalizeStreamingEntry();
      // Muted critic — same logic as the streaming case. The buffer was
      // never populated so finalText is empty; this is just belt-and-braces
      // in case a race let chunks through.
      if (mutedPersonas.has(pid)) break;
      if (finalText.trim()) {
        addFeedEntry(pid, finalText.trim());
        // If the user is waiting on a React-button click, count non-empty
        // responses and restore the button as soon as we've got at least
        // FORCE_REACT_TARGET of them. Empty passes ("-") don't count.
        //
        // Deliberately does NOT gate on data.fromForceReact. A Director
        // cascade that happens to finish between click and burst-start
        // will flip the button back to idle slightly early — that's a
        // minor cosmetic quirk, but the queued burst still fires on the
        // next tick so the user gets all 4 reactions. Previous attempt
        // to gate this stranded the spinner on the 15s safety timeout
        // whenever a burst event didn't carry the flag for any reason.
        if (forceReactActive) {
          forceReactReceived++;
          if (forceReactReceived >= FORCE_REACT_TARGET) {
            resetFireButton();
          }
        }
      }
      break;
    }

    case "director_decision":
      // v1.2: buffer the director's decision for the debug panel. Silent by
      // default — the panel only renders after the user long-presses the
      // version badge. Push even when the panel is closed so opening it
      // shows recent history.
      pushDirectorTrace(data);
      break;

    case "error":
      showError(data.message);
      break;

    case "status":
      if (data.status === "started" && data.sessionId) {
        sessionId = data.sessionId;
        showCapturing();
        statusText.textContent = "Waiting for audio...";
        statusBar.classList.add("active");
        // Populate the "Listening to: …" banner now that we know a session
        // is live. Background remembers the captured tab across SW evictions.
        refreshCapturedTab();
      }
      if (data.status === "live_detected") {
        if (data.isLive) {
          statusBar.classList.add("live");
          statusBar.classList.remove("active");
        }
      }
      if (data.status === "detail") {
        statusText.textContent = data.message;
      }
      if (data.status === "stopped") {
        showIdle();
      }
      if (data.status === "personas_firing") {
        updatePersonaSpeaking(data.personaId);
      }
      if (data.status === "personas_complete") {
        updatePersonaSpeaking(null);
        // Backend finished a persona run. If the button is still
        // spinning, restore it now rather than waiting on the 15s
        // safety timeout. No fromForceReact gate here — see the
        // equivalent comment on persona_done.
        if (forceReactActive) resetFireButton();
      }
      break;
  }
});

function updateTranscript() {
  let html = "";
  if (transcriptFinal) html += escapeHtml(transcriptFinal) + " ";
  if (transcriptInterim) html += `<span class="interim">${escapeHtml(transcriptInterim)}</span>`;
  if (!html) html = '<span style="color:var(--paper); opacity:.5">Listening...</span>';
  transcriptTextEl.innerHTML = html;
  // No transform math here — startTickerLoop() owns the scroll position
  // via a continuous rAF loop. We just write content; the loop measures
  // the new scrollWidth on its next tick and eases toward the updated
  // target. That replaces the old per-update 250ms CSS transition, which
  // produced a staccato jump-per-interim instead of continuous motion.
}

// ── Transcript ticker loop ──
//
// Newsreel-style scroll: constant pace at the speaker's long-run rate,
// not a jump-per-interim motion.
//
// The problem with per-frame EMA was that the INPUT signal (frame-over-
// frame growth rate) is spiky — 0 px/sec for many frames, then a single
// frame where a Deepgram interim lands and growth jumps to something like
// 1000 px/sec. EMA smooths the output but still carries those spikes
// through, which reads as bursty motion.
//
// The fix: compute the speed over a rolling TIME WINDOW. We keep a ring of
// (timestamp, target) samples covering the last WINDOW_MS milliseconds;
// speed = (newestTarget - oldestTarget) / windowDuration. That's a pure
// time-averaged rate — a single-frame spike contributes 1/N of the
// smoothing, where N is the number of samples in the window. By the time
// the spike "ages out" of the window it's been averaged across ~150
// frames. No per-frame jump makes it to the scroll velocity.
//
// Each frame:
//   1. Measure target = scrollWidth - clientWidth, clamped ≥0.
//   2. Push (now, target) into tickerSamples. Prune samples older than
//      WINDOW_MS.
//   3. baseSpeed = (last.target - first.target) / windowSpanSec  — the
//      smoothed speech pace in px/sec. Clamped ≥0.
//   4. behind = target - tickerOffset. If > CATCHUP_THRESHOLD, add a
//      proportional boost to effective speed so backlog stays bounded.
//      If > DRIFT_THRESHOLD but < CATCHUP_THRESHOLD, floor at
//      MIN_DRIFT_SPEED so the ticker still closes small gaps during
//      silence instead of crawling.
//   5. Advance tickerOffset by effectiveSpeed × dt, clamped to target.
//
// Seth's spec: "smooth like the bottom of a news reel ... pace scales
// and slows down as necessary to try to keep up while seeming to always
// move at the same speed they are talking."

const WINDOW_MS = 2500;              // rolling window for speech-rate measurement
const CATCHUP_THRESHOLD = 150;       // px backlog above which we accelerate past baseSpeed
const CATCHUP_RATE = 0.3;            // fraction of excess backlog to close per second
const DRIFT_THRESHOLD = 10;          // px backlog where minimum drift speed engages
const MIN_DRIFT_SPEED = 20;          // px/sec floor so tiny gaps still close

let tickerRafId = null;
let tickerOffset = 0;
let tickerLastFrameTime = 0;
const tickerSamples = []; // [{ t: DOMHighResTimeStamp, target: px }, ...]

function startTickerLoop() {
  if (tickerRafId != null) return;
  tickerLastFrameTime = 0;
  tickerSamples.length = 0;
  const step = (now) => {
    const clip = transcriptTextEl && transcriptTextEl.parentElement;
    if (!clip) {
      tickerRafId = null;
      return;
    }
    const target = Math.max(0, transcriptTextEl.scrollWidth - clip.clientWidth);

    // Record sample + prune old ones.
    tickerSamples.push({ t: now, target });
    const cutoff = now - WINDOW_MS;
    while (tickerSamples.length > 2 && tickerSamples[0].t < cutoff) {
      tickerSamples.shift();
    }

    if (!tickerLastFrameTime) {
      // First frame — seed dt baseline, don't scroll yet.
      tickerLastFrameTime = now;
      tickerRafId = requestAnimationFrame(step);
      return;
    }
    const dt = (now - tickerLastFrameTime) / 1000;
    tickerLastFrameTime = now;

    // Window-averaged speech rate.
    let baseSpeed = 0;
    if (tickerSamples.length >= 2) {
      const first = tickerSamples[0];
      const last = tickerSamples[tickerSamples.length - 1];
      const spanSec = (last.t - first.t) / 1000;
      if (spanSec > 0) {
        baseSpeed = Math.max(0, (last.target - first.target) / spanSec);
      }
    }

    const behind = target - tickerOffset;
    let effectiveSpeed = baseSpeed;
    if (behind > CATCHUP_THRESHOLD) {
      effectiveSpeed += (behind - CATCHUP_THRESHOLD) * CATCHUP_RATE;
    } else if (behind > DRIFT_THRESHOLD && effectiveSpeed < MIN_DRIFT_SPEED) {
      effectiveSpeed = MIN_DRIFT_SPEED;
    }

    tickerOffset = Math.min(tickerOffset + effectiveSpeed * dt, target);

    transcriptTextEl.style.transform = `translateX(${-tickerOffset}px)`;
    tickerRafId = requestAnimationFrame(step);
  };
  tickerRafId = requestAnimationFrame(step);
}

function stopTickerLoop() {
  if (tickerRafId != null) {
    cancelAnimationFrame(tickerRafId);
    tickerRafId = null;
  }
  tickerOffset = 0;
  tickerLastFrameTime = 0;
  tickerSamples.length = 0;
  if (transcriptTextEl) transcriptTextEl.style.transform = "";
}

// ── Actions ──
function normalizeServerUrl(raw) {
  let url = (raw || "").trim().replace(/\/$/, "");
  if (url && !/^https?:\/\//i.test(url)) url = "http://" + url;
  return url;
}

/**
 * Ensure we have host permission to fetch from `serverUrl`. peanutgallery.live
 * is granted at install time via the manifest; anything else (localhost,
 * self-hosted domain, etc.) must be requested at runtime — CWS rejects
 * hardcoded localhost patterns, so we use `optional_host_permissions` plus
 * `chrome.permissions.request` here.
 *
 * Returns true if we have (or just got) permission; false if user declined.
 */
async function ensureHostPermission(serverUrl) {
  let origin;
  try {
    origin = new URL(serverUrl).origin + "/*";
  } catch {
    return true; // malformed URL — downstream fetch will surface the error
  }
  const already = await chrome.permissions.contains({ origins: [origin] });
  if (already) return true;
  // request() MUST be called in response to a user gesture (the Start click)
  return chrome.permissions.request({ origins: [origin] });
}

startBtn.addEventListener("click", async () => {
  saveSettings();
  // Make sure we have an install-id before we fire. Normally ensureInstallId
  // resolved long ago during panel init, but if the user was quick and storage
  // was slow, await it here so the backend always sees the X-Install-Id header.
  if (!installId) {
    try { await ensureInstallId(); } catch { /* fall through — server will 400 if needed */ }
  }
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  if (!serverUrl) { showError("Server URL is required", "unreachable"); return; }
  // Reflect the normalized URL back into the input so it's visible to the user
  serverUrlInput.value = serverUrl;

  // Pre-flight: self-hosters must supply their own keys (their server has no
  // demo env vars to fall back on). For the default peanutgallery.live backend
  // (legacy apex OR new api. subdomain — the URL transition can leave either
  // configured during the rollout window) we skip the check — the server has
  // demo keys in its env vars and will use them whenever the extension sends
  // no key headers.
  const isHostedBackend =
    /(^|\/\/)(api\.|www\.)?peanutgallery\.live(\/|$)/i.test(serverUrl);
  if (!isHostedBackend) {
    const missing = [];
    if (!deepgramKeyInput.value.trim()) missing.push("Deepgram");
    if (!anthropicKeyInput.value.trim()) missing.push("Anthropic");
    if (xaiKeyInput && !xaiKeyInput.value.trim()) missing.push("xAI");
    // Brave is only required when the user chose Brave as their search engine.
    // In xAI search mode, fact-check traffic piggybacks on the xAI key.
    const selectedEngine =
      searchEngineSelect?.value === "xai" ? "xai" : "brave";
    if (selectedEngine === "brave" && !braveKeyInput.value.trim()) {
      missing.push("Brave Search");
    }
    if (missing.length > 0) {
      // Open settings → Backend & keys so the user can fill them in
      openSettingsDrawer();
      showDrawerSection("backend");
      showError(`Self-hosting requires your own API key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Free keys are linked in Settings.`, "needs-keys");
      return;
    }
  }

  // Request host permission for the server if we don't already have it.
  // For self-hosters (localhost, custom domains) Chrome shows a permission
  // prompt. For peanutgallery.live this returns true immediately.
  const granted = await ensureHostPermission(serverUrl);
  if (!granted) {
    showError(
      "Permission to reach the server was declined. Click Start Listening again and accept the prompt.",
      "unreachable"
    );
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  try {
    // Resolve which tab to capture. Prefer the tab the user opened the panel
    // on; otherwise fall back to the active tab in this window.
    const tabInfo = await resolveCaptureTab();
    if (!tabInfo?.tabId) {
      throw new Error(
        "Couldn't find a tab to capture. Click the peanut icon in the toolbar on a YouTube tab, then try again."
      );
    }

    // Hand off to the service worker. The SW calls
    // chrome.tabCapture.getMediaStreamId() — that's where Chrome honours the
    // activeTab grant from the earlier toolbar-icon click. Side panel
    // documents don't receive activeTab the same way popups do.
    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "START_CAPTURE",
        serverUrl,
        tabId: tabInfo.tabId,
        tabTitle: tabInfo.title || "",
        youtubeUrl: tabInfo.url || "",
        installId: installId || "",
        apiKeys: {
          deepgram: deepgramKeyInput.value.trim(),
          anthropic: anthropicKeyInput.value.trim(),
          xai: xaiKeyInput ? xaiKeyInput.value.trim() : "",
          brave: braveKeyInput.value.trim(),
        },
        // Which search backend Producer fact-checks through. Forwarded to
        // /api/transcribe as the X-Search-Engine header. Missing/unknown
        // values fall back to "brave" server-side for backward-compat.
        searchEngine:
          searchEngineSelect?.value === "xai" ? "xai" : "brave",
        audio: {
          passthrough: passthroughToggle.checked,
          outputDeviceId: currentOutputDeviceId(),
        },
        // User-chosen pace dial (1-10). Forwarded through
        // background → offscreen → /api/transcribe, where it becomes the
        // session's paceMultiplier. Changing this mid-session has no
        // effect — it's captured at Start Listening time.
        rate: currentResponseRate(),
        // Persona pack id (howard | twist | ...). Forwarded through the same
        // chain and handed to resolvePack() on the server. Unknown ids fall
        // back to Howard server-side, so a new client + old server still
        // works — the UI shows the chosen names but the backend speaks
        // Howard until it's updated.
        packId: currentPackId,
      }, resolve);
    });

    if (result?.error) throw new Error(result.error);

    // Commit the pack id for this session so the trace panel shows what's
    // actually producing decisions, not whatever the dropdown drifts to.
    // Cleared in showIdle when capture stops. Done after the error check
    // so a failed start doesn't leave a stale session pack in the header.
    sessionPackId = currentPackId;
    updateTracePackLabel();

    // {ok:true} from background now means offscreen setup fully succeeded
    // (SSE live + getUserMedia got audio + AudioContext running). The
    // offscreen doc already broadcast status:"started" which flipped the
    // UI to capturing mode and set statusText to "Waiting for audio..." —
    // don't regress that by overwriting with "Connecting to server...".
    // If we beat the status broadcast (rare), just ensure the UI is in
    // capturing state.
    if (!capturing) {
      showCapturing();
      statusText.textContent = "Waiting for audio...";
      statusBar.classList.add("active");
    }
  } catch (err) {
    // If a status event already flipped the UI into capturing mode and
    // THEN setup failed (e.g. the offscreen's late cleanup on a race), pull
    // the UI back to idle so the user isn't stranded in a dead "capturing"
    // view. showIdle clears all the session state and shows the setup form.
    if (capturing) showIdle();
    // Special-case the hosted-backend free-trial exhaustion error so the
    // user lands directly on the API-keys section and knows exactly what to
    // do next, instead of getting a raw banner they have to decipher.
    // Offscreen prefixes the message with "TRIAL_EXHAUSTED:" (or
    // "INSTALL_ID_REQUIRED:" for the rare missing-header case) — strip it
    // before display.
    const rawMsg = err.message || String(err);
    if (rawMsg.startsWith("TRIAL_EXHAUSTED:") || rawMsg.startsWith("INSTALL_ID_REQUIRED:")) {
      const cleaned = rawMsg.replace(/^[A-Z_]+:/, "");
      // Flip the status strip to CAP REACHED so the free-tier user sees the
      // state even before they act on the drawer prompt.
      if (statusBar.classList.contains("with-timer")) flipToCapReached();
      openSettingsDrawer();
      showDrawerSection("backend");
      showError(cleaned, "needs-keys");
    } else {
      // Categorise the raw message one level up. Known shapes:
      //   - "Couldn't find a tab to capture" / tabCapture failures → mic-denied
      //   - fetch failures / network / CORS / 5xx / offline → unreachable
      //   - everything else → no empty-state change (generic banner only)
      const lower = rawMsg.toLowerCase();
      let cat;
      if (
        lower.includes("tab") && (lower.includes("capture") || lower.includes("toolbar")) ||
        lower.includes("getusermedia") ||
        lower.includes("notallowed") ||
        lower.includes("microphone") ||
        lower.includes("mic ")
      ) {
        cat = "mic-denied";
      } else if (
        lower.includes("fetch") ||
        lower.includes("network") ||
        lower.includes("connect") ||
        lower.includes("timeout") ||
        lower.includes("unreachable") ||
        lower.includes("server") ||
        lower.includes("502") ||
        lower.includes("503") ||
        lower.includes("504")
      ) {
        cat = "unreachable";
      }
      showError(rawMsg, cat);
    }
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start Listening";
  }
});

// Find the tab to capture: prefer what background remembered, else active tab
async function resolveCaptureTab() {
  const fromBg = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (response) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(response || null);
    });
  });
  if (fromBg?.tabId) return fromBg;

  // Fall back to active tab in current window
  return await new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      resolve(tab ? { tabId: tab.id, title: tab.title, url: tab.url } : null);
    });
  });
}

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
  showIdle();
});

fireBtn.addEventListener("click", async () => {
  if (!sessionId) return;
  if (forceReactActive) return; // debounce — already in-flight

  // Enter loading state: hide label, show spinner, disable button.
  forceReactActive = true;
  forceReactReceived = 0;
  forceReactOriginalHtml = fireBtn.innerHTML;
  fireBtn.innerHTML = `<span class="btn-spinner" aria-label="Waking the crew up"></span>`;
  fireBtn.disabled = true;
  fireBtn.classList.add("loading");
  fireBtn.setAttribute("aria-busy", "true");

  // Safety timeout — if somehow we don't hear back, restore the button so the
  // UI never sits stuck. Long enough (15s) to cover slow LLM turns.
  if (forceReactTimeoutId) clearTimeout(forceReactTimeoutId);
  forceReactTimeoutId = setTimeout(resetFireButton, FORCE_REACT_TIMEOUT_MS);

  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  try {
    await fetch(`${serverUrl}/api/transcribe`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // forceReact=true tells the backend to skip the Director and fire all 4
      // personas with a "don't pass" directive, so the user always gets visible
      // reactions for their click.
      body: JSON.stringify({ sessionId, action: "force_fire", forceReact: true }),
    });
  } catch {
    // Network error — don't leave the UI stuck.
    resetFireButton();
  }
});

function resetFireButton() {
  if (forceReactTimeoutId) {
    clearTimeout(forceReactTimeoutId);
    forceReactTimeoutId = null;
  }
  if (forceReactOriginalHtml !== null) {
    fireBtn.innerHTML = forceReactOriginalHtml;
    forceReactOriginalHtml = null;
  }
  fireBtn.disabled = false;
  fireBtn.classList.remove("loading");
  fireBtn.removeAttribute("aria-busy");
  forceReactActive = false;
  forceReactReceived = 0;
}

function firePersona(personaId) {
  if (!sessionId) return;
  if (firingPersonaIds[personaId]) return; // debounce — tap already in-flight

  // Flip the avatar glyph to a spinner immediately so the tap feels
  // instant, regardless of network latency. Cleared on persona_done or
  // the 15s safety timeout baked into setPersonaFiring.
  setPersonaFiring(personaId);

  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  fetch(`${serverUrl}/api/transcribe`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "fire_persona", personaId }),
  })
    .then((res) => {
      // 409 BURST_PENDING = server is in a force-react burst and won't honor a
      // solo tap. The burst will fire this persona anyway (it fires all 4),
      // so a persona_done is still coming — but the safer immediate response
      // is to restore the avatar glyph so the user doesn't stare at a
      // spinner they can't explain. fetch() doesn't reject on 4xx/5xx, so
      // the .catch below wouldn't see this.
      if (!res.ok) clearPersonaFiring(personaId);
    })
    .catch(() => {
      // Network error — don't leave the spinner stuck on the avatar.
      clearPersonaFiring(personaId);
    });
}

// ── Drawer submenu navigation ──
//
// Two-level: a category menu (the drawer's home view) and per-category
// section panels. Menu → section on menu-item click; section → menu on the
// section's "‹ Menu" button. Entering the Audio section lazy-enumerates
// output devices the same way the old toggleAudio collapsible did — we
// don't want to poke getUserMedia on every panel open, only when the user
// actually cares about the list.
const drawerSectionEls = document.querySelectorAll(".drawer-section");
const drawerMenuItems = document.querySelectorAll(".drawer-menu-item");
const drawerSectionBacks = document.querySelectorAll(".drawer-section-back");

function showDrawerMenu() {
  drawerSectionEls.forEach((s) => s.classList.remove("visible"));
}
function showDrawerSection(id) {
  drawerSectionEls.forEach((s) => {
    s.classList.toggle("visible", s.dataset.section === id);
  });
  if (id === "audio" && !devicesEnumerated) {
    enumerateOutputDevices();
  }
}

drawerMenuItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.section;
    if (id) showDrawerSection(id);
  });
});
drawerSectionBacks.forEach((btn) => {
  btn.addEventListener("click", showDrawerMenu);
});

// Masthead gear is a second entry point to the drawer — same handler,
// just reachable before capture has started (the footer gear is only
// visible during capture). openSettingsDrawer is declared below; function
// declarations hoist so the forward reference is safe.
const settingsToggleTopBtn = document.getElementById("settingsToggleTop");
if (settingsToggleTopBtn) {
  settingsToggleTopBtn.addEventListener("click", openSettingsDrawer);
}

// Free-tier banner deep-links into Backend & keys — when the trial nudges
// users toward BYOK, that's the section they need, not the menu.
const freeBannerSettingsLink = document.getElementById("freeBannerSettingsLink");
if (freeBannerSettingsLink) {
  freeBannerSettingsLink.addEventListener("click", () => {
    openSettingsDrawer();
    showDrawerSection("backend");
  });
}

// ── Audio settings: persist + live-update the running session ──
passthroughToggle.addEventListener("change", () => {
  saveSettings();
  sendAudioSettingsToOffscreen();
});
outputDeviceSelect.addEventListener("change", () => {
  saveSettings();
  sendAudioSettingsToOffscreen();
});

// Response rate: persist on change so it sticks across panel re-opens.
// Intentionally NOT pushed to a running session — changing cadence
// mid-conversation would be jarring and would require the server to
// re-thread the dial through the live transcriber, which isn't worth
// the complexity. The hint text in the HTML tells users "takes effect
// on your next Start Listening".
if (responseRateSelect) {
  responseRateSelect.addEventListener("change", saveSettings);
}

// Persona pack: persist on change and re-render the avatar row immediately
// so the user sees the new lineup while still in the setup screen. Like
// response-rate, the server-side pack change only takes effect on the next
// Start Listening — that matches the dial's hint text and keeps live
// sessions coherent (no mid-session persona swap).
if (packSelect) {
  packSelect.addEventListener("change", () => {
    // Belt-and-braces: showCapturing() already sets disabled=true, but a
    // rogue script, an extension update, or a programmatic .value change
    // could still fire a "change" event during a live session. Bail early
    // so the avatar row NEVER gets rebuilt to a pack the server isn't
    // running — that desyncs names/colors from the actual responder.
    if (capturing) {
      // Snap the dropdown back to the committed session pack so the UI
      // doesn't silently drift. currentPackId hasn't been mutated yet.
      packSelect.value = currentPackId;
      return;
    }
    const next = packSelect.value;
    currentPackId = next in PACKS_CLIENT ? next : DEFAULT_PACK_ID;
    saveSettings();
    // Rebuild the persona row so the names/emojis match the chosen pack.
    buildPersonaAvatars();
    // Refresh the drawer's pack-preview so the 4 mascot thumbs under the
    // dropdown snap to the new lineup immediately.
    renderPackChooser();
    // Re-render the drawer mute grid — if the drawer is open it's already
    // showing the previous pack's names, and any muted ids from the old
    // pack that don't exist in the new pack should still persist in
    // storage (the user might swap back) but just not render here.
    renderMutesList();
    // Mirror the new pre-session selection in the trace panel header so
    // power users who open the debug panel see the change reflected
    // immediately. Won't clobber the .locked state — updateTracePackLabel
    // preserves sessionPackId when one is committed.
    updateTracePackLabel();
  });
}

// When a new device shows up (plugged in/out) re-enumerate so the dropdown
// stays fresh. Only wire this if the browser supports the event.
if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    if (devicesEnumerated) enumerateOutputDevices();
  });
}

document.getElementById("errorDismiss").addEventListener("click", () => {
  errorBanner.classList.remove("visible");
});

// Click the captured-tab banner to switch to that tab. Background handles
// both chrome.tabs.update + chrome.windows.update in case the tab lives in
// a different window.
capturedTabBanner.addEventListener("click", () => {
  if (!capturedTabInfo?.tabId) return;
  chrome.runtime.sendMessage({ type: "FOCUS_CAPTURED_TAB" }, () => {
    // Ignore errors — the banner will refresh itself after the tab becomes
    // active (onActivated listener below picks it up).
  });
});

// When the user switches tabs, re-evaluate the banner so the "Jump →" hint
// hides on the captured tab and shows on other tabs. We also pull fresh info
// in case the captured tab's title changed (new video in the same tab).
if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    if (!capturing) return;
    refreshCapturedTab();
  });
}
if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (!capturing || !capturedTabInfo) return;
    if (tabId !== capturedTabInfo.tabId) return;
    // Only refresh on meaningful changes to avoid a storm.
    if (info.title || info.url || info.status === "complete") {
      refreshCapturedTab();
    }
  });
}

// ── Utils ──
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(ts) {
  // Zero-padded 24h HH:MM. Matches the tabloid/wire-service aesthetic and
  // keeps the feed's time column width predictable across locales — before
  // we were hitting "03:45 PM" overflow on en-US. Kept as a simple string
  // build (not Intl) so it never ships whitespace/separators that depend
  // on the user's locale.
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Save settings on input change. Skip any element that isn't present (older
// sidepanel.html before xai/searchEngine shipped would return null for those).
[
  serverUrlInput,
  deepgramKeyInput,
  anthropicKeyInput,
  xaiKeyInput,
  braveKeyInput,
  searchEngineSelect,
].forEach((el) => {
  if (el) el.addEventListener("change", saveSettings);
});

// ──────────────────────────────────────────────────────
// MASTHEAD + FOOTER + SETTINGS DRAWER
// ──────────────────────────────────────────────────────
//
// All the chrome outside the main content stack lives here:
//   • role filter pills in the footer
//   • settings drawer with six submenus (lineup, backend & keys, audio,
//     critics, export, appearance), reachable from the masthead ⚙ in
//     any state and the footer ⚙ during capture
//   • drawer submenu navigation + deep-link entry points
//
// Every handler no-ops if its DOM ref is missing. That keeps the extension
// robust against a stale cached HTML that doesn't know about these elements
// yet — rare in practice but Chrome's extension cache is stubborn.

// ── Footer filter pills ──
//
// Each role pill owns a single category tag. Pills carry their category
// color in both states and show a diagonal strike-through when off (see
// .pill:not(.on)::after in the stylesheet) — the "All" master toggle that
// used to live here was removed because toggling the four categories
// individually was already enough.
// Actual hide/show is done entirely in CSS via a data attribute on
// #gallery — `[data-hide-fact] .feed-entry.fact { display: none }` etc. —
// so flipping a pill is O(1) regardless of how many feed entries are
// rendered.
function applyFilterState() {
  const roles = ["fact", "dunk", "cue", "bit"];
  for (const r of roles) {
    if (activeFilters.has(r)) gallery.removeAttribute(`data-hide-${r}`);
    else gallery.setAttribute(`data-hide-${r}`, "true");
  }
  for (const pill of filterPillEls) {
    const active = activeFilters.has(pill.dataset.filter);
    pill.classList.toggle("on", active);
    // Mirror the visual state into aria-pressed so screen readers announce
    // "pressed" / "not pressed" when focus lands on the pill.
    pill.setAttribute("aria-pressed", active ? "true" : "false");
  }
}
for (const pill of filterPillEls) {
  pill.addEventListener("click", () => {
    const f = pill.dataset.filter;
    if (activeFilters.has(f)) activeFilters.delete(f);
    else activeFilters.add(f);
    applyFilterState();
  });
}
applyFilterState();

// ── Settings drawer ──
function openSettingsDrawer() {
  if (!settingsDrawer) return;
  renderMutesList();
  syncThemeButtons();
  // Always reset to the menu view when the drawer opens. Callers that want
  // to deep-link (e.g. the free-banner "Settings" link, the trial-exhausted
  // error path) can call showDrawerSection(id) immediately after.
  showDrawerMenu();
  settingsDrawer.classList.add("visible");
  settingsDrawer.setAttribute("aria-hidden", "false");
}
function closeSettingsDrawer() {
  if (!settingsDrawer) return;
  settingsDrawer.classList.remove("visible");
  settingsDrawer.setAttribute("aria-hidden", "true");
}
if (settingsToggleBtn) {
  settingsToggleBtn.addEventListener("click", openSettingsDrawer);
}
if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeSettingsDrawer);
if (drawerBackBtn) drawerBackBtn.addEventListener("click", closeSettingsDrawer);

// ── Mute-a-critic rows ──
//
// Built from the currently-active pack so names/roles always match the mug
// row above. Toggling a row flips mutedPersonas + persists + re-paints the
// mug's strike-through state. We do NOT retroactively remove feed entries
// that were already posted — that would feel like hiding history; the mute
// takes effect forward only, which also matches how the CSS strike-through
// reads ("from now on, ignore this critic").
function renderMutesList() {
  if (!mutesContainer) return;
  mutesContainer.innerHTML = "";
  for (const p of currentPersonas()) {
    const row = document.createElement("div");
    const isMuted = mutedPersonas.has(p.id);
    row.className = "mute-row" + (isMuted ? " off" : "");
    row.dataset.personaId = p.id;
    const roleTag = roleForSlot(p.id).toUpperCase();
    // Mascot if available for this persona+pack; otherwise keep the
    // block-letter initials. Mute list uses the small .av square (26px) so
    // the peanut reads as a "who am I muting" thumbnail.
    const mascot = personaMascotHTML(p.id, currentPackId);
    const avHTML = mascot
      ? `<div class="av has-mascot">${mascot}</div>`
      : `<div class="av">${escapeHtml(personaInitials(p.name))}</div>`;
    row.innerHTML = `
      ${avHTML}
      <div class="meta">
        <div class="nm">${escapeHtml(p.name)}</div>
        <div class="rl">${escapeHtml(roleTag)} · ${escapeHtml(p.role)}</div>
      </div>
      <div class="tog">${isMuted ? "MUTED" : "ON"}</div>
    `;
    row.addEventListener("click", () => toggleMute(p.id));
    mutesContainer.appendChild(row);
  }
}
// ── Pack chooser (Lineup drawer) ──
//
// Renders two pack cards side-by-side, each showing that pack's 4 peanut
// mascots + name + ACTIVE / TAP TO SWITCH label. Clicking the inactive
// card mirrors the choice into the hidden packSelect and dispatches
// 'change', so the existing change-handler cascade runs unchanged. Called
// at init, on every pack change, and when capturing flips (the card grid
// locks during a live session).
function renderPackChooser() {
  if (!packChooser) return;
  packChooser.innerHTML = "";
  packChooser.classList.toggle("locked", !!capturing);
  for (const packId of Object.keys(PACKS_CLIENT)) {
    const isActive = packId === currentPackId;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pack-card" + (isActive ? " active" : "");
    card.dataset.packId = packId;
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", isActive ? "true" : "false");
    card.setAttribute("aria-label", `${PACK_BADGE_NAMES[packId] || packId} pack`);
    const name = PACK_BADGE_NAMES[packId] || packId;
    const mugsHTML = PACKS_CLIENT[packId].map((p) => {
      const mascot = personaMascotHTML(p.id, packId);
      return mascot
        ? `<span class="pack-card-mug" title="${escapeHtml(p.name)}">${mascot}</span>`
        : `<span class="pack-card-mug" style="display:grid;place-items:center;font-family:var(--slab);font-size:11px;color:var(--ink)" title="${escapeHtml(p.name)}">${escapeHtml(personaInitials(p.name))}</span>`;
    }).join("");
    card.innerHTML = `
      <span class="pack-card-mugs">${mugsHTML}</span>
      <span class="pack-card-name">${escapeHtml(name)}</span>
      <span class="pack-card-state">${isActive ? "ACTIVE" : "TAP TO SWITCH"}</span>
    `;
    card.addEventListener("click", () => {
      // Mid-session swap is disallowed — same guard the old select used.
      if (capturing) return;
      if (packId === currentPackId) return;
      if (packSelect) {
        packSelect.value = packId;
        packSelect.dispatchEvent(new Event("change"));
      } else {
        // Fallback if the hidden select ever goes missing — do the cascade
        // directly so the card still swaps packs.
        currentPackId = packId;
        saveSettings();
        buildPersonaAvatars();
        renderPackChooser();
        renderMutesList();
        updateTracePackLabel();
      }
    });
    packChooser.appendChild(card);
  }
}

function toggleMute(personaId) {
  if (mutedPersonas.has(personaId)) mutedPersonas.delete(personaId);
  else mutedPersonas.add(personaId);
  // Persist ONLY the muted-personas field so we don't accidentally race
  // against an in-flight loadSettings and overwrite empty key inputs back
  // into storage. Same strategy used by applyTheme.
  chrome.storage.local.set({ mutedPersonas: Array.from(mutedPersonas) });
  renderMutesList();
  // Update the mug strike-through live — no full rebuild needed; we just
  // toggle .muted on the existing bubble element so the feed's streaming
  // entry for this persona can also be dropped cleanly on the next chunk.
  const bubble = document.getElementById(`bubble-${personaId}`);
  if (bubble) bubble.classList.toggle("muted", mutedPersonas.has(personaId));
  // If the muted persona was currently streaming, drop the in-flight
  // streaming entry so the last buffered text doesn't sit there orphaned.
  if (streamingPersonaId === personaId && mutedPersonas.has(personaId)) {
    finalizeStreamingEntry();
    streamingPersonaId = null;
    streamBuffers[personaId] = "";
  }
}

// ── Theme toggle ──
function applyTheme(theme) {
  const next = theme === "night" ? "night" : "paper";
  currentTheme = next;
  document.body.dataset.theme = next;
  // Persist ONLY the theme field — saveSettings() reads every input on the
  // page, so calling it here before loadSettings has populated those inputs
  // could wipe real keys with empty strings. The theme can be flipped from
  // the drawer's Paper/Night buttons the instant the panel opens, so this
  // race is reachable in practice.
  chrome.storage.local.set({ theme: next });
  syncThemeButtons();
}
function syncThemeButtons() {
  if (themePaperBtn) themePaperBtn.classList.toggle("primary", currentTheme === "paper");
  if (themeNightBtn) themeNightBtn.classList.toggle("primary", currentTheme === "night");
}
if (themePaperBtn) themePaperBtn.addEventListener("click", () => applyTheme("paper"));
if (themeNightBtn) themeNightBtn.addEventListener("click", () => applyTheme("night"));

// ── Session export (Copy + Download as Markdown) ──
//
// Builds one Markdown document from the current session state. The backend
// doesn't store transcripts, so this is literally the only way the user
// can keep a record of what happened. Included: a frontmatter-style header
// with pack + source URL + install id, the final transcript, and a
// chronological list of every critic reaction with timestamp + persona.
function buildSessionMarkdown() {
  const now = new Date();
  const src = capturedTabInfo?.url || "";
  const title = capturedTabInfo?.title || "";
  const pack = packBadgeName(sessionPackId || currentPackId);
  const lines = [];
  lines.push(`# Peanut Gallery — session`);
  lines.push("");
  lines.push(`- Exported: ${now.toISOString()}`);
  if (title) lines.push(`- Source: ${title}`);
  if (src) lines.push(`- URL: ${src}`);
  lines.push(`- Pack: ${pack}`);
  if (installId) lines.push(`- Install: ${installId}`);
  lines.push("");

  const transcript = (transcriptFinal || "").trim();
  lines.push("## Transcript");
  lines.push("");
  lines.push(transcript ? transcript : "_(no final transcript captured)_");
  lines.push("");

  lines.push("## Reactions");
  lines.push("");
  if (feedEntries.length === 0) {
    lines.push("_(no reactions yet)_");
  } else {
    for (const entry of feedEntries) {
      const p = currentPersonas().find((x) => x.id === entry.personaId);
      const name = p?.name || entry.personaId;
      const role = (entry.role || roleForSlot(entry.personaId) || "bit").toUpperCase();
      const ts = formatTime(entry.timestamp);
      // Escape any pipe chars that would mess up Markdown table renderers
      // downstream; keep the text otherwise verbatim so what the user sees
      // on-screen is what lands in the file.
      const safe = (entry.text || "").replace(/\|/g, "\\|");
      lines.push(`- \`${ts}\` **${name}** (${role}) — ${safe}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function flashExportButton(btn, label) {
  if (!btn) return;
  const original = btn.innerHTML;
  btn.innerHTML = label;
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = original;
    btn.disabled = false;
  }, 1400);
}

if (exportCopyBtn) {
  exportCopyBtn.addEventListener("click", async () => {
    const md = buildSessionMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      flashExportButton(exportCopyBtn, "✓ Copied");
    } catch {
      // Clipboard API can reject in some extension contexts — fall back to
      // a textarea + execCommand so the user still gets the export.
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        flashExportButton(exportCopyBtn, "✓ Copied");
      } catch {
        flashExportButton(exportCopyBtn, "× Failed");
      }
      document.body.removeChild(ta);
    }
  });
}

if (exportDownloadBtn) {
  exportDownloadBtn.addEventListener("click", () => {
    const md = buildSessionMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peanut-gallery-session-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // URL.revokeObjectURL is safe once the download has been dispatched.
    setTimeout(() => URL.revokeObjectURL(url), 500);
    flashExportButton(exportDownloadBtn, "✓ Downloaded");
  });
}

// Tap outside the drawer body to close — since the drawer is full-screen
// this only fires when the drawer-head or drawer-foot backgrounds are
// clicked on, but keyboard Escape is the other obvious close vector.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && tutorialOverlay?.classList.contains("visible")) {
    endTutorial(false);
    return;
  }
  if (e.key === "Escape" && settingsDrawer?.classList.contains("visible")) {
    closeSettingsDrawer();
  }
});

// ──────────────────────────────────────────────────────
// FIRST-RUN TUTORIAL
// ──────────────────────────────────────────────────────
//
// Four-step "Editor's Note" overlay that walks the user through the
// settings drawer the first time they open the side panel. Gated on a
// `tutorialSeen` flag in chrome.storage.local. Each step points at a
// real UI element via a .tut-target spotlight; advancing programmatically
// opens/navigates the drawer so the user can see exactly where the tour
// is aiming. Always Skippable; always Replayable from Appearance.
const tutorialOverlay = document.getElementById("tutorialOverlay");
const tutorialStepEl = document.getElementById("tutorialStep");
const tutorialTitleEl = document.getElementById("tutorialTitle");
const tutorialBodyEl = document.getElementById("tutorialBody");
const tutorialNextBtn = document.getElementById("tutorialNextBtn");
const tutorialSkipBtn = document.getElementById("tutorialSkipBtn");
const replayTutorialBtn = document.getElementById("replayTutorialBtn");

// Steps are declarative. `targetSelector` names the element to spotlight;
// `onEnter` performs any drawer navigation required so the target is on
// screen. Keep the list short — Seth's cap is ~4 so the tour never feels
// like onboarding bloat.
const TUTORIAL_STEPS = [
  {
    targetSelector: "#settingsToggleTop",
    title: "Welcome to the gallery",
    body: "Quick 30-second tour of your settings drawer. Six submenus, four things worth knowing.",
    onEnter: () => {
      // Don't auto-open yet — let the user see the gear being highlighted
      // first, then advance opens the drawer.
      if (settingsDrawer?.classList.contains("visible")) closeSettingsDrawer();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="lineup"]',
    title: "Lineup",
    body: "Pick your pack (Howard or TWiST) and how often the critics chime in. Cadence 1 is occasional; 10 is nonstop.",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="backend"]',
    title: "Backend & keys",
    body: "While we're in the early window, peanutgallery.live covers the providers. Paste your own keys here anytime to remove the rate limits.",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="audio"]',
    title: "Audio",
    body: "Passthrough plays captured audio back through your speakers so you hear the video normally. Turn it off only if your recording software is already routing the tab. Replay this tour anytime from Appearance.",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
];

let tutorialIndex = 0;
let tutorialActiveTarget = null;

function clearTutorialTarget() {
  if (tutorialActiveTarget) {
    tutorialActiveTarget.classList.remove("tut-target");
    tutorialActiveTarget = null;
  }
}

function renderTutorialStep(i) {
  const step = TUTORIAL_STEPS[i];
  if (!step) return;
  clearTutorialTarget();
  if (typeof step.onEnter === "function") step.onEnter();
  tutorialStepEl.textContent = `Step ${i + 1} · ${TUTORIAL_STEPS.length}`;
  tutorialTitleEl.textContent = step.title;
  tutorialBodyEl.textContent = step.body;
  tutorialNextBtn.textContent = i === TUTORIAL_STEPS.length - 1 ? "Done" : "Next ›";
  // Defer target highlight one frame so any drawer navigation has painted
  // and the element exists in the flow (menu tiles get display:none'd when
  // a section is open; onEnter flips the drawer back to menu view first).
  requestAnimationFrame(() => {
    const target = document.querySelector(step.targetSelector);
    if (target) {
      target.classList.add("tut-target");
      tutorialActiveTarget = target;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}

function startTutorial() {
  if (!tutorialOverlay) return;
  tutorialIndex = 0;
  tutorialOverlay.classList.add("visible");
  tutorialOverlay.setAttribute("aria-hidden", "false");
  renderTutorialStep(0);
}

function advanceTutorial() {
  if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
    endTutorial(true);
    return;
  }
  tutorialIndex += 1;
  renderTutorialStep(tutorialIndex);
}

function endTutorial(completed) {
  clearTutorialTarget();
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.remove("visible");
  tutorialOverlay.setAttribute("aria-hidden", "true");
  // Persist only the flag so we don't race with loadSettings on the key
  // inputs. Same single-field-write pattern used by applyTheme + toggleMute.
  chrome.storage.local.set({ tutorialSeen: true });
  // If the tour opened the drawer, leave it open on the menu view — the
  // user just got pointed at four tiles, closing the drawer on them would
  // feel like the tour throwing the settings away.
  if (completed && settingsDrawer?.classList.contains("visible")) {
    showDrawerMenu();
  }
}

if (tutorialNextBtn) tutorialNextBtn.addEventListener("click", advanceTutorial);
if (tutorialSkipBtn) tutorialSkipBtn.addEventListener("click", () => endTutorial(false));

// Replay entry point — resets the seen flag is not necessary since we just
// trigger startTutorial directly. Clicking Replay also closes the drawer
// first so step 1's spotlight on the masthead gear is actually visible.
if (replayTutorialBtn) {
  replayTutorialBtn.addEventListener("click", () => {
    closeSettingsDrawer();
    // One frame so the drawer's display:none has committed before the
    // tutorial's target-scroll math runs on the masthead gear.
    requestAnimationFrame(startTutorial);
  });
}

// First-run hook. Read the flag independently of loadSettings so we don't
// couple tour timing to the key-input hydration path. Delay a tick so the
// empty-state paint has landed — a tour that appears mid-paint feels janky.
function maybeStartTutorial() {
  chrome.storage.local.get(["tutorialSeen"], (data) => {
    if (data?.tutorialSeen) return;
    setTimeout(startTutorial, 600);
  });
}
maybeStartTutorial();

// ──────────────────────────────────────────────────────
// DIRECTOR TRACE (v1.2 debug panel)
// ──────────────────────────────────────────────────────
//
// A developer-grade window into the Director's decisions. Hidden behind a
// long-press on the version badge so normal users never see it, but when
// tuning cascade timing or investigating a "why did that persona fire?"
// regression, it's the single most useful thing in the extension.
//
// Design notes:
//   - Ring buffer is in-memory only; closing the side panel resets it. The
//     only bit we persist is whether the panel was open, so reopening the
//     panel after reload doesn't lose the user's setup.
//   - Events are pushed whether or not the panel is visible, so opening it
//     mid-session shows the last 20 decisions in context.
//   - Forward-compat: if we're talking to an older backend that doesn't send
//     top3/cooldownsMs, the row still renders with whatever fields exist.
//   - No framework dependency. Raw DOM + a render function that rebuilds on
//     each push. N ≤ 20, cost is trivial.
const TRACE_MAX = 20;
const LONG_PRESS_MS = 750;
let directorTrace = [];          // ring buffer: newest at index 0
let debugPanelOpen = false;
let longPressTimer = null;

const traceSection = document.getElementById("directorTrace");
const traceListEl = document.getElementById("traceList");
const traceClearBtn = document.getElementById("traceClear");
const tracePackLabelEl = document.getElementById("tracePackLabel");
const versionBadgeEl = document.getElementById("versionBadge");

// Refresh the pack label in the trace header. When a session is live,
// shows the locked session pack (tinted accent); otherwise shows the
// dropdown's pre-session selection (muted). Called on session lifecycle
// transitions and whenever the pack dropdown changes.
function updateTracePackLabel() {
  if (!tracePackLabelEl) return;
  const committed = typeof sessionPackId === "string" && sessionPackId.length > 0;
  const id = committed ? sessionPackId : currentPackId;
  tracePackLabelEl.textContent = `pack: ${packDisplayName(id)}`;
  tracePackLabelEl.classList.toggle("locked", committed);
  tracePackLabelEl.setAttribute(
    "title",
    committed
      ? `Session locked to pack: ${packDisplayName(id)}`
      : `Pre-session selection: ${packDisplayName(id)} (applies on next Start Listening)`
  );
}

// Map persona ids to their brand colors for the trace left-border tint.
// Read lazily so pack switches pick up new colors immediately. Every pack in
// v1.3 uses identical archetype-slot colors, but a future pack could change
// them — the getter keeps this safe.
function colorForPersonaId(id) {
  const p = currentPersonas().find((x) => x.id === id);
  return p?.color || "rgba(255,255,255,0.1)";
}

function pushDirectorTrace(payload) {
  // Newest-first ring buffer. Trim from the tail to maintain TRACE_MAX.
  directorTrace.unshift(payload);
  if (directorTrace.length > TRACE_MAX) {
    directorTrace.length = TRACE_MAX;
  }
  // Only pay render cost if the panel is visible. Buffer always updates.
  if (debugPanelOpen) renderDirectorTrace();
}

function renderDirectorTrace() {
  if (!traceListEl) return;

  if (directorTrace.length === 0) {
    traceListEl.innerHTML =
      '<div class="trace-empty">Waiting for director decisions…</div>';
    return;
  }

  // Build a fragment off-DOM, swap in atomically. Keeps scroll jank low even
  // though N is tiny — the habit matters more than the savings here.
  const frag = document.createDocumentFragment();

  for (const d of directorTrace) {
    const row = document.createElement("div");
    row.className = "trace-row";

    const pick = d?.pick ?? "?";
    const score = typeof d?.score === "number" ? d.score.toFixed(1) : "—";
    const cascadeLen =
      typeof d?.cascadeLen === "number"
        ? d.cascadeLen
        : Array.isArray(d?.chain)
        ? d.chain.length
        : 1;
    const color = colorForPersonaId(pick);
    row.style.borderLeftColor = color;

    // Top-3 short form, e.g. "troll:4.3 · producer:2.1 · joker:1.0". Falls
    // back to empty string when the backend omits top3 (forward-compat with
    // older backends). Always drop the pick (index 0) since it's already
    // displayed above.
    let top3Str = "";
    if (Array.isArray(d?.top3) && d.top3.length > 1) {
      top3Str = d.top3
        .slice(1)
        .map((t) => `${t.id}:${(t.score ?? 0).toFixed(1)}`)
        .join(" · ");
    }

    // v1.5: routing-source badge. Backend sends source="rule"|"llm" on every
    // director_decision; older backends omit the field so we default to "rule"
    // — that matches the effective behavior when ENABLE_SMART_DIRECTOR is off.
    // Normalize unknown values back to "rule" so a malformed payload never
    // colors the badge as a false-positive LLM win.
    const rawSource = typeof d?.source === "string" ? d.source : "rule";
    const source = rawSource === "llm" ? "llm" : "rule";
    const sourceClass = source === "llm" ? "src-llm" : "src-rule";
    const sourceLabel = source === "llm" ? "LLM" : "RULE";

    // Line 1: pick · score · top3 · cascadeLen · source
    const line1 = document.createElement("div");
    line1.className = "trace-line1";
    line1.innerHTML =
      `<span class="trace-pick" style="color:${color}">${escapeHtml(pick)}</span>` +
      ` <span class="trace-score">${escapeHtml(String(score))}</span>` +
      (top3Str ? ` <span class="trace-top3">(${escapeHtml(top3Str)})</span>` : "") +
      ` <span class="trace-cascade">×${cascadeLen}${d?.isSilence ? " · silence" : ""}${d?.isForceReact ? " · force" : ""}</span>` +
      ` <span class="trace-source ${sourceClass}">${sourceLabel}</span>`;
    row.appendChild(line1);

    // Line 2: chain, e.g. "troll → joker → producer"
    if (Array.isArray(d?.chain) && d.chain.length > 0) {
      const line2 = document.createElement("div");
      line2.className = "trace-line2";
      line2.textContent = d.chain.join(" → ");
      row.appendChild(line2);
    }

    // Line 3: reason (always present from backend).
    if (d?.reason) {
      const line3 = document.createElement("div");
      line3.className = "trace-line3";
      line3.textContent = d.reason;
      row.appendChild(line3);
    }

    frag.appendChild(row);
  }

  traceListEl.innerHTML = "";
  traceListEl.appendChild(frag);
}

function setDebugPanelOpen(open, persist = true) {
  debugPanelOpen = !!open;
  if (!traceSection) return;
  traceSection.classList.toggle("hidden", !debugPanelOpen);
  traceSection.setAttribute("aria-hidden", debugPanelOpen ? "false" : "true");
  if (debugPanelOpen) renderDirectorTrace();
  if (persist && chrome.storage?.local) {
    try {
      chrome.storage.local.set({ debugPanelOpen });
    } catch {
      // chrome.storage may be unavailable on unpacked dev loads — ignore.
    }
  }
}

function toggleDebugPanel() {
  setDebugPanelOpen(!debugPanelOpen);
}

// Long-press detection. pointerdown starts the timer; pointerup/pointerleave
// cancel it. 750ms is short enough to feel intentional, long enough to avoid
// accidental toggling from click-through interactions.
function startLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    toggleDebugPanel();
  }, LONG_PRESS_MS);
}
function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

if (versionBadgeEl) {
  versionBadgeEl.addEventListener("pointerdown", (e) => {
    // Only react to primary button to avoid right-click weirdness.
    if (e.button !== undefined && e.button !== 0) return;
    startLongPress();
  });
  versionBadgeEl.addEventListener("pointerup", cancelLongPress);
  versionBadgeEl.addEventListener("pointerleave", cancelLongPress);
  versionBadgeEl.addEventListener("pointercancel", cancelLongPress);
  // Preempt the context menu on long press-and-hold — some platforms interpret
  // it as a right-click gesture after a delay.
  versionBadgeEl.addEventListener("contextmenu", (e) => e.preventDefault());
}

if (traceClearBtn) {
  traceClearBtn.addEventListener("click", () => {
    directorTrace = [];
    renderDirectorTrace();
  });
}

// Restore the panel's open/closed state from storage. Default = closed.
if (chrome.storage?.local) {
  try {
    chrome.storage.local.get(["debugPanelOpen"], (res) => {
      if (chrome.runtime.lastError) return;
      setDebugPanelOpen(!!res?.debugPanelOpen, /*persist=*/ false);
    });
  } catch {
    // Storage unavailable — leave panel closed (the default).
  }
}
