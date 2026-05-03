/**
 * Peanut Gallery — Side Panel
 *
 * The main UI. Shows transcript + persona reactions in a sidebar
 * next to the YouTube video. Receives events from the offscreen
 * document via chrome.runtime.onMessage.
 */

// ─── LOAD-TIME ERROR HYGIENE ─────────────────────────────────────────────
// Minimal surfacing of uncaught errors + promise rejections. Kept after
// the 2026-04-21 diagnostic pass because it's zero-cost when nothing
// throws and makes the next silent-TDZ-style failure trivially
// observable in the console. No on-panel UI — strip that shipped in
// PRs #108–#111 was removed once the root cause was fixed (#112).
window.addEventListener("error", (event) => {
  console.error(
    "[PG:sp fatal]",
    event.message,
    "at",
    event.filename + ":" + event.lineno + ":" + event.colno,
    event.error?.stack?.split("\n").slice(0, 3).join("\n"),
  );
});
window.addEventListener("unhandledrejection", (event) => {
  console.error(
    "[PG:sp fatal rejection]",
    event.reason?.message || String(event.reason),
    event.reason?.stack?.split("\n").slice(0, 3).join("\n"),
  );
});

// ── Persona pack definitions (must match lib/packs/* on the server) ──
//
// The extension is intentionally un-bundled, so pack metadata is duplicated
// here as a plain object. Archetype slot IDs (producer/troll/soundfx/joker)
// are LOAD-BEARING — they match the server's Director output and every DOM
// lookup below keys off them. NAMES, emojis, and colors change per pack.
//
// Adding a new pack: add an entry to PACKS_CLIENT (same 4 slot ids, any
// names/emojis/colors), then add a matching <option> to sidepanel.html's
// packSelect. The server resolves unknown pack ids to "morning-crew" via
// resolvePack(), so an older server won't reject a newer client's choice —
// the UI will simply show different names than the personas that speak.
//
// The legacy "howard" id (pre-2026-05-02 rename) is aliased to "morning-crew"
// so persisted user storage continues to resolve cleanly. New code should
// use "morning-crew".
const PACKS_CLIENT = {
  "morning-crew": [
    { id: "producer", name: "The Producer", role: "Fact-Checker", emoji: "🎯", color: "#3b82f6" },
    { id: "troll", name: "The Heckler", role: "Cynical Commentator", emoji: "🔥", color: "#ef4444" },
    { id: "soundfx", name: "The Sound Guy", role: "Sound Effects", emoji: "🎧", color: "#a855f7" },
    { id: "joker", name: "The Joke Writer", role: "Comedy Writer", emoji: "😂", color: "#f59e0b" },
  ],
  twist: [
    { id: "producer", name: "Molly", role: "Fact-Checker", emoji: "📓", color: "#3b82f6" },
    { id: "troll", name: "Jason", role: "Provocateur", emoji: "🎙️", color: "#ef4444" },
    { id: "soundfx", name: "Lon", role: "The Reframe", emoji: "🎬", color: "#a855f7" },
    { id: "joker", name: "Alex", role: "Data Comedian", emoji: "📊", color: "#f59e0b" },
  ],
};
// Legacy alias — pre-2026-05-02 client storage stored "howard"; resolve to
// the renamed pack so old chrome.storage values keep matching the dropdown.
PACKS_CLIENT.howard = PACKS_CLIENT["morning-crew"];
const DEFAULT_PACK_ID = "morning-crew";

