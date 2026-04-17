/**
 * Peanut Gallery — Side Panel
 *
 * The main UI. Shows transcript + persona reactions in a sidebar
 * next to the YouTube video. Receives events from the offscreen
 * document via chrome.runtime.onMessage.
 */

// ── Persona definitions (must match server) ──
const PERSONAS = [
  { id: "producer", name: "Baba Booey", role: "Fact-Checker", emoji: "🎯", color: "#3b82f6" },
  { id: "troll", name: "The Troll", role: "Cynical Commentator", emoji: "🔥", color: "#ef4444" },
  { id: "soundfx", name: "Fred", role: "Sound Effects", emoji: "🎧", color: "#a855f7" },
  { id: "joker", name: "Jackie", role: "Comedy Writer", emoji: "😂", color: "#f59e0b" },
];

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
let feedEntries = []; // { id, personaId, text, timestamp }
let streamBuffers = {}; // personaId → accumulated streaming text
let streamingPersonaId = null;
let messageCount = 0;

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
const groqKeyInput = document.getElementById("groqKey");
const anthropicKeyInput = document.getElementById("anthropicKey");
const braveKeyInput = document.getElementById("braveKey");
const passthroughToggle = document.getElementById("passthroughToggle");
const outputDeviceSelect = document.getElementById("outputDevice");
const capturedTabBanner = document.getElementById("capturedTabBanner");
const capturedTabTitle = document.getElementById("capturedTabTitle");

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
      "groqKey",
      "anthropicKey",
      "braveKey",
      "passthrough",
      "outputDeviceId",
    ],
    (data) => {
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      // Key fields stay empty by default. The backend has its own demo keys
      // in env vars and will use them when the extension sends no key headers.
      // If the user pastes their own key here, the extension forwards it via
      // X-*-Key headers and the backend uses those instead.
      deepgramKeyInput.value = data.deepgramKey || "";
      groqKeyInput.value = data.groqKey || "";
      anthropicKeyInput.value = data.anthropicKey || "";
      braveKeyInput.value = data.braveKey || "";

      // Audio routing defaults: passthrough ON + system default device.
      // Matches pre-v1.1 behavior exactly for existing users.
      passthroughToggle.checked = data.passthrough !== false;
      const savedDevice = data.outputDeviceId || "default";
      // Selected device is applied once enumerateOutputDevices() runs (async).
      outputDeviceSelect.dataset.pendingValue = savedDevice;

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
    groqKey: groqKeyInput.value.trim(),
    anthropicKey: anthropicKeyInput.value.trim(),
    braveKey: braveKeyInput.value.trim(),
    passthrough: passthroughToggle.checked,
    outputDeviceId: currentOutputDeviceId(),
  });
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
  statusBar.style.display = "flex";
  controlsRow.style.display = "block";
  transcriptSection.style.display = "block";
  gallery.style.display = "flex";
}

