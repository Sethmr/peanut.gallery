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
// in a 24×24 viewBox. Keeping these synchronized with components/PersonaIcon.tsx
// in the web app; the extension is intentionally standalone (no bundler), so
// the duplication is by design.
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
  freeTierIntervalId = setInterval(() => {
    const elapsed = (Date.now() - freeTierStartMs) / 1000;
    if (!freeTierCapped && elapsed >= FREE_TIER_MAX_SECONDS) {
      flipToCapReached();
      return;
    }
    statusTime.textContent = formatHMS(Math.min(elapsed, FREE_TIER_MAX_SECONDS));
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
const capturedTabBanner = document.getElementById("capturedTabBanner");
const capturedTabTitle = document.getElementById("capturedTabTitle");

// v1.4 masthead + drawer refs. Grabbed defensively — if we're running in
// an older extension context with the previous HTML, these return null
// and every handler below no-ops rather than throwing.
const packBadgeEl = document.getElementById("packBadge");
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
// Footer filter pills — indexed by data-filter. One `All` master plus four
// per-role toggles. Collected once at load; the HTML renders all five.
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
      updatePackBadge();
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
  transcriptSection.style.display = "block";
  gallery.style.display = "flex";
  if (footer) footer.classList.remove("hidden");
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
  // Session over — trace panel should show the dropdown's pre-session
  // selection again. updateTracePackLabel() reflects both states via the
  // .locked class toggle.
  sessionPackId = null;
  updateTracePackLabel();
  setupSection.style.display = "block";
  emptyState.style.display = "flex";
  statusBar.style.display = "none";
  statusBar.classList.remove("with-timer", "capped", "active", "live");
  stopFreeTierTimer();
  freeTierCapped = false;
  controlsRow.style.display = "none";
  transcriptSection.style.display = "none";
  gallery.style.display = "none";
  if (footer) footer.classList.add("hidden");
  // Close the drawer if it was open when capture stopped — no session
  // means the settings drawer's "wire paused" framing no longer makes
  // sense. The user can reopen it from setup via the footer gear once
  // they start again.
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

function showError(msg) {
  errorText.textContent = msg;
  errorBanner.classList.add("visible");
  setTimeout(() => errorBanner.classList.remove("visible"), 10000);
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
    // Title is set by syncAvatarTitles() so it tracks the interactive state.
    // The glyph stack stays for the tap-to-fire crossfade — we keep its
    // `id="stack-<personaId>"` so all the firing/cleared/force-react paths
    // below keep working without change. We tuck it into a small overlay
    // corner of the mug so the initials remain the dominant identity.
    el.innerHTML = `
      <div class="persona-avatar" id="avatar-${p.id}">
        <div class="ring"></div>
        <span class="initials">${escapeHtml(initials)}</span>
        <span class="persona-glyph-overlay" id="stack-${p.id}" style="color:${p.color}">${personaGlyphHTML(p, "0.9em", null, true)}</span>
      </div>
      <span class="persona-name">${escapeHtml(p.name)}</span>
      <span class="persona-role">${escapeHtml(roleTag)}</span>
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
  // Pin the text's right edge to the clip's right edge so the newest
  // words are always visible and older text scrolls off the left.
  // Measured next frame so layout has caught up to the innerHTML write.
  // Pace matches speech because each interim update extends the text
  // box, which extends the translateX offset, which transitions in
  // 250ms — chains into continuous motion at talking speed.
  requestAnimationFrame(() => {
    const clip = transcriptTextEl.parentElement;
    if (!clip) return;
    const overflow = transcriptTextEl.scrollWidth - clip.clientWidth;
    transcriptTextEl.style.transform = `translateX(${-Math.max(0, overflow)}px)`;
  });
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
  if (!serverUrl) { showError("Server URL is required"); return; }
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
      showError(`Self-hosting requires your own API key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Free keys are linked in Settings.`);
      return;
    }
  }

  // Request host permission for the server if we don't already have it.
  // For self-hosters (localhost, custom domains) Chrome shows a permission
  // prompt. For peanutgallery.live this returns true immediately.
  const granted = await ensureHostPermission(serverUrl);
  if (!granted) {
    showError(
      "Permission to reach the server was declined. Click Start Listening again and accept the prompt."
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
      showError(cleaned);
    } else {
      showError(rawMsg);
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
    // Keep the masthead pack badge in sync with whatever's queued up.
    updatePackBadge();
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
// MASTHEAD + FOOTER + DRAWER (v1.4 tabloid rebrand)
// ──────────────────────────────────────────────────────
//
// All the chrome outside the main content stack lives here:
//   • pack badge in the masthead subrail
//   • role filter pills in the footer
//   • settings drawer (mute-a-critic, theme, export)
//
// Every handler no-ops if its DOM ref is missing. That keeps the extension
// robust against a stale cached HTML that doesn't know about these elements
// yet — rare in practice but Chrome's extension cache is stubborn.

function updatePackBadge() {
  if (!packBadgeEl) return;
  packBadgeEl.textContent = packBadgeName(currentPackId);
}

// ── Footer filter pills ──
//
// `All` is a master toggle that flips every role simultaneously. The four
// role pills each own a single role tag. When any role is off, `All` flips
// to off too (so the UI reads honestly as "showing a subset"). The actual
// hide/show is done entirely in CSS via a data attribute on #gallery —
// `[data-hide-fact] .feed-entry.fact { display: none }` etc. — so flipping
// a pill is O(1) regardless of how many feed entries are rendered.
function applyFilterState() {
  const roles = ["fact", "dunk", "cue", "bit"];
  for (const r of roles) {
    if (activeFilters.has(r)) gallery.removeAttribute(`data-hide-${r}`);
    else gallery.setAttribute(`data-hide-${r}`, "true");
  }
  // Sync pill .on states.
  for (const pill of filterPillEls) {
    const f = pill.dataset.filter;
    if (f === "all") {
      pill.classList.toggle("on", activeFilters.size === roles.length);
    } else {
      pill.classList.toggle("on", activeFilters.has(f));
    }
  }
}
for (const pill of filterPillEls) {
  pill.addEventListener("click", () => {
    const f = pill.dataset.filter;
    const roles = ["fact", "dunk", "cue", "bit"];
    if (f === "all") {
      // If anything is currently off, `All` becomes "turn everything on".
      // If everything is already on, `All` becomes "turn everything off"
      // — useful as a quick "hide all" when scanning for a specific type.
      const allOn = activeFilters.size === roles.length;
      activeFilters.clear();
      if (!allOn) for (const r of roles) activeFilters.add(r);
    } else {
      if (activeFilters.has(f)) activeFilters.delete(f);
      else activeFilters.add(f);
    }
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
    row.innerHTML = `
      <div class="av">${escapeHtml(personaInitials(p.name))}</div>
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
  if (e.key === "Escape" && settingsDrawer?.classList.contains("visible")) {
    closeSettingsDrawer();
  }
});

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