// Short display names for the trace panel's pack label. Kept separate from
// PACKS_CLIENT (which is only personas) so the sidebar header doesn't have
// to inline a longer name like "This Week in Startups". Falls back to the
// pack id for anything not listed.
const PACK_DISPLAY_NAMES = {
  "morning-crew": "morning crew",
  howard: "morning crew", // legacy alias
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

// Canonical body shapes. The peanut is the default; egg and potato are used
// by the TWiST Lon / Alex mascots so their bobbling body reads as the running
// gag from the show (see lib/packs/twist/personas.ts). Coordinates assume the
// 64×64 viewBox and the scale(1.10) wrapper in buildPeanutSVG.
const BODY_PATHS = {
  peanut:
    "M32 4C22 4 18 10 18 19c0 5 3 8 6 10-4 2-10 6-10 16 0 9 8 15 18 15s18-6 18-15c0-10-6-14-10-16 3-2 6-5 6-10 0-9-4-15-14-15Z",
  // Classic egg proportions (~2:3 width-to-height): broad round base, softly
  // tapered crown. Earlier draft was too tall/skinny and read as almond.
  egg:
    "M32 8C21 8 15 20 15 33c0 14 7 23 17 23s17-9 17-23C49 20 43 8 32 8Z",
  // Lumpy, imperfect spud. Deliberate asymmetry: left shoulder juts at ~y=17,
  // right flank swells at ~y=33, base pinches left then bulges right. A
  // perfectly-round oval read as a dinner roll, so this one leans into the
  // dents.
  potato:
    "M30 7C23 7 19 10 18 15 13 17 13 24 17 26 12 30 13 38 17 40 13 45 16 54 24 55 32 58 41 57 46 52 52 50 51 42 47 39 53 36 51 28 47 26 52 22 48 15 43 14 41 8 36 7 33 6 31 6 30 7Z",
};

function buildPeanutSVG({
  ns,
  extraDefs = "",
  face = "smile",
  prop = "",
  bodyStops = null,
  bodyStroke = "#8B5E2F",
  bodyShape = "peanut",
  eyesLight = false,
  showShellGrooves = true,
}) {
  // The peanut body sits in a 64×64 viewBox with natural padding around it,
  // which reads as a floating blob at 42px. Wrapping everything in a scale
  // transform around the viewBox center fills more of the mug without
  // touching every path coordinate. 1.10 lands the body at ~76% of the
  // circle diameter — prominent but with enough clearance that the round
  // bottom curve stays inside the circle clip at the bottom of the bob
  // cycle. (1.22 before — put the peanut's round bottom ~2vb below the
  // viewBox and Seth saw it as "flat / cut off" when the bubble bobbed.)
  //
  // bodyStops/bodyStroke let one-off personas (Troll = boiled) swap the
  // shell color without forking the whole body path.
  // eyesLight switches to a big-white-sclera pop-eye style; used on dark
  // bodies where the default dark pupils would disappear.
  // 6-stop gradient: bright highlight → warm mid → dark shoulder →
  // warm rim (fake subsurface scatter at 93%) → cool bounce (ambient
  // sky reflected from below at 100%). Extra stops make the depth pass
  // read as genuine curvature rather than flat colour.
  const stops = bodyStops || `
    <stop offset="0%"   stop-color="#FFF4D6"/>
    <stop offset="28%"  stop-color="#F5CB78"/>
    <stop offset="56%"  stop-color="#DFAE70"/>
    <stop offset="80%"  stop-color="#C0874A"/>
    <stop offset="93%"  stop-color="#CA9460"/>
    <stop offset="100%" stop-color="#7898B8"/>`;
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
  // peanutDepth filter: Phong lighting (feDiffuseLighting + feSpecularLighting)
  // composited over the shell using SourceAlpha as the bump map, plus an AO
  // inner-shadow chain (feMorphology erode → feGaussianBlur → feComposite) that
  // darkens the body's interior edges. Applied only to the body path so props
  // and face features sit on top unfiltered.
  //
  // The feSpecularLighting feDistantLight carries a SMIL <animate> on azimuth
  // (begin="indefinite") so updatePersonaSpeaking() can call beginElement() /
  // endElement() to slide the highlight while the mascot talks.
  //
  // Filter is namespaced per-mascot (peanutDepth-${ns}) so multiple mascots in
  // the row never share a filter node that one SVG shadow-root might own.
  const depthFilter = `
      <filter id="peanutDepth-${ns}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" result="bump"/>
        <feSpecularLighting in="bump" surfaceScale="7" specularConstant="0.9" specularExponent="24" result="specRaw" lighting-color="#FFFAF0">
          <feDistantLight azimuth="135" elevation="48">
            <!-- values="120;150;120" = oscillates back and forth; from/to only
                 plays once per beginElement() and leaves the highlight stuck
                 at 150° after the first pass. updatePersonaSpeaking calls
                 beginElement() on .speaking and endElement() when silent. -->
            <animate attributeName="azimuth" values="120;150;120" dur="3.5s" repeatCount="indefinite" begin="indefinite"/>
          </feDistantLight>
        </feSpecularLighting>
        <feComposite in="specRaw" in2="SourceAlpha" operator="in" result="spec"/>
        <feDiffuseLighting in="bump" surfaceScale="7" diffuseConstant="0.4" result="diffRaw" lighting-color="#FFE4A8">
          <feDistantLight azimuth="135" elevation="48"/>
        </feDiffuseLighting>
        <feComposite in="diffRaw" in2="SourceAlpha" operator="in" result="diffMasked"/>
        <feComponentTransfer in="diffMasked" result="diff">
          <feFuncR type="linear" slope="0.5" intercept="0.5"/>
          <feFuncG type="linear" slope="0.5" intercept="0.5"/>
          <feFuncB type="linear" slope="0.5" intercept="0.5"/>
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="spec" mode="screen" result="withSpec"/>
        <feBlend in="withSpec" in2="diff" mode="multiply" result="lit"/>
        <feMorphology in="SourceAlpha" operator="erode" radius="3" result="eroded"/>
        <feGaussianBlur in="eroded" stdDeviation="3" result="aoBlur"/>
        <feComposite in="SourceAlpha" in2="aoBlur" operator="out" result="aoMask"/>
        <feFlood flood-color="#6B2F00" flood-opacity="0.25" result="aoFill"/>
        <feComposite in="aoFill" in2="aoMask" operator="in" result="ao"/>
        <feMerge><feMergeNode in="lit"/><feMergeNode in="ao"/></feMerge>
      </filter>`;
  return `<svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mbody-${ns}" cx="38%" cy="30%" r="72%">${stops}</radialGradient>${depthFilter}${extraDefs}
    </defs>
    <g transform="translate(32 32) scale(1.10) translate(-32 -32)">
      <!-- Ground-shadow removed as of the v1.7 depth pass: a static horizontal
           shadow anchored to the peanut looked glued-to-it (moves in lockstep
           with the CSS bob), and with the full round bottom now visible the
           mascot reads as a floating bobblehead without help. Re-add as a
           separate un-transformed <ellipse> only if the "floating" reads wrong. -->
      <path d="${BODY_PATHS[bodyShape] || BODY_PATHS.peanut}" fill="url(#mbody-${ns})" stroke="${bodyStroke}" stroke-width="1.4" stroke-linejoin="round" filter="url(#peanutDepth-${ns})"/>
      ${showShellGrooves ? `<path d="M21 14c3 1 6 1 8 0M35 14c3 1 5 1 8 0" fill="none" stroke="${bodyStroke}" stroke-width=".8" stroke-linecap="round" opacity=".5"/>` : ""}
      <ellipse cx="25" cy="11" rx="5.5" ry="3" fill="#FFF5DF" opacity=".55"/>
      ${eyes}
      ${PEANUT_MOUTHS[face] || PEANUT_MOUTHS.smile}
      ${prop}
    </g>
  </svg>`;
}

function personaMascotHTML(personaId, packId) {
  // Normalize legacy "howard" → "morning-crew" so old chrome.storage values
  // hit the same mascot branch as the renamed pack.
  const rawPack = packId || "morning-crew";
  const pack = rawPack === "howard" ? "morning-crew" : rawPack;
  const ns = `${pack}-${personaId}`;

  // ── Morning Crew pack ──
  if (pack === "morning-crew" && personaId === "producer") {
    // The Producer — wooden clipboard with a big blue checkmark.
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
  if (pack === "morning-crew" && personaId === "troll") {
    // The Heckler — BOILED peanut. Dark wet shell, smirk, beads of moisture
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
  if (pack === "morning-crew" && personaId === "soundfx") {
    // The Sound Guy — big purple DJ headphones wrapped over the top lobe.
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
  if (pack === "morning-crew" && personaId === "joker") {
    // The Joke Writer — vintage stand mic with amber-trimmed head. Toothy grin.
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
        <!-- Molly's hair: long honey-blonde with a middle part, cascading past
             the shoulders on both sides. Back layer (darker honey) falls
             behind, front crown frames the face without covering eyes/mouth.
             Tapered just above the notebook so the prop still reads. -->
        <path d="M17 13Q14 22 15 34Q17 40 20 36Q19 24 19 13Z" fill="#B88746" stroke="#7A4A1C" stroke-width=".4" stroke-linejoin="round"/>
        <path d="M47 13Q50 22 49 34Q47 40 44 36Q45 24 45 13Z" fill="#B88746" stroke="#7A4A1C" stroke-width=".4" stroke-linejoin="round"/>
        <path d="M18 14Q20 6 28 5Q32 4 36 5Q44 6 46 14Q43 11 38 10.5Q34 10 32 12Q30 10 26 10.5Q21 11 18 14Z" fill="#D9A860" stroke="#7A4A1C" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M32 5.5L32 11.5" stroke="#8B5A22" stroke-width=".35" opacity=".55"/>
        <path d="M22 9Q20 22 19 34" stroke="#F2CF8A" stroke-width=".5" fill="none" opacity=".8"/>
        <path d="M42 9Q44 22 45 34" stroke="#F2CF8A" stroke-width=".5" fill="none" opacity=".8"/>
        <path d="M19 15Q21 13 25 12" stroke="#F2CF8A" stroke-width=".4" fill="none" opacity=".7"/>
        <path d="M45 15Q43 13 39 12" stroke="#F2CF8A" stroke-width=".4" fill="none" opacity=".7"/>
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
        <!-- Jason's hair: short strawberry-blonde with a crisp side part on
             viewer's left, swept flat across to the right. Painted over the
             shell highlight so it reads as a real hairline. Two sheen strokes
             trace the sweep direction. -->
        <path d="M18 15Q17 8 25 7Q32 5.5 39 7Q46 8 47 15Q44 11 39 10.5Q34 10 31 11.5Q27 10.5 24 11Q20 12 18 15Z" fill="#C88A4A" stroke="#7A4A1C" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M25 7.5Q26 10 29 12" stroke="#7A4A1C" stroke-width=".5" fill="none" opacity=".75"/>
        <path d="M29 9Q35 8.3 43 10" stroke="#EAB884" stroke-width=".7" fill="none" opacity=".85"/>
        <path d="M30 11Q36 10.5 44 12" stroke="#D9A366" stroke-width=".45" fill="none" opacity=".7"/>
        <path d="M22 44q-3 4 2 8M42 44q4 4 -2 8" fill="none" stroke="#8B5E2F" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M22 40L50 32L52 54L26 54Z" fill="url(#mmega-${ns})" stroke="#7A0000" stroke-width="1.2" stroke-linejoin="round"/>
        <ellipse cx="51" cy="43" rx="2.2" ry="10" fill="#7A0000" opacity=".85"/>
        <path d="M24 41L25 48" stroke="#FFF" stroke-width="1.2" opacity=".4" stroke-linecap="round"/>
        <path d="M55 30q4 1 5 4M56 42q4 0 6 -1M55 55q4 1 5 4" fill="none" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>`,
    });
  }
  if (pack === "twist" && personaId === "soundfx") {
    // Lon 🥚 — egg body (running gag from the show). Clapperboard prop
    // survives. Cream-on-white gradient with a cool bounce at the base;
    // no shell grooves (eggs are smooth).
    return buildPeanutSVG({
      ns, face: "flat",
      bodyShape: "egg",
      bodyStroke: "#D8C89A",
      showShellGrooves: false,
      // Chicken-white shell: pure white across most of the body so it reads
      // unambiguously "egg" on the dark tabloid backdrop. Keep a faint warm
      // tint at ~85% and a cool bounce at the base so the depth filter still
      // has something to work with — otherwise it flattens to a paper oval.
      bodyStops: `
        <stop offset="0%"   stop-color="#FFFFFF"/>
        <stop offset="92%"  stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#F2EEE2"/>`,
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
    // Alex 🥔 — potato body (running gag from the show). Pie-chart prop
    // survives. Earthy russet gradient + scattered skin "eyes"
    // (the potato kind, not the face kind) as prop overlay for texture.
    return buildPeanutSVG({
      ns, face: "smirk",
      bodyShape: "potato",
      bodyStroke: "#8A6638",
      showShellGrooves: false,
      // Potato, not poo. Key artistic differences: potatoes are tan/khaki
      // (warm yellow-brown), NOT chocolate brown; matte, not swirly; and
      // carry dark "eyes" (sprout dimples) which poo does not. Earlier draft
      // pushed to near-black at 100% which dragged it into poo territory —
      // this range stays in russet-tan for every stop so the body reads as
      // skin-on spud at a glance. The dark freckles in the prop layer do
      // the rest of the potato-signaling.
      bodyStops: `
        <stop offset="0%"   stop-color="#FBE8BE"/>
        <stop offset="35%"  stop-color="#E8C487"/>
        <stop offset="70%"  stop-color="#C89A5E"/>
        <stop offset="93%"  stop-color="#A8824A"/>
        <stop offset="100%" stop-color="#8A6638"/>`,
      prop: `
        <!-- Green sprout out the top: the single most unambiguous "this is
             a potato" signal — poo never grows leaves. Tiny stem + two
             teardrop leaves on viewer's left of the crown so the face isn't
             obscured. -->
        <!-- Sprout sized to sit fully inside the circular avatar clip: the
             earlier version extended to y=1 and got sliced off by the mask.
             All anchors stay at y≥3.5 so the leaves emerge cleanly. -->
        <path d="M24 11Q21 8 20 5" stroke="#3F7A2E" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M20 5Q13 4 13.5 8.5Q18 9.5 20 5Z" fill="#5AA840" stroke="#2E5F22" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M20 5Q26 3.5 27 7Q22.5 8 20 5Z" fill="#7ACB52" stroke="#2E5F22" stroke-width=".5" stroke-linejoin="round"/>
        <path d="M15 7.5Q17 7 19 6" stroke="#2E5F22" stroke-width=".35" fill="none" opacity=".6"/>
        <!-- Potato eyes (sprout dimples): darker pit + highlight ring to read
             as indented, not painted-on dots. Cartoon potato shorthand. -->
        <ellipse cx="22" cy="24" rx="1.4" ry="1.6" fill="#F3D39A" opacity=".7"/>
        <ellipse cx="22" cy="24" rx=".9" ry="1.1" fill="#3E2A14" opacity=".85"/>
        <ellipse cx="44" cy="17" rx="1.2" ry="1.4" fill="#F3D39A" opacity=".6"/>
        <ellipse cx="44" cy="17" rx=".7" ry="1.0" fill="#3E2A14" opacity=".8"/>
        <ellipse cx="48" cy="30" rx="1.6" ry="1.8" fill="#F3D39A" opacity=".65"/>
        <ellipse cx="48" cy="30" rx="1.1" ry="1.3" fill="#3E2A14" opacity=".8"/>
        <ellipse cx="17" cy="36" rx="1.3" ry="1.5" fill="#F3D39A" opacity=".65"/>
        <ellipse cx="17" cy="36" rx=".8" ry="1.0" fill="#3E2A14" opacity=".85"/>
        <!-- Stem knob + leaf cue (pie chart) -->
        <path d="M19 39q-2 3 1 7M45 39q2 3 -1 7" fill="none" stroke="#5A3A18" stroke-width="2.6" stroke-linecap="round"/>
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
let feedEntries = []; // { id, personaId, role, text, timestamp, transcript }
let streamBuffers = {}; // personaId → accumulated streaming text
let streamingPersonaId = null;
let messageCount = 0;

// v1.7 feed-entry interactions (upvote/downvote/pin/quote-card).
//
// Votes + pin live in memory for the active session and persist via
// chrome.storage.local under session-scoped keys so a reload of the side
// panel keeps them. Per-session keys (not a global log) because the
// smart-highlight picker works on a single session at a time.
//
// Transcript-per-persona captures the tail of the transcript window at
// the moment the Director decided to fire this persona — used by the
// quote-card renderer so the "quote" half of the card matches what the
// model actually saw. Populated from the director_decision SSE event.
const feedVotes = new Map(); // entryId → "up" | "down"
let pinnedEntry = null; // { id, personaId, role, name, text, transcript, timestamp } | null
const lastTranscriptForPersona = new Map(); // personaId → string (recent tail)
let currentMenuTargetId = null; // entryId currently anchored by the popover menu
let sensitivityValue = "normal"; // "quiet" | "normal" | "rowdy"

// Per-persona mute set. Persisted in chrome.storage.local as a plain array
// under `mutedPersonas`. Client-side filter for v1 — muted personas still
// stream on the server (the pack LLM doesn't know), but their persona +
// persona_done events are suppressed from the feed + streaming UI, and
// their mug carries a `.muted` strike-through.
let mutedPersonas = new Set();

// Active theme token. "paper" (default) or "night". Applied to
// body.dataset.theme on load + on button click, persisted under `theme`.
let currentTheme = "paper";

// ── v1.7 PROMISE: user-facing feedback opt-out ──
// Default OFF (opt-in to share feedback). The Privacy Policy promised a
// user-facing toggle for this; the only other opt-outs were self-host
// (DISABLE_FEEDBACK_LOGGING=true on the backend) or not interacting with
// feed-entry menu. When true, sendFeedback() short-circuits and no
// /api/feedback POST leaves the browser. Local UI state (vote icons,
// pin highlight, quote-card render) works identically regardless.
// Persisted under `pgFeedbackOptOut`.
let feedbackOptOut = false;

// ── Per-persona fire-count (this-session) ──
// Count of *visible, non-empty* persona_done events per persona for
// the active session. Shown as a small chip in the corner of each
// persona mug so users can see cascade balance at a glance. The
// persona with the highest count carries an accent ring
// (`.persona-bubble.top-talker`). Resets when `buildPersonaAvatars`
// rebuilds (pack swap) or a new session starts.
const personaFireCounts = new Map();

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
const FREE_TIER_QUOTA_MS = FREE_TIER_MAX_SECONDS * 1000;
let freeTierIntervalId = null;
let freeTierStartMs = 0;
let freeTierCapped = false;

// Lifetime cumulative usage of the 15-minute trial across sessions.
// Persisted as `pgFreeTierUsedMs` in chrome.storage.local. Server-side
// is the source of truth (lib/free-tier-limiter.ts) — this client cache
// is what powers the live banner countdown + the "remove Demo option
// when used up" UX. If the user clears storage, the server still rejects.
let freeTierUsedMs = 0;
// Snapshotted on session start so we can compute the running total for
// the banner mid-session without re-reading storage on every tick.
let freeTierUsedAtStartMs = 0;

function hasRequiredUserKeys() {
  const dg = (deepgramKeyInput?.value || "").trim();
  const anth = (anthropicKeyInput?.value || "").trim();
  const xai = (xaiKeyInput?.value || "").trim();
  return !!(dg && anth && xai);
}

// ─── v1.9 Peanut Gallery Plus — subscription DOM refs ───────────────────
// Declared up here (rather than next to the other input refs near line 810)
// because the v1.9 BACKEND-MODE code block below uses them as top-level
// `const`s inside its body. In the temporal dead zone these would throw
// `ReferenceError` on first access, silently killing every subsequent
// event-listener registration in this file (drawer, Start Listening,
// feed menu — all of it). Fixed in PR #<n>; keep these declarations
// ABOVE the block until/unless a refactor splits the block into its
// own module.
const subscriptionKeyInput = document.getElementById("subscriptionKey");
const subscriptionBlock = document.getElementById("subscriptionBlock");
const subProgressFill = document.getElementById("subProgressFill");
const subProgressText = document.getElementById("subProgressText");
const subscriptionProgress = document.getElementById("subscriptionProgress");
const buySubBtn = document.getElementById("buySubBtn");
const manageSubBtn = document.getElementById("manageSubBtn");
const recoverSubBtn = document.getElementById("recoverSubBtn");
const backendModeSegmented = document.getElementById("backendModeSegmented");
const backendModeHint = document.getElementById("backendModeHint");

// ═══════════════════════════════════════════════════════════════════
// v1.9 BACKEND-MODE + PEANUT GALLERY PLUS
// ═══════════════════════════════════════════════════════════════════
//
// Four backend modes the user can pick between:
//   "demo"          — hosted demo keys, one-off 15-minute trial.
//   "byok"          — hosted backend, bring your own provider API keys.
//                     No Peanut Gallery billing; user pays providers.
//   "plus"          — hosted backend with a Peanut Gallery Plus license
//                     key; backend uses its own keys and meters the
//                     user's weekly hours.
//   "selfhost"      — point at a custom backend URL. Demo + Plus only
//                     run against our hosted server, so they're hidden
//                     in this mode and the server URL field appears.

let backendMode = "demo"; // "demo" | "byok" | "plus" | "selfhost"

const HOSTED_BACKEND_URL = "https://api.peanutgallery.live";

// v2.0.1: shared "Coming soon" modal for Plus. Fired both from the
// segmented control's Plus tab (Backend & keys drawer) and the
// first-run tutorial's final-page Plus CTA. openPromptModal writes
// body via textContent, so no HTML — plain emphasis via punctuation.
function openPlusComingSoonModal() {
  return openPromptModal({
    stamp: "Coming soon",
    title: "Peanut Gallery Plus",
    body:
      "This tier is in the works but not yet available. We're working through provider-approval and compliance details before launch. For now: pick Demo for a 15-minute free trial, or My keys to run on your own API keys — free forever.",
    confirmLabel: "Got it",
    cancelLabel: "Close",
    hideInput: true,
  }).catch(() => {});
}

function setBackendMode(mode, { persist = true } = {}) {
  if (mode !== "demo" && mode !== "byok" && mode !== "plus" && mode !== "selfhost") mode = "demo";
  backendMode = mode;
  // Update segmented visual state + aria.
  for (const btn of backendModeSegmented?.querySelectorAll(".segmented-option") || []) {
    const active = btn.dataset.value === mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  }
  // Show/hide subscription block + self-host block.
  if (subscriptionBlock) subscriptionBlock.hidden = mode !== "plus";
  // Server URL field is ALWAYS shown in selfhost mode. In Demo / My keys /
  // Plus it's hidden unless the debug panel is open — then it becomes a
  // power-user override for pointing at a non-default backend (localhost,
  // staging, etc.). Kept wired to the same serverUrlInput so existing
  // request code doesn't need to branch.
  updateSelfHostBlockVisibility(mode);
  // Show BYOK provider keys (Deepgram / Anthropic / xAI) ONLY in
  // "My keys" and Self-host modes. Demo runs on our hosted keys and Plus
  // runs on the subscription — neither should surface user-key fields.
  // HTML defaults the block to hidden so it doesn't flash on first paint
  // before this runs.
  const byokKeysBlock = document.getElementById("byokKeysBlock");
  if (byokKeysBlock) byokKeysBlock.hidden = !(mode === "byok" || mode === "selfhost");
  // Force the server URL to the hosted default in any non-selfhost mode.
  // In selfhost mode we restore the user's last custom URL, or clear the
  // field so they enter their own — no hosted URL pre-fill in selfhost.
  if (serverUrlInput) {
    if (mode === "selfhost") {
      chrome.storage.local.get(["pgSelfHostUrl"], (data) => {
        serverUrlInput.value = data?.pgSelfHostUrl || "";
      });
    } else {
      serverUrlInput.value = HOSTED_BACKEND_URL;
    }
  }
  // Update explanatory hint.
  if (backendModeHint) {
    backendModeHint.innerHTML =
      mode === "demo"
        ? "<strong>Demo:</strong> free 15-minute trial on our keys, one-off. After that: paste your own or subscribe."
        : mode === "byok"
          ? "<strong>My keys:</strong> you pay your own providers directly. No Peanut Gallery billing. Recommended if you use the product daily."
          : mode === "plus"
            ? "<strong>Plus:</strong> subscribe and we run the API calls. 16 hours a week; not a profit center — the goal is accessibility."
            : "<strong>Self-host:</strong> point at your own backend. Demo and Plus only run on our hosted server.";
  }
  if (persist) chrome.storage.local.set({ pgBackendMode: mode }).catch(() => {});
  // If flipping into Plus and a key is already on hand, poll status.
  if (mode === "plus" && subscriptionKeyInput?.value.trim()) {
    refreshSubscriptionStatus();
  }
  // Show the front-page free-trial banner whenever Demo is active (and
  // the trial isn't exhausted). Hidden in any other mode.
  refreshFreeTierBanner();
  // Re-evaluate the Demo tab's visibility: once the user leaves demo with
  // the trial exhausted, the tab should disappear (one-shot rule).
  refreshDemoOptionVisibility();
}

// Resolve selfHostBlock visibility from (mode, debugPanelOpen). Called from
// setBackendMode on every mode flip, and from setDebugPanelOpen when the
// debug toggle flips. Falls back to the current backendMode when caller
// doesn't pass one. Reads debugPanelOpen off `window` to stay safe if this
// fires before the later top-level `let debugPanelOpen` initializer runs.
function updateSelfHostBlockVisibility(mode = backendMode) {
  const selfHostBlock = document.getElementById("selfHostBlock");
  if (!selfHostBlock) return;
  const debugOn = !!globalThis.__pgDebugPanelOpen;
  selfHostBlock.hidden = mode !== "selfhost" && !debugOn;
}

async function refreshSubscriptionStatus() {
  const key = subscriptionKeyInput?.value.trim();
  if (!key) {
    if (subscriptionProgress) subscriptionProgress.hidden = true;
    return;
  }
  const url = normalizeServerUrl(serverUrlInput?.value);
  if (!url) return;
  try {
    const res = await fetch(`${url}/api/subscription/status`, {
      headers: { "X-Subscription-Key": key },
    });
    if (!res.ok) {
      if (subscriptionProgress) subscriptionProgress.hidden = true;
      return;
    }
    const data = await res.json();
    if (!subProgressFill || !subProgressText) return;
    const usedH = (data.usedMs || 0) / (60 * 60 * 1000);
    const capH = data.weeklyCapHours || 16;
    const pct = Math.min(100, Math.max(0, (usedH / capH) * 100));
    subProgressFill.style.width = `${pct.toFixed(1)}%`;
    const resetDate = new Date(data.resetAt);
    const resetDay = resetDate.toLocaleDateString(undefined, { weekday: "short" });
    subProgressText.textContent = data.valid
      ? `${usedH.toFixed(1)} h · ${capH} h · resets ${resetDay}`
      : data.error === "CAP_REACHED"
        ? `${capH} h used — resets ${resetDay}`
        : "Key not recognized";
    if (subscriptionProgress) subscriptionProgress.hidden = false;
  } catch {
    // Offline / backend down — leave the bar hidden, no error toast.
    if (subscriptionProgress) subscriptionProgress.hidden = true;
  }
}

/**
 * Branded replacement for window.prompt(). Opens the modal in
 * sidepanel.html, focuses the input, returns a Promise<string|null>.
 *
 * Resolves with the trimmed value on Confirm/Enter; resolves with null
 * on Cancel/Escape/backdrop click. Empty submissions count as null.
 *
 * Listeners are bound on every call and torn down on resolve so handlers
 * don't accumulate across opens.
 */
function openPromptModal({ stamp = "Dispatch", title, body, placeholder = "", initialValue = "", confirmLabel = "Confirm", cancelLabel = "Cancel", inputType = "text", hideInput = false } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("promptModal");
    const stampEl = document.getElementById("promptStamp");
    const titleEl = document.getElementById("promptTitle");
    const bodyEl = document.getElementById("promptBody");
    const input = document.getElementById("promptInput");
    const cancelBtn = document.getElementById("promptCancel");
    const confirmBtn = document.getElementById("promptConfirm");
    const backdrop = document.getElementById("promptBackdrop");
    if (!modal || !input || !cancelBtn || !confirmBtn || !backdrop) {
      resolve(null);
      return;
    }
    if (stampEl) stampEl.textContent = stamp;
    if (titleEl) titleEl.textContent = title || "";
    if (bodyEl) bodyEl.textContent = body || "";
    // Info-only mode: hide the input entirely and treat Confirm as a
    // plain "OK / do-the-thing" button that resolves `true`. Used for
    // already-subscribed confirmations where we don't need new input.
    input.hidden = !!hideInput;
    if (!hideInput) {
      input.type = inputType;
      input.placeholder = placeholder;
      input.value = initialValue;
    }
    confirmBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;

    function cleanup() {
      modal.classList.remove("visible");
      modal.setAttribute("aria-hidden", "true");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      backdrop.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onEscape);
    }
    function onCancel() { cleanup(); resolve(null); }
    function onConfirm() {
      if (hideInput) { cleanup(); resolve(true); return; }
      const v = input.value.trim();
      cleanup();
      resolve(v || null);
    }
    function onKey(e) {
      if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
    }
    function onEscape(e) {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    }

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    backdrop.addEventListener("click", onCancel);
    if (!hideInput) input.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onEscape);

    modal.classList.add("visible");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => (hideInput ? confirmBtn : input).focus(), 0);
  });
}

async function openSubscriptionCheckout() {
  const email = await openPromptModal({
    stamp: "Subscribe",
    title: "Peanut Gallery Plus",
    body: "We'll send your license key to this address. $8/month, cancel anytime.",
    placeholder: "you@example.com",
    inputType: "email",
    confirmLabel: "Continue to Stripe",
  });
  if (!email) return;
  const url = normalizeServerUrl(serverUrlInput?.value);
  if (!url) return;
  try {
    const res = await fetch(`${url}/api/subscription/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.checkoutUrl) {
      window.open(data.checkoutUrl, "_blank", "noopener");
      return;
    }
    // The backend refused the checkout because this email already has
    // an active Plus subscription. Surface a modal (the error banner
    // sits on the main panel and is invisible while the user is in
    // the settings drawer). The modal offers a one-click "resend key"
    // that reuses the email the user just typed.
    if (res.status === 409 && data.code === "ALREADY_SUBSCRIBED") {
      const confirmed = await openPromptModal({
        stamp: "Already subscribed",
        title: "You already have Plus",
        body:
          "This email is already on an active Peanut Gallery Plus subscription. Want us to email your license key again?",
        hideInput: true,
        confirmLabel: "Email me my key",
        cancelLabel: "Close",
      });
      if (!confirmed) return;
      try {
        const r = await fetch(`${url}/api/subscription/manage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, action: "recover_key" }),
        });
        const d = await r.json();
        await openPromptModal({
          stamp: "Dispatch",
          title: "Check your inbox",
          body: d.message || "We'll email your license key shortly.",
          hideInput: true,
          confirmLabel: "OK",
          cancelLabel: "Close",
        });
      } catch {
        await openPromptModal({
          stamp: "Error",
          title: "Couldn't reach the backend",
          body: "Please try again in a moment.",
          hideInput: true,
          confirmLabel: "OK",
          cancelLabel: "Close",
        });
      }
      return;
    }
    showError(data.error || "Couldn't start checkout. Try again later.", null);
  } catch {
    showError("Couldn't reach the backend to start checkout.", null);
  }
}

async function requestSubscriptionManage(action) {
  const stamp = action === "recover_key" ? "Recover key" : action === "cancel" ? "Cancel" : "Manage";
  const title = action === "recover_key" ? "Email me my key" : action === "cancel" ? "Cancel subscription" : "Manage subscription";
  const body = action === "recover_key"
    ? "Enter the email you signed up with. If we find an active subscription, we'll resend your license key."
    : "Enter the email on your subscription. We'll email you a Stripe portal link to update or cancel.";
  const email = await openPromptModal({
    stamp,
    title,
    body,
    placeholder: "you@example.com",
    inputType: "email",
    confirmLabel: "Send email",
  });
  if (!email) return;
  const url = normalizeServerUrl(serverUrlInput?.value);
  if (!url) return;
  try {
    const res = await fetch(`${url}/api/subscription/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action }),
    });
    const data = await res.json();
    showError(data.message || "Request logged.", null);
  } catch {
    showError("Couldn't reach the backend. Try again later.", null);
  }
}

// Wire the segmented controls + buttons.
if (backendModeSegmented) {
  backendModeSegmented.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-option");
    if (!btn) return;
    // v2.0.1: Plus is feature-flagged OFF in production pending the
    // reseller-approval / onboarding-relay architecture decisions driven
    // by the 2026-04-24 legal research brief. Keep the Plus tab visible
    // for discoverability (signals the feature is planned) but intercept
    // the tap with a modal explaining it's coming. Don't switch the
    // backend mode — the segmented control stays on whatever was
    // previously selected.
    if (btn.dataset.value === "plus") {
      openPlusComingSoonModal();
      return;
    }
    setBackendMode(btn.dataset.value);
  });
}
if (subscriptionKeyInput) {
  let statusDebounce = null;
  subscriptionKeyInput.addEventListener("input", () => {
    chrome.storage.local.set({ pgSubscriptionKey: subscriptionKeyInput.value.trim() }).catch(() => {});
    // Debounce status poll — don't hit the endpoint on every keystroke.
    clearTimeout(statusDebounce);
    statusDebounce = setTimeout(() => refreshSubscriptionStatus(), 500);
  });
}
if (buySubBtn) buySubBtn.addEventListener("click", () => openSubscriptionCheckout());
if (manageSubBtn) manageSubBtn.addEventListener("click", () => requestSubscriptionManage("cancel"));
if (recoverSubBtn) recoverSubBtn.addEventListener("click", () => requestSubscriptionManage("recover_key"));

// Persist the self-host URL only when the user is actively in selfhost mode.
// In any other mode the input is force-set to HOSTED_BACKEND_URL by
// setBackendMode and editing it has no effect.
//
// TDZ NOTE: serverUrlInput is declared via `const` ~300 lines below this
// block. Reach through document.getElementById to avoid the temporal-dead-zone
// crash that broke every click handler in #106 / #112.
{
  const el = document.getElementById("serverUrl");
  if (el) {
    el.addEventListener("input", () => {
      if (backendMode !== "selfhost") return;
      chrome.storage.local.set({ pgSelfHostUrl: el.value.trim() }).catch(() => {});
    });
  }
}

/** Load backend-mode + subscription state from storage on init. */
function rehydrateBackendMode() {
  chrome.storage.local.get(
    [
      "pgBackendMode",
      "pgSubscriptionKey",
      "pgSelfHostUrl",
      "pgFreeTierUsedMs",
    ],
    (data) => {
      if (data?.pgSubscriptionKey && subscriptionKeyInput) {
        subscriptionKeyInput.value = data.pgSubscriptionKey;
      }
      // Migration: a previously-stored custom serverUrl (from before the
      // self-host mode existed) seeds pgSelfHostUrl on first load so users
      // who self-hosted under the old UI don't lose their URL.
      if (!data?.pgSelfHostUrl && serverUrlInput?.value && serverUrlInput.value !== HOSTED_BACKEND_URL) {
        chrome.storage.local.set({ pgSelfHostUrl: serverUrlInput.value }).catch(() => {});
      }
      // Hydrate the lifetime free-trial usage counter (default 0). Clamped
      // to [0, FREE_TIER_QUOTA_MS] so a corrupt value can't expose a
      // negative remaining or grant more than 15 minutes back.
      const rawUsed = Number(data?.pgFreeTierUsedMs);
      freeTierUsedMs = Number.isFinite(rawUsed)
        ? Math.max(0, Math.min(FREE_TIER_QUOTA_MS, rawUsed))
        : 0;
      if (data?.pgBackendMode) {
        // v2.0.1: Plus is feature-flagged off in production pending
        // provider-approval decisions. Any persisted "plus" mode from a
        // pre-v2.0.1 install silently degrades to "demo" on load so the
        // user lands on a working mode instead of a dead Plus state.
        // The Plus tab itself stays clickable and shows the "coming
        // soon" modal on tap.
        const restoredMode = data.pgBackendMode === "plus" ? "demo" : data.pgBackendMode;
        setBackendMode(restoredMode, { persist: false });
      }
      // Even if no stored mode (so setBackendMode wasn't called), make sure
      // the segmented control reflects the trial state on first paint.
      refreshDemoOptionVisibility();
      refreshFreeTierBanner();
      // Kick a status poll if we're in Plus with a key.
      if (backendMode === "plus" && subscriptionKeyInput?.value.trim()) {
        refreshSubscriptionStatus();
      }
    }
  );
}

/** The effective session mode used by start-capture. Self-host collapses
 *  to "byok" because the request leaves our infra entirely — the user's
 *  backend interprets headers however it likes. */
function effectiveBackendMode() {
  return backendMode === "selfhost" ? "byok" : backendMode;
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
  // Snapshot lifetime usage at session start so the banner can show
  // total-remaining (lifetime - used - this-session-elapsed).
  freeTierUsedAtStartMs = freeTierUsedMs;
  // The cap for THIS session is whatever's left in the lifetime budget,
  // not the full 15 min. A user with 3 min already consumed only gets
  // a 12-min session before flipping to cap-reached.
  const sessionRemainingSec = Math.max(
    0,
    (FREE_TIER_QUOTA_MS - freeTierUsedAtStartMs) / 1000
  );
  statusBar.classList.remove("capped");
  statusTime.textContent = "00:00:00";
  if (episodeCard) {
    episodeCard.classList.add("with-progress");
    episodeCard.classList.remove("capped");
  }
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "0%";
  freeTierIntervalId = setInterval(() => {
    const elapsed = (Date.now() - freeTierStartMs) / 1000;
    if (!freeTierCapped && elapsed >= sessionRemainingSec) {
      flipToCapReached();
      return;
    }
    statusTime.textContent = formatHMS(Math.min(elapsed, sessionRemainingSec));
    // Progress bar on the episode card tracks elapsed-vs-quota across
    // the lifetime budget, not just this session.
    if (episodeCardProgressFill) {
      const totalUsedMs = freeTierUsedAtStartMs + elapsed * 1000;
      const pct = Math.min(100, (totalUsedMs / FREE_TIER_QUOTA_MS) * 100);
      episodeCardProgressFill.style.width = pct + "%";
    }
    // Live-update the front-page free banner with remaining time.
    refreshFreeTierBanner({ liveSessionElapsedMs: elapsed * 1000 });
  }, 1000);
}

function stopFreeTierTimer() {
  if (freeTierIntervalId != null) {
    clearInterval(freeTierIntervalId);
    freeTierIntervalId = null;
  }
  // If a demo session was actively running, persist the elapsed delta
  // into the lifetime counter. Idempotent if no session was running
  // (freeTierStartMs == 0). Caps the increment at remaining quota so
  // we never overshoot.
  if (freeTierStartMs > 0) {
    const elapsedMs = Date.now() - freeTierStartMs;
    const cap = Math.max(0, FREE_TIER_QUOTA_MS - freeTierUsedAtStartMs);
    const delta = Math.max(0, Math.min(elapsedMs, cap));
    if (delta > 0) {
      freeTierUsedMs = Math.min(FREE_TIER_QUOTA_MS, freeTierUsedMs + delta);
      chrome.storage.local
        .set({ pgFreeTierUsedMs: freeTierUsedMs })
        .catch(() => {});
    }
    freeTierStartMs = 0;
  }
  refreshFreeTierBanner();
  refreshDemoOptionVisibility();
}

/** Lifetime ms still available on the free trial. */
function freeTierRemainingMs() {
  return Math.max(0, FREE_TIER_QUOTA_MS - freeTierUsedMs);
}
function freeTierExhausted() {
  return freeTierRemainingMs() <= 0;
}

/**
 * Update the front-page banner: visibility, remaining-time lede,
 * headline copy. Visible only when backendMode === "demo" AND the
 * lifetime quota isn't exhausted.
 *
 * Pass `{ liveSessionElapsedMs }` from inside the per-second tick to
 * subtract the in-flight session from the displayed remaining.
 */
function refreshFreeTierBanner({ liveSessionElapsedMs = 0 } = {}) {
  const banner = document.getElementById("freeBanner");
  if (!banner) return;

  const exhausted = freeTierExhausted();
  const inDemoMode = backendMode === "demo";

  // Hide the banner entirely only when the user is in a non-demo mode.
  // When demo is selected AND the trial is exhausted, we still render the
  // card — just flip it to the red "exhausted" variant so the user sees
  // the trial-ended pitch instead of the meter disappearing on them.
  if (!inDemoMode) {
    banner.hidden = true;
    banner.classList.remove("exhausted");
    return;
  }
  banner.hidden = false;
  banner.classList.toggle("exhausted", exhausted);

  // Compute remaining display: lifetime quota minus stored used minus
  // any in-flight session time (snapshot taken at session start).
  let remainingMs;
  if (liveSessionElapsedMs > 0) {
    remainingMs = Math.max(
      0,
      FREE_TIER_QUOTA_MS - freeTierUsedAtStartMs - liveSessionElapsedMs
    );
  } else {
    remainingMs = freeTierRemainingMs();
  }

  // Format as M:SS — the slab lede only fits a few characters.
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;

  const timeEl = document.getElementById("freeBannerTime");
  const labelEl = document.getElementById("freeBannerTimeLabel");
  const headlineEl = document.getElementById("freeBannerHeadline");
  if (timeEl) timeEl.textContent = timeStr;

  const sessionRunning = liveSessionElapsedMs > 0;
  const fullyFresh = freeTierUsedMs === 0 && !sessionRunning;
  if (exhausted) {
    if (timeEl) timeEl.textContent = "0:00";
    if (labelEl) labelEl.textContent = "OVER";
    if (headlineEl) headlineEl.textContent = "Trial ended. Pick a path below.";
  } else if (sessionRunning) {
    if (labelEl) labelEl.textContent = "LEFT";
    if (headlineEl) headlineEl.textContent = "Trial running.";
  } else if (fullyFresh) {
    if (labelEl) labelEl.textContent = "FREE";
    if (headlineEl) headlineEl.textContent = "Fifteen free minutes to try it out.";
  } else {
    if (labelEl) labelEl.textContent = "LEFT";
    const usedSec = Math.round(freeTierUsedMs / 1000);
    const usedMin = Math.floor(usedSec / 60);
    const usedSecRem = usedSec % 60;
    const usedStr = `${usedMin}:${String(usedSecRem).padStart(2, "0")}`;
    if (headlineEl) headlineEl.textContent = `Trial: ${usedStr} of 15:00 used.`;
  }
}

/**
 * Show or hide the Demo option in the backend-mode segmented control
 * based on whether the lifetime trial is exhausted. If we're currently
 * in demo mode and the trial just ran out, kick over to "byok" so the
 * user is never stuck in a mode that's been removed from the UI.
 */
function refreshDemoOptionVisibility() {
  if (!backendModeSegmented) return;
  const demoBtn = backendModeSegmented.querySelector(
    '.segmented-option[data-value="demo"]'
  );
  if (!demoBtn) return;
  // Demo access rule (per Seth 2026-04-23):
  //   • Trial NOT exhausted → tab visible always.
  //   • Trial exhausted + currently parked on demo → tab visible, showing the
  //     red "trial over" card. User sees WHY listening stopped.
  //   • Trial exhausted + user has moved off demo → tab HIDDEN. Demo is a
  //     one-shot; once they leave it with the clock at zero there's no way
  //     back in. Prevents them from re-entering an empty-pocket mode just
  //     to stare at the red card again.
  const exhausted = freeTierExhausted();
  const parkedOnDemo = backendMode === "demo";
  demoBtn.hidden = exhausted && !parkedOnDemo;
}

// ── Elapsed-timer (paid BYOK + Plus) ──
// Simple count-up readout in the status-time slot. Reuses
// `freeTierIntervalId` + `freeTierStartMs` storage (there's only ever
// one timer running; sharing avoids a second variable + a second
// stopFooTimer helper). Does NOT touch the episode-card progress bar
// or flip to a cap-reached state — paid users have no cap to visualize.
// Stopped via the same stopFreeTierTimer() on session end / Stop tap.
function startElapsedTimer() {
  stopFreeTierTimer();
  freeTierCapped = false;
  freeTierStartMs = Date.now();
  statusBar.classList.remove("capped");
  statusTime.textContent = "00:00:00";
  if (episodeCard) {
    // Paid mode intentionally hides the progress fill — the card
    // doesn't need a "budget used" visual. If a previous free-tier
    // session left `.with-progress` on, clear it.
    episodeCard.classList.remove("with-progress", "capped");
  }
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "0%";
  freeTierIntervalId = setInterval(() => {
    const elapsed = (Date.now() - freeTierStartMs) / 1000;
    statusTime.textContent = formatHMS(elapsed);
  }, 1000);
}

function flipToCapReached() {
  freeTierCapped = true;
  // Stop the timer FIRST so stopFreeTierTimer can persist the final
  // elapsed delta into pgFreeTierUsedMs. Calling it before showIdle
  // keeps freeTierStartMs non-zero for the persist branch.
  stopFreeTierTimer();
  // Tear the live session down — the trial hit its lifetime cap, so
  // there's nothing left to listen with. The red "Trial ended" card
  // on the demo tab is the next step; leaving the capture running
  // would just burn CPU with no upstream budget.
  if (capturing) {
    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }).catch(() => {});
    showIdle();
  }
  // Repaint the demo card in its exhausted red state on the now-idle
  // setup screen so the user sees WHY listening stopped.
  refreshFreeTierBanner();
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
// v2.0.1: Brave Search deprecated. braveKey / searchEngine picker
// removed — fact-checker always uses xAI Live Search via the xAI key.
// (subscription-UI const refs moved up to ~line 525 so they're declared
//  before the v1.9 BACKEND-MODE code block references them.)
const passthroughToggle = document.getElementById("passthroughToggle");
const outputDeviceSelect = document.getElementById("outputDevice");
const muteSfxToggle = document.getElementById("muteSfxToggle");
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
// Drawer → Privacy section (v1.7 Privacy-Policy-promise opt-out).
const feedbackOptOutToggle = document.getElementById("feedbackOptOutToggle");
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
// Defensive force-hide on the tutorial overlay BEFORE anything else runs.
// If a previous load ever left the overlay stuck visible (e.g. a
// renderTutorialStep that threw AFTER classList.add("visible") already
// fired), the backdrop's pointer-events: auto would invisibly intercept
// every click on the next reload. Stripping the .visible class here is
// zero-cost insurance — the real startTutorial() call path adds it
// back intentionally when needed.
const _initTutorialOverlay = document.getElementById("tutorialOverlay");
if (_initTutorialOverlay) {
  _initTutorialOverlay.classList.remove("visible");
  _initTutorialOverlay.setAttribute("aria-hidden", "true");
}

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
      "passthrough",
      "outputDeviceId",
      "muteSfx",
      "responseRate",
      "packId",
      "theme",
      "mutedPersonas",
      "pgFeedbackOptOut",
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
      // v2.0.1: Brave deprecated. Any legacy braveKey / searchEngine in
      // chrome.storage.local is ignored; we don't bother migrating since
      // the values just go unread.

      // Audio routing defaults: passthrough ON + system default device.
      // Matches pre-v1.1 behavior exactly for existing users.
      passthroughToggle.checked = data.passthrough !== false;
      const savedDevice = data.outputDeviceId || "default";
      // Selected device is applied once enumerateOutputDevices() runs (async).
      outputDeviceSelect.dataset.pendingValue = savedDevice;

      if (muteSfxToggle) muteSfxToggle.checked = data.muteSfx === true;

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

      // Privacy → feedback opt-out. Default OFF (i.e. data sharing ON) to
      // match the Privacy Policy's stated default; user explicitly flips
      // to opt out. We read the saved value as an exact boolean `true` so
      // any corruption collapses back to the documented default.
      feedbackOptOut = data.pgFeedbackOptOut === true;
      if (feedbackOptOutToggle) {
        // Checkbox semantics match the label "Share feedback with the
        // project": checked = share (default on), unchecked = opt out.
        // Our state variable inverts that (`feedbackOptOut=true` means
        // *don't* share), so reflect the inverse in the checkbox.
        feedbackOptOutToggle.checked = !feedbackOptOut;
      }

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
    passthrough: passthroughToggle.checked,
    outputDeviceId: currentOutputDeviceId(),
    muteSfx: muteSfxToggle ? muteSfxToggle.checked : false,
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
    // Free-tier: count up toward the 15-minute cap + flip to "CAP REACHED"
    // when we hit it. The countdown IS the primary budget signal.
    statusTag.textContent = "LISTENING";
    statusDetail.textContent = capturedTabInfo?.title || "—";
    startFreeTierTimer();
  } else {
    // Paid (BYOK or Plus): simple count-up elapsed-timer readout in the
    // status-time slot. No cap, no "paused" flip. Users asked for
    // session-length visibility; the elapsed clock gives it without
    // bolting on a second UI surface.
    startElapsedTimer();
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
  // v1.7 feed-action state: clear per-session votes + pin + menu. Keep
  // the global sensitivity (it's not session-scoped). If the user
  // re-starts a session they'll get a fresh vote/pin slate.
  feedVotes.clear();
  if (pinnedEntry) {
    pinnedEntry = null;
    hidePinnedStrip();
  }
  hideFeedMenu();
  // v2.0 session-recall: close out the session record before we null
  // sessionId. Forces a transcript flush + end timestamp + stats snapshot
  // so Past-Sessions UI (v2.0) has a clean terminal state to render.
  // Capture sessionId into a local — the store call is async but `sessionId`
  // gets reset synchronously below, and we need the id alive for the write.
  const endingSessionId = sessionId;
  if (self.PGSessionStore && endingSessionId) {
    const stats = { ...sessionStats };
    // Final transcript snapshot (force=true bypasses debounce so the
    // stored tail matches what showIdle sees right now).
    self.PGSessionStore.updateTranscript(endingSessionId, transcriptFinal, { force: true })
      .catch(() => {})
      .then(() => self.PGSessionStore.endSession(endingSessionId, stats))
      .catch(() => {});
  }
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
  // v1.7: clear session stats + per-persona tooltip map so the next session
  // starts with a clean slate. Traces and filter state persist (operator
  // debug-tool convenience, not user-visible).
  resetSessionStats();
  lastDecisionForPersona.clear();
  statusBar.style.display = "none";
  statusBar.classList.remove("with-timer", "capped", "active", "live");
  if (episodeCard) {
    episodeCard.style.display = "none";
    episodeCard.classList.remove("with-progress", "capped");
  }
  if (episodeCardProgressFill) episodeCardProgressFill.style.width = "0%";
  stopFreeTierTimer();
  freeTierCapped = false;
  // Repaint the free-trial banner on idle so the post-session state
  // reflects the persisted pgFreeTierUsedMs (and flips to the red
  // "exhausted" variant if this session consumed the last of it).
  refreshFreeTierBanner();
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
  resetPersonaFireCounts();
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
    // dk is filled in at runtime so we can name the configured backend URL —
    // that's the one piece of context users need to decide whether to fix
    // their DNS, start a local dev server, or switch to localhost.
    dk: "Can't reach the backend.",
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
  // v2.0.1: Peanut Gallery Plus weekly-cap-reached empty state. Distinct
  // from "needs-keys" (the free-tier exhausted case) because the user
  // HAS a valid Plus subscription — their path forward is to paste BYOK
  // keys for the rest of the week, or wait for the weekly reset. Banner
  // message from the server carries the specific hours-to-reset figure.
  "cap-reached-plus": {
    lg: "Cap<br>Reached.",
    dk: "Your Peanut Gallery Plus meter is at the weekly cap. Paste your own API keys in the drawer to keep watching now, or come back after the weekly reset.",
    cta: { text: "Open Settings", action: "settings:backend" },
  },
};

function setEmptyStateVariant(variant) {
  const v = EMPTY_STATE_VARIANTS[variant] ?? EMPTY_STATE_VARIANTS.idle;
  if (!emptyStateLg || !emptyStateDk || !emptyStateCta) return;
  emptyStateLg.innerHTML = v.lg;
  if (variant === "unreachable") {
    // Name the configured backend so the user can tell at a glance whether
    // they're pointed at a dead hosted URL, a stopped local dev server, or
    // a typo. Localhost hint is included because the most common recovery
    // during development is "oh, I forgot to run npm run dev" or "switch
    // from hosted to localhost."
    const configuredUrl = (serverUrlInput?.value || "").trim() || "(not set)";
    emptyStateDk.innerHTML = `Can't reach <strong>${escapeHtml(configuredUrl)}</strong>. ` +
      `If you're running the backend locally, set the server URL to ` +
      `<code>http://localhost:3000</code> in Settings → Backend &amp; keys ` +
      `and make sure <code>npm run dev</code> is running. Otherwise check ` +
      `that the hosted backend is up, then Start Listening again.`;
  } else {
    emptyStateDk.textContent = v.dk;
  }
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

// ═══════════════════════════════════════════════════════════════════
// v1.7 FEED-ENTRY ACTIONS — popover menu, vote, pin, quote-card stub
// ═══════════════════════════════════════════════════════════════════
//
// State (top of file): feedVotes, pinnedEntry, currentMenuTargetId.
// Storage keys: pgVotes_<sessionId>, pgPin_<sessionId>, pgSensitivity.

const feedMenu = document.getElementById("feedEntryMenu");
const pinnedStripEl = document.getElementById("pinnedStrip");
const pinnedTextEl = document.getElementById("pinnedText");
const pinnedPersonaNameEl = document.getElementById("pinnedPersonaName");
const pinnedPersonaRoleEl = document.getElementById("pinnedPersonaRole");
const pinnedStripCollapseBtn = document.getElementById("pinnedStripCollapse");
const pinnedStripUnpinBtn = document.getElementById("pinnedStripUnpin");

function showFeedMenu(entryId, anchorEl) {
  if (!feedMenu || !anchorEl) return;
  currentMenuTargetId = entryId;
  refreshFeedMenuState();
  // Focus the first menu item once the menu is visible so keyboard users
  // can arrow-nav immediately. Deferred to the end of this function via
  // requestAnimationFrame so layout has settled before the focus call.
  // Position: below the entry if there's room, above otherwise. Clamp
  // horizontally to the viewport. Fixed positioning means we measure
  // against getBoundingClientRect (viewport coords).
  const rect = anchorEl.getBoundingClientRect();
  const menuH = 164; // rough height; updated after render via offsetHeight
  const menuW = 184;
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  let top = rect.bottom + 4;
  if (top + menuH > viewportH - 8) top = Math.max(8, rect.top - menuH - 4);
  let left = rect.left + 8;
  if (left + menuW > viewportW - 8) left = Math.max(8, viewportW - menuW - 8);
  feedMenu.style.top = `${top}px`;
  feedMenu.style.left = `${left}px`;
  feedMenu.classList.add("visible");
  feedMenu.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    const firstItem = feedMenu.querySelector(".feed-menu-item");
    firstItem?.focus();
  });
}