function showIdle() {
  capturing = false;
  sessionId = null;
  capturedTabInfo = null;
  setupSection.style.display = "block";
  emptyState.style.display = "flex";
  statusBar.style.display = "none";
  controlsRow.style.display = "none";
  transcriptSection.style.display = "none";
  gallery.style.display = "none";
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
  transcriptTextEl.textContent = "Listening...";
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
function buildPersonaAvatars() {
  personasRow.innerHTML = "";
  for (const p of PERSONAS) {
    const el = document.createElement("div");
    el.className = "persona-bubble";
    el.id = `bubble-${p.id}`;
    el.dataset.personaId = p.id;
    el.title = `Make ${p.name} react now`;
    // Ordering: avatar → name → role → wave. The wave lives BELOW the text
    // block so the avatar and labels form one tight group with no gap when
    // the persona isn't speaking. The wave's reserved height (CSS) keeps
    // the row height stable between idle and speaking states. The glyph is
    // wrapped in a stack with a spinner layer for the tap-to-fire crossfade
    // (id `stack-<personaId>` so we can add/remove `.firing` directly).
    el.innerHTML = `
      <div class="persona-avatar" id="avatar-${p.id}" style="background:${p.color}20; color:${p.color}">
        <div class="ring"></div>
        <span id="stack-${p.id}">${personaGlyphHTML(p, "1.3em", null, true)}</span>
      </div>
      <span class="persona-name" style="color:${p.color}">${p.name}</span>
      <span class="persona-role">${p.role}</span>
      <div class="persona-wave" style="color:${p.color}">
        <svg viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M 0 10 Q 12.5 0, 25 10 T 50 10 T 75 10 T 100 10 T 125 10 T 150 10 T 175 10 T 200 10"
                stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    `;
    el.addEventListener("click", () => firePersona(p.id));
    personasRow.appendChild(el);
  }
}

function updatePersonaSpeaking(activeId) {
  for (const p of PERSONAS) {
    // Toggle on the bubble (parent of avatar + wave), since the wave is no
    // longer adjacent to the avatar — the CSS now targets
    // `.persona-bubble.speaking .persona-wave` instead of an adjacent-sibling.
    const bubble = document.getElementById(`bubble-${p.id}`);
    const avatar = document.getElementById(`avatar-${p.id}`);
    const speaking = p.id === activeId;
    if (bubble) bubble.classList.toggle("speaking", speaking);
    // Keep .speaking on the avatar too — the ring-pulse animation still keys
    // off it via `.persona-avatar.speaking .ring`.
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
function addFeedEntry(personaId, text) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) return;

  const id = `${personaId}-${messageCount++}`;
  const now = Date.now();
  feedEntries.push({ id, personaId, text, timestamp: now });

  const el = document.createElement("div");
  el.className = "feed-entry";
  el.id = `feed-${id}`;
  el.innerHTML = `
    <div class="feed-header">
      <span class="feed-emoji" style="color:${p.color}">${personaGlyphHTML(p, "1em", p.color)}</span>
      <span class="feed-name" style="color:${p.color}">${p.name}</span>
      <span class="feed-time">${formatTime(now)}</span>
    </div>
    <div class="feed-text">${escapeHtml(text)}</div>
  `;

  gallery.appendChild(el);
  gallery.scrollTop = gallery.scrollHeight;
}

function updateStreamingEntry(personaId, text) {
  const p = PERSONAS.find((x) => x.id === personaId);
  if (!p) return;

  let el = document.getElementById("feed-streaming");
  if (!el) {
    el = document.createElement("div");
    el.className = "feed-entry feed-streaming";
    el.id = "feed-streaming";
    gallery.appendChild(el);
  }

  el.innerHTML = `
    <div class="feed-header">
      <span class="feed-emoji" style="color:${p.color}">${personaGlyphHTML(p, "1em", p.color)}</span>
      <span class="feed-name" style="color:${p.color}">${p.name}</span>
    </div>
    <div class="feed-text">${escapeHtml(text)}</div>
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
      if (finalText.trim()) {
        addFeedEntry(pid, finalText.trim());
        // If the user is waiting on a React-button click, count non-empty
        // responses and restore the button as soon as we've got at least
        // FORCE_REACT_TARGET of them. Empty passes ("-") don't count.
        if (forceReactActive) {
          forceReactReceived++;
          if (forceReactReceived >= FORCE_REACT_TARGET) {
            resetFireButton();
          }
        }
      }
      break;
    }

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
        // Backend finished the force-react burst. If the button is still
        // spinning (e.g. fewer than FORCE_REACT_TARGET non-empty responses
        // came back), restore it now rather than waiting on the timeout.
        if (forceReactActive) resetFireButton();
      }
      break;
  }
});

function updateTranscript() {
  let html = "";
  if (transcriptFinal) html += escapeHtml(transcriptFinal) + " ";
  if (transcriptInterim) html += `<span class="interim">${escapeHtml(transcriptInterim)}</span>`;
  if (!html) html = '<span style="color:var(--text-dim)">Listening...</span>';
  transcriptTextEl.innerHTML = html;
  transcriptSection.scrollTop = transcriptSection.scrollHeight;
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
  // we skip the check — the server has demo keys in its env vars and will use
  // them whenever the extension sends no key headers.
  const isHostedBackend = /(^|\/\/)peanutgallery\.live(\/|$)/i.test(serverUrl);
  if (!isHostedBackend) {
    const missing = [];
    if (!deepgramKeyInput.value.trim()) missing.push("Deepgram");
    if (!groqKeyInput.value.trim()) missing.push("Groq");
    if (!anthropicKeyInput.value.trim()) missing.push("Anthropic");
    if (missing.length > 0) {
      // Expand the keys section so user can fill them in
      document.getElementById("keysSection").classList.add("visible");
      document.getElementById("toggleKeys").classList.add("open");
      showError(`Self-hosting requires your own API key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Free keys are linked below.`);
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
          groq: groqKeyInput.value.trim(),
          anthropic: anthropicKeyInput.value.trim(),
          brave: braveKeyInput.value.trim(),
        },
        audio: {
          passthrough: passthroughToggle.checked,
          outputDeviceId: currentOutputDeviceId(),
        },
      }, resolve);
    });

    if (result?.error) throw new Error(result.error);

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
      document.getElementById("keysSection").classList.add("visible");
      document.getElementById("toggleKeys").classList.add("open");
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
  }).catch(() => {
    // Network error — don't leave the spinner stuck on the avatar.
    clearPersonaFiring(personaId);
  });
}

// ── Toggle keys ──
document.getElementById("toggleKeys").addEventListener("click", (e) => {
  const section = document.getElementById("keysSection");
  const isOpen = section.classList.toggle("visible");
  e.currentTarget.classList.toggle("open", isOpen);
});

// ── Toggle audio routing ──
document.getElementById("toggleAudio").addEventListener("click", (e) => {
  const section = document.getElementById("audioSection");
  const isOpen = section.classList.toggle("visible");
  e.currentTarget.classList.toggle("open", isOpen);
  // Enumerate devices the first time the section is opened — this is when
  // the user is actually interested in seeing them, and it avoids poking
  // the media permission model on every panel open.
  if (isOpen && !devicesEnumerated) {
    enumerateOutputDevices();
  }
});

// ── Audio settings: persist + live-update the running session ──
passthroughToggle.addEventListener("change", () => {
  saveSettings();
  sendAudioSettingsToOffscreen();
});
outputDeviceSelect.addEventListener("change", () => {
  saveSettings();
  sendAudioSettingsToOffscreen();
});

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
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Save settings on input change
[serverUrlInput, deepgramKeyInput, groqKeyInput, anthropicKeyInput, braveKeyInput].forEach((el) => {
  el.addEventListener("change", saveSettings);
});