function hideFeedMenu() {
  if (!feedMenu) return;
  feedMenu.classList.remove("visible");
  feedMenu.setAttribute("aria-hidden", "true");
  currentMenuTargetId = null;
}

function refreshFeedMenuState() {
  if (!feedMenu || !currentMenuTargetId) return;
  const currentVote = feedVotes.get(currentMenuTargetId) || null;
  const isPinned = pinnedEntry?.id === currentMenuTargetId;
  for (const btn of feedMenu.querySelectorAll(".feed-menu-item")) {
    const action = btn.dataset.action;
    if (action === "upvote") {
      btn.dataset.active = currentVote === "up" ? "true" : "false";
    } else if (action === "downvote") {
      btn.dataset.active = currentVote === "down" ? "true" : "false";
    } else if (action === "pin") {
      btn.dataset.active = isPinned ? "true" : "false";
      const labelEl = btn.querySelector(".fmi-label");
      if (labelEl) labelEl.textContent = isPinned ? "Unpin" : "Pin to top";
    }
  }
}

// Menu item click dispatch — delegated on the menu container so we don't
// attach per-button handlers and so dynamic state (current target) is
// always fresh.
if (feedMenu) {
  feedMenu.addEventListener("click", (e) => {
    const btn = e.target.closest(".feed-menu-item");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const entryId = currentMenuTargetId;
    if (!entryId) return;
    if (action === "upvote") toggleVote(entryId, "up");
    else if (action === "downvote") toggleVote(entryId, "down");
    else if (action === "pin") togglePin(entryId);
    else if (action === "quote-card") exportQuoteCard(entryId);
    else if (action === "regenerate") regenerateEntry(entryId);
    else if (action === "delete") deleteEntry(entryId);
    hideFeedMenu();
  });
}

// Dismiss on outside click / Escape. Capture-phase click on document
// because the menu buttons need to process their click first.
document.addEventListener("click", (e) => {
  if (!feedMenu?.classList.contains("visible")) return;
  if (feedMenu.contains(e.target)) return;
  hideFeedMenu();
});
document.addEventListener("keydown", (e) => {
  if (!feedMenu?.classList.contains("visible")) return;
  if (e.key === "Escape") {
    hideFeedMenu();
    return;
  }
  // Arrow-key navigation through menu items (a11y — keyboard-only users).
  // Up/Down cycles focus; Home/End jump to edges; Enter/Space activate
  // the focused item (handled natively by <button>).
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
    const items = Array.from(feedMenu.querySelectorAll(".feed-menu-item"));
    if (items.length === 0) return;
    const active = document.activeElement;
    let idx = items.indexOf(active);
    if (e.key === "ArrowDown") idx = idx < 0 ? 0 : (idx + 1) % items.length;
    else if (e.key === "ArrowUp") idx = idx <= 0 ? items.length - 1 : idx - 1;
    else if (e.key === "Home") idx = 0;
    else if (e.key === "End") idx = items.length - 1;
    items[idx].focus();
    e.preventDefault();
  }
});

// ── Upvote / downvote ──
// Toggle semantics: tapping the same vote a second time clears it. Vote
// state is per-session and writes through to chrome.storage.local so a
// side-panel reload doesn't lose the signal. The smart-highlight picker
// (separate backlog item) reads the upvoted set when present; falls
// back to "pick best from all fires" when none.
function toggleVote(entryId, vote) {
  const current = feedVotes.get(entryId);
  if (current === vote) {
    feedVotes.delete(entryId);
  } else {
    feedVotes.set(entryId, vote);
  }
  const next = feedVotes.get(entryId);
  const el = document.getElementById(`feed-${entryId}`);
  if (el) {
    if (next) el.dataset.vote = next;
    else delete el.dataset.vote;
  }
  persistVotes();
  // v1.7: also send the signal to the backend so it can be used for
  // model tuning + smart-highlight picking across sessions. Fire-and-
  // forget — a network failure shouldn't undo the local state.
  const action = next ? (next === "up" ? "upvote" : "downvote") : "clear_vote";
  sendFeedback(action, entryId);
}

function persistVotes() {
  if (!sessionId) return;
  const obj = {};
  for (const [id, v] of feedVotes) obj[id] = v;
  const key = `pgVotes_${sessionId}`;
  chrome.storage.local.set({ [key]: obj }).catch(() => {});
}

/**
 * v1.7: post a feedback event to the backend so the server-side log
 * captures what the user liked / disliked / kept / shared. Accumulates
 * in `logs/pipeline-debug.jsonl` as `persona_feedback` events for
 * downstream use — model tuning, the v1.8 persona-refinement sprint,
 * and the smart-highlight picker fallback when it runs server-side.
 *
 * Fire-and-forget — the local state is the source of truth for the
 * UI, so a network drop has no user-visible consequence. If the
 * backend is unreachable we swallow and move on.
 *
 * Action values must match the server's validator in
 * `app/api/feedback/route.ts`: upvote | downvote | clear_vote |
 * pin | unpin | quote_card | delete. Anything else is rejected
 * with 400.
 */
function sendFeedback(action, entryId) {
  // User-facing opt-out. When the "Share feedback with the project" toggle
  // in Settings → Privacy is off, every /api/feedback POST is skipped at
  // the client. Local UI state (vote icons, pin highlight) is unaffected —
  // that's a client-side feature. This delivers the Privacy-Policy
  // promise of a user-facing opt-out without touching server-side logic.
  if (feedbackOptOut) return;
  const serverUrl = normalizeServerUrl(serverUrlInput?.value);
  if (!serverUrl) return; // extension not configured yet
  const entry = feedEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const headers = { "Content-Type": "application/json" };
  if (installId) headers["X-Install-Id"] = installId;
  const body = JSON.stringify({
    sessionId: sessionId || null,
    entryId,
    action,
    personaId: entry.personaId,
    packId: currentPackId || null,
    responseText: entry.text,
    transcriptTail: entry.transcript || null,
    timestamp: entry.timestamp,
  });
  fetch(`${serverUrl}/api/feedback`, { method: "POST", headers, body }).catch(
    () => {
      // Older backends without /api/feedback return 404; that's
      // fine — the local state still drives the UI. No retry,
      // no user-visible error.
    }
  );
}

// ── Pin / unpin + drop-down strip ──
// One pinned entry at a time; re-pinning a different entry replaces.
// Unpin clears. Collapse toggles body visibility without discarding the
// pin. Animation uses CSS transform + opacity transition (see
// .pinned-strip CSS in sidepanel.html).
function togglePin(entryId) {
  if (pinnedEntry?.id === entryId) {
    unpinEntry();
    return;
  }
  const entry = feedEntries.find((e) => e.id === entryId);
  if (!entry) return;
  const persona = PERSONAS.find((p) => p.id === entry.personaId);
  pinnedEntry = {
    id: entry.id,
    personaId: entry.personaId,
    role: entry.role,
    name: persona?.name || entry.personaId,
    text: entry.text,
    transcript: entry.transcript || "",
    timestamp: entry.timestamp,
  };
  renderPinned();
  persistPin();
  markPinnedEntryDom();
  // Pin is a strong positive signal (stronger than upvote — the user
  // wants this to stay visible). Log to backend for model tuning.
  sendFeedback("pin", entry.id);
}

function unpinEntry() {
  const prevId = pinnedEntry?.id;
  pinnedEntry = null;
  hidePinnedStrip();
  persistPin();
  if (prevId) {
    const el = document.getElementById(`feed-${prevId}`);
    if (el) delete el.dataset.pinned;
    sendFeedback("unpin", prevId);
  }
}

// ── Delete a feed entry (v2.0.1) ──
// Strong-negative feedback signal — user actively removed the take from
// the feed rather than letting it sit with a thumbs-down. Ranks above
// downvote in any downstream model-tuning aggregation; the server's
// VALID_ACTIONS whitelist ("delete") has a matching note.
//
// Telemetry is fire-and-forget through sendFeedback, which already
// honors the user's feedbackOptOut toggle — no separate opt-out path
// needed here. The UI-side removal happens regardless of opt-out: the
// user's action on their own feed is a client-side affordance that
// doesn't depend on server acknowledgement.
//
// We also clean up any pin or vote state attached to the entry. Those
// are now meaningless (the entry is gone) and we deliberately do NOT
// emit a separate "unpin" / "clear_vote" event in that case — delete
// is the stronger signal and downstream consumers should prefer it
// over the weaker cleanup signals.
function deleteEntry(entryId) {
  const entry = feedEntries.find((e) => e.id === entryId);
  if (!entry) return;

  // Fire telemetry BEFORE mutating state — sendFeedback reads entry.text
  // and entry.transcript from feedEntries for the payload.
  sendFeedback("delete", entryId);

  // If this entry was pinned, clear the pin silently (no "unpin" event —
  // delete supersedes it).
  if (pinnedEntry?.id === entryId) {
    pinnedEntry = null;
    hidePinnedStrip();
    persistPin();
  }

  // Drop any vote state for this entry (same reason — delete supersedes
  // clear_vote).
  if (feedVotes.has(entryId)) {
    feedVotes.delete(entryId);
    persistVotes();
  }

  // Remove from the in-memory list so export + the smart-highlight
  // picker skip it on future reads.
  const idx = feedEntries.findIndex((e) => e.id === entryId);
  if (idx >= 0) feedEntries.splice(idx, 1);

  // Remove the DOM node.
  const el = document.getElementById(`feed-${entryId}`);
  if (el) el.remove();
}

function renderPinned() {
  if (!pinnedEntry || !pinnedStripEl) return;
  pinnedPersonaNameEl.textContent = pinnedEntry.name;
  pinnedPersonaRoleEl.textContent = pinnedEntry.role.toUpperCase();
  pinnedTextEl.textContent = pinnedEntry.text;
  showPinnedStrip();
}

function showPinnedStrip() {
  if (!pinnedStripEl) return;
  pinnedStripEl.classList.remove("collapsed");
  // display:block first so the browser picks up the initial state, then
  // .visible in the next frame to trigger the transform/opacity
  // transition. Without the rAF the transition short-circuits.
  pinnedStripEl.style.display = "block";
  pinnedStripEl.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => pinnedStripEl.classList.add("visible"));
}

function hidePinnedStrip() {
  if (!pinnedStripEl) return;
  pinnedStripEl.classList.remove("visible");
  pinnedStripEl.setAttribute("aria-hidden", "true");
  // Wait for the transition to end before removing from flow so the
  // slide-up is visible. Duration matches the CSS (180ms).
  setTimeout(() => {
    if (!pinnedEntry) pinnedStripEl.style.display = "none";
  }, 200);
}

function markPinnedEntryDom() {
  // Remove prior pin marker, add new one.
  for (const el of document.querySelectorAll('.feed-entry[data-pinned="true"]')) {
    delete el.dataset.pinned;
  }
  if (pinnedEntry) {
    const el = document.getElementById(`feed-${pinnedEntry.id}`);
    if (el) el.dataset.pinned = "true";
  }
}

function persistPin() {
  if (!sessionId) return;
  const key = `pgPin_${sessionId}`;
  chrome.storage.local.set({ [key]: pinnedEntry }).catch(() => {});
}

if (pinnedStripCollapseBtn) {
  pinnedStripCollapseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pinnedStripEl?.classList.toggle("collapsed");
  });
}
if (pinnedStripUnpinBtn) {
  pinnedStripUnpinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    unpinEntry();
  });
}

// ── Quote card (PNG renderer) ──
// Renders a 1200×1200 Broadsheet-style PNG via PGQuoteCard.buildQuoteCardBlob
// (extension/lib/quote-card.js) and writes it to the clipboard.
// Falls back to a download if navigator.clipboard.write is rejected
// (e.g. the panel lost focus). Sends the quote_card feedback signal
// regardless of which path succeeds.
async function exportQuoteCard(entryId) {
  const entry = feedEntries.find((e) => e.id === entryId);
  if (!entry) return;

  const persona = PERSONAS.find((p) => p.id === entry.personaId);
  const enriched = { ...entry, personaName: persona?.name || entry.personaId };

  // sendFeedback is a strong positive signal — fire it before the
  // async render so the signal lands even if the render throws.
  sendFeedback("quote_card", entryId);

  if (!window.PGQuoteCard) {
    // Renderer not yet loaded — degrade gracefully to text copy.
    const body = [
      entry.transcript ? `\u201C${entry.transcript.trim()}\u201D` : null,
      `\u2014 ${enriched.personaName} (${entry.role.toUpperCase()})`,
      "",
      entry.text,
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(body).catch(() => {});
    showError("Copied as text (image renderer not ready yet).", null);
    return;
  }

  let blob;
  try {
    blob = await PGQuoteCard.buildQuoteCardBlob(enriched, currentPackId, currentTheme);
  } catch (err) {
    showError("Quote card render failed — see console for details.", null);
    console.error("[PGQuoteCard] render error:", err);
    return;
  }

  // Try clipboard write first; fall back to download on rejection.
  let usedClipboard = false;
  if (navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      usedClipboard = true;
    } catch (_) {
      // Clipboard write rejected (focus loss, permissions, etc.) —
      // fall through to download.
    }
  }

  if (!usedClipboard) {
    // Download fallback
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = "peanut-gallery-quote.png";
    a.click();
    URL.revokeObjectURL(url);
    showError("Saved quote card as a download.", null);
  } else {
    showError("Copied quote card to clipboard \u00B7 paste into any app.", null);
  }
}

// ── Sensitivity segmented control (Lineup drawer — moved in v2.0.1) ──
// Three-way radio: Quieter / Normal / Rowdy. Scales cascade probability
// on the Director (via X-Sensitivity header on session start). Change
// takes effect on the next session — we don't restart mid-stream.
const sensitivitySegmented = document.getElementById("sensitivitySegmented");
if (sensitivitySegmented) {
  sensitivitySegmented.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-option");
    if (!btn) return;
    const value = btn.dataset.value;
    if (value !== "quiet" && value !== "normal" && value !== "rowdy") return;
    setSensitivity(value);
  });
}

function setSensitivity(value) {
  sensitivityValue = value;
  for (const btn of sensitivitySegmented?.querySelectorAll(".segmented-option") || []) {
    const active = btn.dataset.value === value;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", active ? "true" : "false");
  }
  chrome.storage.local.set({ pgSensitivity: value }).catch(() => {});
}

// Rehydrate feed-action state when the side panel opens — sensitivity is
// global; votes + pin are session-scoped and only rehydrate if the
// current sessionId matches.
function rehydrateFeedActions(activeSessionId) {
  chrome.storage.local.get(["pgSensitivity"], (data) => {
    const v = data?.pgSensitivity;
    if (v === "quiet" || v === "normal" || v === "rowdy") setSensitivity(v);
  });
  if (activeSessionId) {
    chrome.storage.local.get(
      [`pgVotes_${activeSessionId}`, `pgPin_${activeSessionId}`],
      (data) => {
        const votes = data?.[`pgVotes_${activeSessionId}`];
        if (votes && typeof votes === "object") {
          feedVotes.clear();
          for (const [id, v] of Object.entries(votes)) {
            if (v === "up" || v === "down") feedVotes.set(id, v);
          }
          // Paint data-vote on any already-rendered entries.
          for (const [id, v] of feedVotes) {
            const el = document.getElementById(`feed-${id}`);
            if (el) el.dataset.vote = v;
          }
        }
        const pin = data?.[`pgPin_${activeSessionId}`];
        if (pin && pin.id) {
          pinnedEntry = pin;
          renderPinned();
          markPinnedEntryDom();
        }
      }
    );
  }
}

// v1.7: source-filter chips on the director trace panel. Click to hide a
// source. State is DOM-only (no persistence) — debug-tool convenience.
const traceFilterChips = document.querySelectorAll(".trace-filter-chip");
for (const chip of traceFilterChips) {
  chip.addEventListener("click", () => {
    const filter = chip.dataset.filter;
    if (!filter) return;
    const on = chip.classList.toggle("on");
    chip.setAttribute("aria-pressed", on ? "true" : "false");
    // Mirror into a data-hide-* attribute on the list so pure CSS handles
    // the hide. Avoids re-rendering the list on every filter flip.
    const list = document.getElementById("traceList");
    if (!list) return;
    if (on) list.removeAttribute(`data-hide-${filter}`);
    else list.setAttribute(`data-hide-${filter}`, "1");
  });
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
function showError(msg, variant, action) {
  errorText.textContent = msg;
  errorBanner.classList.add("visible");
  // Optional CTA — shown inline before the dismiss button. Pass
  // `{label, onClick}`; we (re)wire on every call so handlers don't
  // accumulate across errors. Hidden when no action passed.
  const actionBtn = document.getElementById("errorAction");
  if (actionBtn) {
    const fresh = actionBtn.cloneNode(false);
    actionBtn.parentNode.replaceChild(fresh, actionBtn);
    if (action && action.label && typeof action.onClick === "function") {
      fresh.textContent = action.label;
      fresh.hidden = false;
      fresh.addEventListener("click", () => {
        errorBanner.classList.remove("visible");
        action.onClick();
      });
    } else {
      fresh.hidden = true;
      fresh.textContent = "";
    }
  }
  setTimeout(() => errorBanner.classList.remove("visible"), 10000);
  if (variant && EMPTY_STATE_VARIANTS[variant]) {
    setEmptyStateVariant(variant);
  }
}

function checkStatus() {
  // v1.7: rehydrate global sensitivity regardless of session state —
  // the segmented control reads correctly on first paint even if no
  // session is live yet.
  rehydrateFeedActions(null);
  // v1.9: rehydrate backend mode + subscription key from storage so the
  // Backend & keys drawer reflects state on first open.
  rehydrateBackendMode();
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
      // v1.7: rehydrate vote/pin state for THIS session so a side-panel
      // close+reopen mid-session preserves the user's upvotes and pin.
      rehydrateFeedActions(sessionId);
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
    el.dataset.packId = currentPackId;
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
      <span class="persona-fire-count" id="fire-count-${p.id}" aria-label="fire count this session" data-count="0" hidden>0</span>
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
  // Fresh row of bubbles = fresh counts. Repaints the chips with the
  // current session values (empty on a rebuild-during-session would
  // hide them all, which is the intent).
  repaintPersonaFireCounts();
}

/**
 * Bump a persona's fire-count by one and repaint the row. Called from
 * the `persona_done` SSE handler on every non-empty response. Muted
 * personas are intentionally not counted — a mute means the user opted
 * out of that voice, so displaying a growing count would be confusing
 * UX. (Matches the same `if (mutedPersonas.has(pid))` early-return that
 * already gates the feed entry.)
 */
function incrementPersonaFireCount(personaId) {
  const next = (personaFireCounts.get(personaId) ?? 0) + 1;
  personaFireCounts.set(personaId, next);
  repaintPersonaFireCounts();
}

/** Zero every persona's count. Called at session start. */
function resetPersonaFireCounts() {
  personaFireCounts.clear();
  repaintPersonaFireCounts();
}

/**
 * Paint every persona mug's chip from the current `personaFireCounts`
 * state. Pure read-and-reflect — no DOM walking beyond each bubble's
 * own chip. Also recomputes which persona has the top count and adds
 * a `.top-talker` class to that bubble so CSS can surface it as an
 * accent ring. Ties → nobody is top; the UI intentionally avoids
 * flicker when two personas are neck-and-neck.
 */
function repaintPersonaFireCounts() {
  // Figure out who's on top (strict max; ties produce no winner).
  let topCount = 0;
  let topId = null;
  let tied = false;
  for (const [id, count] of personaFireCounts) {
    if (count > topCount) {
      topCount = count;
      topId = id;
      tied = false;
    } else if (count === topCount && count > 0) {
      tied = true;
    }
  }
  for (const p of PERSONAS) {
    const bubble = document.getElementById(`bubble-${p.id}`);
    const chip = document.getElementById(`fire-count-${p.id}`);
    if (!bubble || !chip) continue;
    const count = personaFireCounts.get(p.id) ?? 0;
    chip.textContent = String(count);
    chip.dataset.count = String(count);
    chip.hidden = count === 0;
    const isTop =
      !tied && topId === p.id && topCount > 0 && !mutedPersonas.has(p.id);
    bubble.classList.toggle("top-talker", isTop);
  }
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

// Per-persona earcon cache. Keyed by `${packId}-${personaId}` to match
// the filenames produced by scripts/synth-persona-cues.ts. HTMLAudioElement
// is cheap to rebuild on each play, but keeping one around per cue avoids
// re-decoding the WAV every fire — and crucially lets us re-trigger
// back-to-back by setting currentTime = 0 instead of allocating.
const personaCueCache = {};
let lastSpeakingId = null;
function playPersonaCue(personaId) {
  if (!personaId) return;
  if (muteSfxToggle && muteSfxToggle.checked) return;
  const key = `${currentPackId}-${personaId}`;
  let audio = personaCueCache[key];
  if (!audio) {
    try {
      audio = new Audio(chrome.runtime.getURL(`sounds/personas/${key}.wav`));
      // The WAVs are already RMS-normalized at synth time (-29 dBFS) to
      // sit under content audio. Volume is a user-side safety knob only.
      audio.volume = 0.67;
      audio.preload = "auto";
      personaCueCache[key] = audio;
    } catch {
      return;
    }
  }
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

function updatePersonaSpeaking(activeId) {
  // Earcon only on transition into a new speaker (null→id, or id→other-id).
  // id→id (redundant update) and id→null (stop) don't fire. Prevents double
  // hits when the render loop repaints the same speaker mid-utterance.
  if (activeId && activeId !== lastSpeakingId) playPersonaCue(activeId);
  lastSpeakingId = activeId;
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
    // Trigger the SMIL azimuth animation on the specular light when speaking
    // starts / stops. The <animate begin="indefinite"> element lives inside
    // feSpecularLighting > feDistantLight in the peanutDepth filter; calling
    // beginElement() slides the highlight from 120° → 150° on a 4s loop so
    // the specular travels visibly across the shell while the mascot talks.
    const mascotSvg = bubble?.querySelector(".mascot svg");
    const azAnim = mascotSvg?.querySelector("feSpecularLighting feDistantLight animate");
    if (azAnim) {
      if (speaking) azAnim.beginElement();
      else azAnim.endElement();
    }
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
// v1.7: per-session stats accumulator — fires the Director has emitted
// since the session started. Feeds the debug panel's stats header so Seth
// can eyeball v3 health (SILENT rate, LLM override rate, callback usage)
// without exporting the JSONL. Reset on showIdle.
const sessionStats = {
  totalDecisions: 0,
  silentPicks: 0,
  llmOverrides: 0,
  ruleFallbacks: 0,
  callbackUses: 0,
  perPersonaFires: { producer: 0, troll: 0, soundfx: 0, joker: 0 },
};

function resetSessionStats() {
  sessionStats.totalDecisions = 0;
  sessionStats.silentPicks = 0;
  sessionStats.llmOverrides = 0;
  sessionStats.ruleFallbacks = 0;
  sessionStats.callbackUses = 0;
  sessionStats.perPersonaFires = { producer: 0, troll: 0, soundfx: 0, joker: 0 };
  renderSessionStats();
}

function updateSessionStats(decision) {
  if (!decision) return;
  sessionStats.totalDecisions++;
  const source = decision.source ?? "rule";
  if (source === "silent-llm") sessionStats.silentPicks++;
  else if (source === "llm") sessionStats.llmOverrides++;
  else sessionStats.ruleFallbacks++;
  if (decision.callbackUsed) sessionStats.callbackUses++;
  const chain = Array.isArray(decision.chain) ? decision.chain : [];
  for (const pid of chain) {
    if (pid in sessionStats.perPersonaFires) {
      sessionStats.perPersonaFires[pid]++;
    }
  }
  renderSessionStats();
}

function pct(n, d) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function renderSessionStats() {
  const el = document.getElementById("traceStats");
  if (!el) return;
  const s = sessionStats;
  if (s.totalDecisions === 0) {
    el.innerHTML = "";
    return;
  }
  const fires = s.perPersonaFires;
  el.innerHTML =
    `<div class="trace-stat-row">` +
    `<span class="trace-stat"><b>${s.totalDecisions}</b> ticks</span>` +
    `<span class="trace-stat src-rule">rule <b>${s.ruleFallbacks}</b></span>` +
    `<span class="trace-stat src-llm">llm <b>${s.llmOverrides}</b></span>` +
    `<span class="trace-stat src-silent-llm">silent <b>${s.silentPicks}</b> · ${pct(s.silentPicks, s.totalDecisions)}</span>` +
    `<span class="trace-stat">↺ <b>${s.callbackUses}</b></span>` +
    `</div>` +
    `<div class="trace-stat-row trace-stat-fires">` +
    `<span>fires:</span>` +
    `<span>p <b>${fires.producer}</b></span>` +
    `<span>t <b>${fires.troll}</b></span>` +
    `<span>s <b>${fires.soundfx}</b></span>` +
    `<span>j <b>${fires.joker}</b></span>` +
    `</div>`;
}

// v1.7: hover tooltip on feed entries — shows the Director's reason +
// source badge + callback phrase (if any). Fed by the most-recent
// director_decision whose chain includes this personaId. Cleared each
// tick when a new decision arrives. Missing values are tolerated — a
// feed entry with no matching decision gets a generic tooltip.
const lastDecisionForPersona = new Map();

function recordDecisionForFeed(decision) {
  if (!decision) return;
  const chain = Array.isArray(decision.chain) ? decision.chain : [];
  for (const pid of chain) {
    lastDecisionForPersona.set(pid, decision);
    // v1.7 quote-card groundwork: stash the transcript tail that informed
    // this decision so addFeedEntry can attach it to the feed entry when
    // the persona's reaction lands. Bounded server-side to ~500 chars;
    // missing field (old backend) = empty string, quote card handles it.
    if (typeof decision.transcript === "string") {
      lastTranscriptForPersona.set(pid, decision.transcript);
    }
  }
}

function tooltipForPersonaFire(personaId) {
  const d = lastDecisionForPersona.get(personaId);
  if (!d) return "";
  const bits = [];
  if (d.reason) bits.push(d.reason);
  const src = typeof d.source === "string" ? d.source : "rule";
  bits.push(
    src === "llm" ? "[LLM route]" : src === "silent-llm" ? "[SILENT route]" : "[rule route]"
  );
  if (d.callbackUsed && typeof d.callbackUsed === "string") {
    bits.push(`↺ heightens: "${d.callbackUsed.slice(0, 80)}"`);
  }
  return bits.join("  ·  ");
}

function addFeedEntry(personaId, text) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) return;
  if (mutedPersonas.has(personaId)) return;

  // Flash the transcript bar in this persona's color — visual link
  // between "what the video just said" and "which persona reacted."
  pulseTranscriptFor(p);

  const role = roleForSlot(personaId);
  const id = `${personaId}-${messageCount++}`;
  const now = Date.now();
  // v1.7: attach the transcript tail the Director saw when it picked this
  // persona — used by the quote-card renderer so the "quote" half of the
  // card matches what the model actually reacted to.
  const transcript = lastTranscriptForPersona.get(personaId) || "";
  feedEntries.push({ id, personaId, role, text, timestamp: now, transcript });

  const tooltip = tooltipForPersonaFire(personaId);
  const el = document.createElement("div");
  el.className = `feed-entry ${role}`;
  el.id = `feed-${id}`;
  el.dataset.role = role;
  el.dataset.entryId = id;
  if (tooltip) el.title = tooltip;
  el.innerHTML = `
    <span class="ts">${escapeHtml(formatTime(now))}</span>
    <span class="tag">${escapeHtml(role.toUpperCase())}</span>
    <span class="msg"><span class="nm">${escapeHtml(p.name)}</span> ${escapeHtml(text)}</span>
  `;
  // v1.7: the whole entry is tap-target — opens the feed-action popover
  // (quote card / pin / upvote / downvote). Handler delegates to the
  // shared showFeedMenu() so we don't retain per-entry closures.
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showFeedMenu(id, el);
  });

  gallery.appendChild(el);
  gallery.scrollTop = gallery.scrollHeight;

  // v2.0 session-recall groundwork: persist the reaction alongside the
  // Director's rationale for this persona (if any). Fire-and-forget —
  // a storage failure has no user-visible consequence.
  if (self.PGSessionStore && sessionId) {
    const decision = lastDecisionForPersona.get(personaId);
    self.PGSessionStore.appendReaction(sessionId, {
      id,
      personaId,
      role,
      text,
      timestamp: now,
      source: decision?.source ?? null,
      reason: decision?.reason ?? null,
      callbackUsed: decision?.callbackUsed ?? null,
    }).catch(() => {});
  }
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
        // v2.0 session-recall: snapshot the running transcript tail to
        // storage. updateTranscript() debounces at 15s cadence internally,
        // so this is safe to call on every final chunk.
        if (self.PGSessionStore && sessionId) {
          self.PGSessionStore.updateTranscript(sessionId, transcriptFinal).catch(() => {});
        }
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
        incrementPersonaFireCount(pid);
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
      // v1.7: remember the decision per persona in the chain so the feed's
      // hover tooltip can surface the Director's rationale + source + any
      // callback heightening when the persona's line lands. Empty chain
      // (SILENT) deliberately writes nothing — no feed entry will follow.
      recordDecisionForFeed(data);
      // v1.7: refresh session stats if the debug panel is open (cheap when
      // closed — updateSessionStats short-circuits).
      updateSessionStats(data);
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
        // v2.0 session-recall groundwork: create a persistent session
        // record so the "Past sessions" feature (roadmap v2.0) has data
        // when the UI lands. Fires-and-forgets; silent on storage errors.
        if (self.PGSessionStore) {
          self.PGSessionStore.createSession({
            sessionId,
            packId: sessionPackId || currentPackId || null,
            url: capturedTabInfo?.url || "",
            title: capturedTabInfo?.title || "",
            startedAt: Date.now(),
          }).catch(() => {});
        }
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
      if (data.status === "silence_timeout") {
        showError("Paused — no audio detected for 60 seconds. Press play to resume.", "idle");
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

// ── Transcript pulse on persona fire ──
// When a persona produces a visible response we briefly flash the
// transcript bar in that persona's accent color + show a tiny persona
// name caption in the top-right corner. Visual link between the line
// the video just said and the persona reacting to it.
//
// Uses a single class + CSS custom properties so back-to-back fires
// don't stack timeouts: each call clears the in-flight timer, re-sets
// the class, and schedules a new teardown. A cascade round of 4
// reactions over 8s produces 4 discrete pulses that read as one
// "conversation" not a stuttering strobe.
let _transcriptPulseTimer = null;
function pulseTranscriptFor(persona) {
  if (!transcriptSection || !persona) return;
  const color = persona.color || "var(--stamp)";
  const label = persona.name || "";
  // Inline-style the CSS vars so each persona's color flows through
  // the ::after caption + inset ring without a per-persona class.
  transcriptSection.style.setProperty("--pulse-color", color);
  transcriptSection.dataset.pulseLabel = label;
  transcriptSection.classList.add("pulsing");
  if (_transcriptPulseTimer) clearTimeout(_transcriptPulseTimer);
  _transcriptPulseTimer = setTimeout(() => {
    transcriptSection.classList.remove("pulsing");
    _transcriptPulseTimer = null;
  }, 1200);
}

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
  // Plus mode requires a license key. The user might have selected Plus but
  // never completed checkout — surface an error with a CTA to open the
  // settings drawer (don't auto-navigate; the error needs to stay visible).
  if (backendMode === "plus" && !subscriptionKeyInput?.value.trim()) {
    showError(
      "Plus mode needs a subscription key. Subscribe to get one, or switch to Demo / My keys.",
      "needs-keys",
      {
        label: "Open settings",
        onClick: () => {
          openSettingsDrawer();
          showDrawerSection("backend");
        },
      }
    );
    return;
  }

  // Gate key-presence on the *selected mode*, not the URL. A user in
  // "byok" mode pointed at the default hosted URL must still supply
  // keys — otherwise the hosted server silently uses its demo keys and
  // the user thinks they're on their own quota. Only "demo" mode
  // intentionally runs without user keys; "plus" is already gated above.
  if (backendMode === "byok" || backendMode === "selfhost") {
    const missing = [];
    if (!deepgramKeyInput.value.trim()) missing.push("Deepgram");
    if (!anthropicKeyInput.value.trim()) missing.push("Anthropic");
    if (xaiKeyInput && !xaiKeyInput.value.trim()) missing.push("xAI");
    // v2.0.1: Brave deprecated. Fact-check traffic always piggybacks on
    // the xAI key (Grok Live Search).
    if (missing.length > 0) {
      showError(
        `This mode needs your own API key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Free keys are linked in Settings, or switch to Demo.`,
        "needs-keys",
        {
          label: "Open settings",
          onClick: () => {
            openSettingsDrawer();
            showDrawerSection("backend");
          },
        }
      );
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
        // Only forward user-entered provider keys in "My keys" / Self-host.
        // Demo and Plus run on the server's Railway keys — sending any
        // X-*-Key header would cause the backend to prefer the user value
        // and bypass the hosted credential. Stored values in the inputs
        // (from a prior BYOK session) must NOT leak through those modes.
        apiKeys: effectiveBackendMode() === "byok"
          ? {
              deepgram: deepgramKeyInput.value.trim(),
              anthropic: anthropicKeyInput.value.trim(),
              xai: xaiKeyInput ? xaiKeyInput.value.trim() : "",
            }
          : { deepgram: "", anthropic: "", xai: "" },
        audio: {
          passthrough: passthroughToggle.checked,
          outputDeviceId: currentOutputDeviceId(),
        },
        // User-chosen pace dial (1-10). Forwarded through
        // background → offscreen → /api/transcribe, where it becomes the
        // session's paceMultiplier. Changing this mid-session has no
        // effect — it's captured at Start Listening time.
        rate: currentResponseRate(),
        // v1.7: global sensitivity ("quiet" | "normal" | "rowdy"). Forwarded
        // as X-Sensitivity header. Scales cascade probability on the
        // Director so the whole panel feels quieter or rowdier. Changing
        // mid-session has no effect; captured at Start Listening time.
        sensitivity: sensitivityValue,
        // v1.9: the effective backend mode for this session ("demo" |
        // "byok" | "plus"). Plus sends X-Subscription-Key; demo falls
        // back on free-tier metering; byok sends the user's keys and
        // skips both gates. The effective mode collapses "plus + use
        // with my keys" into "byok" so subscription hours aren't
        // charged when the user picked their own keys for the session.
        backendMode: effectiveBackendMode(),
        subscriptionKey: subscriptionKeyInput?.value.trim() || "",
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
    // Special-case the hosted-backend quota errors so the user lands on
    // the drawer with a clear path forward instead of a raw banner:
    //   - TRIAL_EXHAUSTED        → free-tier ran out, needs API keys
    //   - INSTALL_ID_REQUIRED    → rare missing-header case, same recovery
    //   - SUBSCRIPTION_CAP_REACHED → Plus user hit weekly 16 h cap, can
    //                               swap to BYOK keys or wait for reset
    //   - SUBSCRIPTION_INVALID_KEY → Plus key not recognized on backend,
    //                               same keys-required recovery
    //   - SUBSCRIPTION_DISABLED  → backend doesn't have Plus turned on,
    //                               same keys-required recovery
    // Offscreen prefixes the message with "<CODE>:" — strip it before display.
    const rawMsg = err.message || String(err);
    if (rawMsg.startsWith("TRIAL_EXHAUSTED:") || rawMsg.startsWith("INSTALL_ID_REQUIRED:")) {
      const cleaned = rawMsg.replace(/^[A-Z_]+:/, "");
      // Flip the status strip to CAP REACHED so the free-tier user sees the
      // state even before they act on the drawer prompt.
      if (statusBar.classList.contains("with-timer")) flipToCapReached();
      openSettingsDrawer();
      showDrawerSection("backend");
      showError(cleaned, "needs-keys");
    } else if (rawMsg.startsWith("SUBSCRIPTION_CAP_REACHED:")) {
      const cleaned = rawMsg.replace(/^[A-Z_]+:/, "");
      // Flip the status strip to CAP REACHED so a Plus user sees the
      // state before they open the drawer.
      if (statusBar.classList.contains("with-timer")) flipToCapReached();
      openSettingsDrawer();
      showDrawerSection("backend");
      showError(cleaned, "cap-reached-plus");
    } else if (
      rawMsg.startsWith("SUBSCRIPTION_INVALID_KEY:") ||
      rawMsg.startsWith("SUBSCRIPTION_DISABLED:")
    ) {
      const cleaned = rawMsg.replace(/^[A-Z_]+:/, "");
      // Key invalid or backend doesn't have Plus enabled — same recovery
      // shape as the trial-exhausted path (paste own keys, or go to
      // Manage to replace the key).
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

/**
 * Feed-entry menu → "Regenerate this take".
 *
 * Re-fires the SAME persona slot that produced this entry, using the
 * existing `fire_persona` PATCH action that avatar-taps already use. No
 * new backend code — the re-fire goes through the Director's tap path,
 * which bypasses the cascade scorer and commits to producing visible
 * output (same as a manual avatar tap).
 *
 * The new response is APPENDED to the feed as a normal persona entry,
 * not a replacement in place — that's consistent with every other
 * cascade tick and avoids a flickery in-place rewrite UX. Users who
 * want the old take out of the way can downvote or skip it with the
 * already-shipping menu; the regenerate action is about getting a
 * better next one, not rewriting history.
 *
 * No-op when no active session, no sessionId, or the persona slot
 * isn't recognized (e.g. stale entryId from a previous session).
 */
function regenerateEntry(entryId) {
  if (!sessionId) return;
  const entry = feedEntries.find((e) => e.id === entryId);
  if (!entry) return;
  // Route through the same tap-fire path avatar clicks use.
  firePersona(entry.personaId);
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
if (muteSfxToggle) {
  muteSfxToggle.addEventListener("change", () => {
    saveSettings();
  });
}

// Response rate: persist on change so it sticks across panel re-opens.
// Intentionally NOT pushed to a running session — changing cadence
// mid-conversation would be jarring and would require the server to
// re-thread the dial through the live transcriber, which isn't worth
// the complexity. The hint text in the HTML tells users "takes effect
// on your next Start Listening".
if (responseRateSelect) {
  // Slider fires `input` continuously (every drag step) and `change` once on
  // release. Sync aria-valuenow live for screen readers; persist on release
  // so we don't pummel chrome.storage on every pointer move.
  responseRateSelect.addEventListener("input", () => {
    responseRateSelect.setAttribute("aria-valuenow", responseRateSelect.value);
  });
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

// Save settings on input change. Skip any element that isn't present
// (older sidepanel.html before xai shipped would return null for xAI).
[
  serverUrlInput,
  deepgramKeyInput,
  anthropicKeyInput,
  xaiKeyInput,
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

// Drawer → Privacy → Share-feedback toggle. Checkbox semantics match the
// label ("Share feedback with the project"): checked = share. State
// variable `feedbackOptOut` is the INVERSE (true = opt out) because the
// feedback poster's early-return reads naturally as "if (feedbackOptOut)
// return". Persist the opt-out flag; the backend never sees whether this
// toggle is on — sendFeedback() short-circuits client-side when opted out,
// so the network never fires in the first place.
if (feedbackOptOutToggle) {
  feedbackOptOutToggle.addEventListener("change", () => {
    feedbackOptOut = !feedbackOptOutToggle.checked;
    chrome.storage.local
      .set({ pgFeedbackOptOut: feedbackOptOut })
      .catch(() => {});
  });
}

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
const tutorialActionsDefault = document.getElementById("tutorialActionsDefault");
const tutorialCtaGrid = document.getElementById("tutorialCtaGrid");
const tutorialTryNowBtn = document.getElementById("tutorialTryNowBtn");
const tutorialGetKeysBtn = document.getElementById("tutorialGetKeysBtn");
const tutorialPlusBtn = document.getElementById("tutorialPlusBtn");
const tutorialWalkthroughHost = document.getElementById("tutorialWalkthroughHost");
const replayTutorialBtn = document.getElementById("replayTutorialBtn");

// Steps are declarative. `targetSelector` names the element to spotlight;
// `onEnter` performs any drawer navigation required so the target is on
// screen. Keep the list short — Seth's cap is ~4 so the tour never feels
// like onboarding bloat.
const TUTORIAL_STEPS = [
  {
    targetSelector: "#settingsToggleTop",
    title: "Welcome to the gallery",
    body: "Quick tour — three drawer stops, one feed interaction, and a last card where you pick how to run the thing. Six stops.",
    onEnter: () => {
      // Don't auto-open yet — let the user see the gear being highlighted
      // first, then advance opens the drawer.
      if (settingsDrawer?.classList.contains("visible")) closeSettingsDrawer();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="lineup"]',
    title: "Lineup",
    body: "One home for every critic knob. Pick your pack (Howard or TWiST), dial cadence (1 = occasional, 10 = nonstop), set Room volume (Quieter / Normal / Rowdy) for how often the critics chain into each other, and mute anyone wearing you out.",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="backend"]',
    title: "Backend & keys",
    body: "Four ways to use Peanut Gallery — pick one here. Demo is a one-off 15-min free trial. Peanut Gallery Plus is $8/mo for 16 h/week on the hosted backend. My keys (BYOK) is free forever with your own Deepgram / Anthropic / xAI keys. Self-host points at your own backend URL.",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
  {
    targetSelector: '.drawer-menu-item[data-section="audio"]',
    title: "Audio",
    body: "Passthrough plays captured tab audio back through your speakers so you hear the video normally. Turn it off only when your recording software is already routing the tab (OBS, Loopback, BlackHole).",
    onEnter: () => {
      if (!settingsDrawer?.classList.contains("visible")) openSettingsDrawer();
      showDrawerMenu();
    },
  },
  {
    // Mid-journey tip: the tap-a-response interaction in the feed. No
    // specific element to spotlight — there may be no feed entries on
    // a first run, so we skip the target and let the card speak on its
    // own. The closing line names the remaining drawer tiles (Export,
    // Appearance, Privacy, Feedback & bugs) so the tour doesn't need
    // dedicated steps for them.
    targetSelector: null,
    title: "Tap a response",
    body: "During a session, tap any critic's line to pin it, upvote/downvote it, delete it, or grab a shareable quote card. The remaining drawer tiles — Export (.md), Appearance (Paper/Night, replay this tour), Privacy, and Feedback & bugs — cover themselves.",
    onEnter: () => {
      // Close the drawer so the next card doesn't hide behind it.
      if (settingsDrawer?.classList.contains("visible")) closeSettingsDrawer();
    },
  },
  {
    // v2.0.1 terminal step — dual-CTA fork. "Try now" drops into the
    // empty state so the user can Start Listening on demo keys; "Get
    // my own keys" launches the KEY_WALKTHROUGH sequence for guided
    // per-provider setup.
    targetSelector: null,
    final: true,
    title: "Ready to roll?",
    body: "Demo gives you 15 minutes on our shared keys — handy for trying Peanut Gallery right now. For unlimited use, bring your own API keys. We'll walk you through signing up at each provider if you want.",
    onEnter: () => {
      // Ensure the drawer isn't hiding the terminal card.
      if (settingsDrawer?.classList.contains("visible")) closeSettingsDrawer();
    },
  },
];

// v2.0.1: optional sequential walkthrough triggered by the terminal
// "Get my own keys" CTA. Each step spotlights one provider panel in
// the wizard; the user is expected to tap the provider's signup link
// in the spotlighted step, paste the key inside the wizard, and then
// hit Next in this overlay. Skip advances without a forged value.
//
// Kept in a separate list from TUTORIAL_STEPS so the main tutorial's
// step counter stays honest — the walkthrough relabels the slug to
// "Key N · 4" while active.
const KEY_WALKTHROUGH_STEPS = [
  {
    title: "Deepgram — speech to text",
    stepNum: 1,
  },
  {
    title: "Anthropic — Claude",
    stepNum: 2,
  },
  {
    title: "xAI — Grok",
    stepNum: 3,
  },
];

// Walkthrough DOM parking — remembers the original parent + next
// sibling of each #onboardStepN element so we can move them into the
// tutorial card body while the walkthrough is active and restore
// them on exit. Keyed by step number (1..4); keys present only for
// steps currently in the tutorial card.
const walkthroughParking = {};

// Make sure the settings drawer is in a clean state for the
// walkthrough — we close it so the tutorial card is the only focal
// surface. Also flips backend mode to "byok" so the wizard (and the
// #onboardStepN elements inside it) are actually rendered, which is
// required for moveStepIntoTutorial to find them.
function prepareDrawerForWalkthrough() {
  if (backendMode !== "byok" && backendMode !== "selfhost") {
    setBackendMode("byok");
  }
  const wizard = document.getElementById("onboardWizard");
  const body = document.getElementById("onboardBody");
  const toggle = document.getElementById("onboardToggle");
  if (wizard && body && body.hasAttribute("hidden")) {
    body.removeAttribute("hidden");
    wizard.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
  }
  // Show the Backend section underneath so when the user finishes the
  // walkthrough and the step DOM is restored, they see it in context.
  if (typeof showDrawerSection === "function") showDrawerSection("backend");
  // But keep the drawer itself closed during the walkthrough — the
  // tutorial card is the surface.
  if (settingsDrawer?.classList.contains("visible")) closeSettingsDrawer();
}

function moveStepIntoTutorial(stepNum) {
  const stepEl = document.getElementById(`onboardStep${stepNum}`);
  if (!stepEl || !tutorialWalkthroughHost) return;
  // Skip if already parked (defensive — shouldn't happen if we always
  // restore before move, but guards against double-entry).
  if (walkthroughParking[stepNum]) return;
  walkthroughParking[stepNum] = {
    parent: stepEl.parentNode,
    nextSibling: stepEl.nextSibling,
  };
  tutorialWalkthroughHost.appendChild(stepEl);
  tutorialWalkthroughHost.removeAttribute("hidden");
}

function restoreStep(stepNum) {
  const info = walkthroughParking[stepNum];
  if (!info) return;
  const stepEl = document.getElementById(`onboardStep${stepNum}`);
  if (!stepEl) {
    delete walkthroughParking[stepNum];
    return;
  }
  if (info.nextSibling && info.nextSibling.parentNode === info.parent) {
    info.parent.insertBefore(stepEl, info.nextSibling);
  } else if (info.parent) {
    info.parent.appendChild(stepEl);
  }
  delete walkthroughParking[stepNum];
}

function restoreAllWalkthroughSteps() {
  for (const n of Object.keys(walkthroughParking)) {
    restoreStep(Number(n));
  }
  if (tutorialWalkthroughHost) {
    tutorialWalkthroughHost.setAttribute("hidden", "");
  }
}

let tutorialIndex = 0;
let tutorialActiveTarget = null;
// v2.0.1: when the user picks "Get my own keys" on the terminal card,
// we switch to the key-walkthrough sequence. The step-counter slug is
// relabeled and the step list is sourced from KEY_WALKTHROUGH_STEPS.
let tutorialMode = "main"; // "main" | "walkthrough"

function activeTutorialSteps() {
  return tutorialMode === "walkthrough" ? KEY_WALKTHROUGH_STEPS : TUTORIAL_STEPS;
}

function clearTutorialTarget() {
  if (tutorialActiveTarget) {
    tutorialActiveTarget.classList.remove("tut-target");
    tutorialActiveTarget = null;
  }
}

function renderTutorialStep(i) {
  const steps = activeTutorialSteps();
  const step = steps[i];
  if (!step) return;
  clearTutorialTarget();
  // Any prior walkthrough-step injection is torn down before a new
  // step renders so we don't leave orphaned DOM in the card if the
  // user jumps around (Skip, Escape, etc.).
  restoreAllWalkthroughSteps();

  if (tutorialMode === "walkthrough") {
    // Walkthrough: the card becomes the wizard step. Prepare the drawer
    // state so the #onboardStepN element is rendered (visibility is
    // driven by backendMode + wizard expand), then move it into the
    // tutorial body host.
    prepareDrawerForWalkthrough();
    tutorialStepEl.textContent = `Key ${i + 1} · ${steps.length}`;
    tutorialTitleEl.textContent = step.title;
    // Hide the default body paragraph — the walkthrough host below it
    // carries the wizard step content instead.
    tutorialBodyEl.textContent = "";
    tutorialBodyEl.setAttribute("hidden", "");
    moveStepIntoTutorial(step.stepNum);
  } else {
    // Regular tutorial step.
    if (typeof step.onEnter === "function") step.onEnter();
    tutorialStepEl.textContent = `Step ${i + 1} · ${steps.length}`;
    tutorialTitleEl.textContent = step.title;
    tutorialBodyEl.textContent = step.body;
    tutorialBodyEl.removeAttribute("hidden");
  }

  // Action row state.
  // - final main-tutorial step: hide default row (no Skip, no Next),
  //   show CTA grid (Try now / Get my own keys / Plus).
  // - walkthrough last step: default row, Next labeled "Finish".
  // - everywhere else: default row, Next labeled "Next ›".
  // "Done" never appears as a button label per Seth's spec.
  const showCtaGrid = step.final === true;
  if (tutorialActionsDefault && tutorialCtaGrid) {
    if (showCtaGrid) {
      tutorialActionsDefault.setAttribute("hidden", "");
      tutorialCtaGrid.removeAttribute("hidden");
    } else {
      tutorialActionsDefault.removeAttribute("hidden");
      tutorialCtaGrid.setAttribute("hidden", "");
    }
  }
  if (!showCtaGrid && tutorialNextBtn) {
    const isLastWalkthrough = tutorialMode === "walkthrough" && i === steps.length - 1;
    tutorialNextBtn.textContent = isLastWalkthrough ? "Finish" : "Next ›";
  }
  // Explicit Skip-button guard for the final CTA card. The whole
  // #tutorialActionsDefault row is hidden above, which should be
  // enough — but belt-and-suspenders so no future CSS specificity
  // tweak can accidentally re-expose Skip on the final page.
  if (tutorialSkipBtn) {
    if (showCtaGrid) tutorialSkipBtn.setAttribute("hidden", "");
    else tutorialSkipBtn.removeAttribute("hidden");
  }

  // Spotlight (only for regular steps — walkthrough content is inside
  // the card itself so no DOM target is needed).
  if (tutorialMode === "walkthrough") return;
  requestAnimationFrame(() => {
    if (!step.targetSelector) return;
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
  tutorialMode = "main";
  tutorialIndex = 0;
  tutorialOverlay.classList.add("visible");
  tutorialOverlay.setAttribute("aria-hidden", "false");
  renderTutorialStep(0);
}

function startKeyWalkthrough() {
  if (!tutorialOverlay) return;
  tutorialMode = "walkthrough";
  tutorialIndex = 0;
  tutorialOverlay.classList.add("visible");
  tutorialOverlay.setAttribute("aria-hidden", "false");
  renderTutorialStep(0);
}

function advanceTutorial() {
  const steps = activeTutorialSteps();
  if (tutorialIndex >= steps.length - 1) {
    endTutorial(true);
    return;
  }
  tutorialIndex += 1;
  renderTutorialStep(tutorialIndex);
}

// Skip jumps to the final (dual/triple-CTA) card of the main tutorial
// rather than closing the overlay. If invoked from inside the
// walkthrough, it drops the walkthrough mode and lands on the same
// CTA page so the user can restart or pick a different path.
function skipToFinal() {
  tutorialMode = "main";
  const finalIdx = TUTORIAL_STEPS.findIndex((s) => s.final === true);
  tutorialIndex = finalIdx >= 0 ? finalIdx : TUTORIAL_STEPS.length - 1;
  renderTutorialStep(tutorialIndex);
}

function endTutorial(completed) {
  clearTutorialTarget();
  // Always restore any parked wizard-step DOM before closing — even
  // on Escape or a rage-skip — so the Backend & keys drawer isn't
  // left with holes where step elements used to be.
  restoreAllWalkthroughSteps();
  // Put the default tutorial body back in the renderable state for
  // the next time the user replays the tour.
  if (tutorialBodyEl) tutorialBodyEl.removeAttribute("hidden");
  if (!tutorialOverlay) return;
  tutorialOverlay.classList.remove("visible");
  tutorialOverlay.setAttribute("aria-hidden", "true");
  // Persist only the flag so we don't race with loadSettings on the key
  // inputs. Same single-field-write pattern used by applyTheme + toggleMute.
  chrome.storage.local.set({ tutorialSeen: true });
  // If the tour opened the drawer, leave it on the menu view so the
  // user isn't dropped into a random submenu.
  if (completed && settingsDrawer?.classList.contains("visible")) {
    showDrawerMenu();
  }
  tutorialMode = "main";
}

if (tutorialNextBtn) tutorialNextBtn.addEventListener("click", advanceTutorial);
// Skip jumps to the final CTA card instead of closing the tour. Per
// Seth's spec in v2.0.1 — closing is reserved for Escape / Try now /
// completing a walkthrough.
if (tutorialSkipBtn) tutorialSkipBtn.addEventListener("click", skipToFinal);

// Terminal CTA wiring. "Try now" ends the tour and drops the user
// back on the main panel so they can hit Start Listening on demo
// keys. "Get my own keys" switches the overlay into walkthrough mode
// where each wizard step is injected into this same card. "Peanut
// Gallery Plus" fires the shared "Coming soon" modal — same one the
// Backend & keys drawer's Plus tab uses.
if (tutorialTryNowBtn) {
  tutorialTryNowBtn.addEventListener("click", () => endTutorial(true));
}
if (tutorialGetKeysBtn) {
  tutorialGetKeysBtn.addEventListener("click", startKeyWalkthrough);
}
if (tutorialPlusBtn) {
  tutorialPlusBtn.addEventListener("click", () => {
    // Don't close the tutorial — Seth wants the Plus modal stacked on
    // top of the CTA page so users can back out and pick another path.
    openPlusComingSoonModal();
  });
}

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
if (versionBadgeEl) {
  try {
    const { version } = chrome.runtime.getManifest();
    if (version) versionBadgeEl.textContent = `v${version}`;
  } catch {
    // getManifest() only fails outside the extension context (tests, browser
    // preview). Leave the badge empty in that case — better than a stale string.
  }
}

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
    // v1.7: data-source lets the filter chips hide rows by source class
    // via CSS alone. Canonicalize same way the badge does (unknown → rule).
    const rowSourceRaw = typeof d?.source === "string" ? d.source : "rule";
    const rowSource =
      rowSourceRaw === "llm"
        ? "llm"
        : rowSourceRaw === "silent-llm"
        ? "silent-llm"
        : "rule";
    row.dataset.source = rowSource;

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

    // v1.5 / v1.7: routing-source badge. Backend sends
    // source = "rule" | "llm" | "silent-llm" on every director_decision.
    // Older backends omit the field so we default to "rule" (matches the
    // effective behavior when ENABLE_SMART_DIRECTOR is off). Normalize
    // unknown values back to "rule" so a malformed payload never paints a
    // false-positive LLM badge.
    const rawSource = typeof d?.source === "string" ? d.source : "rule";
    const source =
      rawSource === "llm"
        ? "llm"
        : rawSource === "silent-llm"
        ? "silent-llm"
        : "rule";
    const sourceClass =
      source === "llm"
        ? "src-llm"
        : source === "silent-llm"
        ? "src-silent-llm"
        : "src-rule";
    const sourceLabel =
      source === "llm" ? "LLM" : source === "silent-llm" ? "SILENT" : "RULE";

    // v1.7: when the router picked SILENT, the pick slot is null. Render an
    // italic em-dash in stamp color so it reads as "intentionally quiet" —
    // not a missing value. Persona picks keep their pack color.
    const isSilent = source === "silent-llm" || pick == null;
    const pickDisplay = isSilent ? "— silent —" : pick;
    const pickClass = isSilent
      ? "trace-pick trace-pick-silent"
      : "trace-pick";
    const pickColor = isSilent ? "" : `style="color:${color}"`;

    // Line 1: pick · score · top3 · cascadeLen · source
    const line1 = document.createElement("div");
    line1.className = "trace-line1";
    line1.innerHTML =
      `<span class="${pickClass}" ${pickColor}>${escapeHtml(pickDisplay)}</span>` +
      ` <span class="trace-score">${escapeHtml(String(score))}</span>` +
      (top3Str ? ` <span class="trace-top3">(${escapeHtml(top3Str)})</span>` : "") +
      ` <span class="trace-cascade">×${cascadeLen}${d?.isSilence ? " · silence" : ""}${d?.isForceReact ? " · force" : ""}</span>` +
      ` <span class="trace-source ${sourceClass}">${sourceLabel}</span>`;
    row.appendChild(line1);

    // Line 2: chain, e.g. "troll → joker → producer". Silent picks have an
    // empty chain — skip the line rather than render an empty row.
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

    // v1.7: callback line — the router decided to heighten a phrase from
    // the Director's live-callback ring. Truncated to 120 chars so a runaway
    // monologue entry doesn't stretch the trace panel.
    if (d?.callbackUsed && typeof d.callbackUsed === "string") {
      const cbLine = document.createElement("div");
      cbLine.className = "trace-line-callback";
      const text = d.callbackUsed.slice(0, 120);
      cbLine.textContent = `"${text}${d.callbackUsed.length > 120 ? "…" : ""}"`;
      row.appendChild(cbLine);
    }

    // v1.7: confidence vector — compact "p:0.12 t:0.45 s:0.08 j:0.30 ·:0.05".
    // Only rendered when the v3 router fired AND the backend sent the
    // distribution. Debug-panel users can see whether a pick was confident
    // (single high number) or close (multiple mid-range values).
    if (d?.confidence && typeof d.confidence === "object") {
      const c = d.confidence;
      const fmt = (n) =>
        typeof n === "number" ? n.toFixed(2).replace(/^0/, "") : "—";
      const cLine = document.createElement("div");
      cLine.className = "trace-line-confidence";
      cLine.textContent =
        `p:${fmt(c.producer)} t:${fmt(c.troll)} s:${fmt(c.soundfx)} ` +
        `j:${fmt(c.joker)} ·:${fmt(c.silent)}`;
      row.appendChild(cLine);
    }

    frag.appendChild(row);
  }

  traceListEl.innerHTML = "";
  traceListEl.appendChild(frag);
}

function setDebugPanelOpen(open, persist = true) {
  debugPanelOpen = !!open;
  // Mirror to globalThis so updateSelfHostBlockVisibility() — which may
  // run before this module-level `let` is initialized via an earlier
  // setBackendMode() during init — can read the current state safely.
  globalThis.__pgDebugPanelOpen = debugPanelOpen;
  // Reveal/hide the server URL override field on non-selfhost modes in
  // sync with debug-panel state (always visible in selfhost regardless).
  updateSelfHostBlockVisibility();
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

// ──────────────────────────────────────────────────────
// ONBOARDING WIZARD (v2.0.1)
// ──────────────────────────────────────────────────────
//
// Expanded-by-default panel that walks BYOK users through creating
// accounts at each of the 3 providers. The wizard's paste fields ARE
// the canonical BYOK inputs — input ids deepgramKey / anthropicKey /
// xaiKey are referenced directly by the rest of the extension
// (saveSettings, Start Listening, request-building code). No mirroring,
// no second source of truth.
//
// This block is responsible for:
//   1. Collapse/expand toggle (wizard starts expanded in the HTML).
//   2. Per-step "done" checkmark state, derived from the input values
//      — recomputed on every input/change event.
//   3. "Skip for now" buttons — scroll the next step into view.
//   4. "You're set" ribbon — shown when all three providers have values.
//
// TDZ guard: this block uses document.getElementById inline rather
// than forward-referencing module-level consts, per the sidepanel TDZ
// lesson (#106 / #112 — hoisting from later const declarations has
// bit us twice).
(function setupOnboardingWizard() {
  const wizard = document.getElementById("onboardWizard");
  if (!wizard) return;
  const toggle = document.getElementById("onboardToggle");
  const body = document.getElementById("onboardBody");
  const doneEl = document.getElementById("onboardDone");
  if (!toggle || !body) return;

  toggle.addEventListener("click", () => {
    const opening = body.hasAttribute("hidden");
    if (opening) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "");
    wizard.classList.toggle("is-open", opening);
    toggle.setAttribute("aria-expanded", opening ? "true" : "false");
  });

  // Per-step metadata. inputId matches the canonical BYOK input so
  // check-state derives from the same value the rest of the app reads.
  const STEP_INPUTS = [
    { inputId: "deepgramKey", stepId: "onboardStep1", required: true },
    { inputId: "anthropicKey", stepId: "onboardStep2", required: true },
    { inputId: "xaiKey", stepId: "onboardStep3", required: true },
  ];

  function refreshCheckState() {
    let requiredDone = 0;
    let requiredTotal = 0;
    for (const s of STEP_INPUTS) {
      const stepEl = document.getElementById(s.stepId);
      const input = document.getElementById(s.inputId);
      if (!stepEl) continue;
      const filled = !!(input?.value || "").trim();
      stepEl.classList.toggle("is-done", filled);
      if (s.required) {
        requiredTotal += 1;
        if (filled) requiredDone += 1;
      }
    }
    if (doneEl) {
      const allDone = requiredTotal > 0 && requiredDone === requiredTotal;
      if (allDone) doneEl.removeAttribute("hidden");
      else doneEl.setAttribute("hidden", "");
    }
  }

  for (const s of STEP_INPUTS) {
    const input = document.getElementById(s.inputId);
    if (!input) continue;
    input.addEventListener("input", refreshCheckState);
    input.addEventListener("change", refreshCheckState);
  }

  // "Skip for now" scrolls the next step into view — the step stays
  // "undone" (no forged value). Acknowledge intent, don't fabricate
  // credentials.
  for (const btn of wizard.querySelectorAll(".onboard-skip")) {
    btn.addEventListener("click", () => {
      const n = parseInt(btn.dataset.step, 10);
      if (!Number.isFinite(n)) return;
      const next = document.getElementById(`onboardStep${n + 1}`);
      if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Chrome storage pour-in can happen after this block runs. Refresh
  // check-state whenever BYOK keys change in storage so the checkmarks
  // update post-hydration.
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (
        "deepgramKey" in changes ||
        "anthropicKey" in changes ||
        "xaiKey" in changes
      ) {
        setTimeout(refreshCheckState, 0);
      }
    });
  }

  refreshCheckState();
})();
