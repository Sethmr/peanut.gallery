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

// ── State ──
let capturing = false;
let sessionId = null;
let transcriptFinal = "";
let transcriptInterim = "";
let feedEntries = []; // { id, personaId, text, timestamp }
let streamBuffers = {}; // personaId → accumulated streaming text
let streamingPersonaId = null;
let messageCount = 0;

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

// ── Init ──
loadSettings();
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
      if (data.deepgramKey) deepgramKeyInput.value = data.deepgramKey;
      if (data.groqKey) groqKeyInput.value = data.groqKey;
      if (data.anthropicKey) anthropicKeyInput.value = data.anthropicKey;
      if (data.braveKey) braveKeyInput.value = data.braveKey;

      // Audio routing defaults: passthrough ON + system default device.
      // Matches pre-v1.1 behavior exactly for existing users.
      passthroughToggle.checked = data.passthrough !== false;
      const savedDevice = data.outputDeviceId || "default";
      // Selected device is applied once enumerateOutputDevices() runs (async).
      outputDeviceSelect.dataset.pendingValue = savedDevice;

      // Auto-expand keys section if the 3 required keys aren't all present,
      // so first-time users see the key fields without having to find the toggle.
      const hasRequiredKeys = !!(data.deepgramKey && data.groqKey && data.anthropicKey);
      if (!hasRequiredKeys) {
        const section = document.getElementById("keysSection");
        const toggle = document.getElementById("toggleKeys");
        section.classList.add("visible");
        toggle.classList.add("open");
      }
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
  setupSection.style.display = "block";
  emptyState.style.display = "flex";
  statusBar.style.display = "none";
  controlsRow.style.display = "none";
  transcriptSection.style.display = "none";
  gallery.style.display = "none";
  statusBar.classList.remove("active", "live");

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
    }
  });
}

// ── Persona avatars ──
function buildPersonaAvatars() {
  personasRow.innerHTML = "";
  for (const p of PERSONAS) {
    const el = document.createElement("div");
    el.className = "persona-bubble";
    el.dataset.personaId = p.id;
    el.title = `Make ${p.name} react now`;
    el.innerHTML = `
      <div class="persona-avatar" id="avatar-${p.id}" style="background:${p.color}20; color:${p.color}">
        <div class="ring"></div>
        <span>${p.emoji}</span>
      </div>
      <div class="persona-wave" style="color:${p.color}">
        <svg viewBox="0 0 200 20" preserveAspectRatio="none">
          <path d="M 0 10 Q 12.5 0, 25 10 T 50 10 T 75 10 T 100 10 T 125 10 T 150 10 T 175 10 T 200 10"
                stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <span class="persona-name" style="color:${p.color}">${p.name}</span>
      <span class="persona-role">${p.role}</span>
    `;
    el.addEventListener("click", () => firePersona(p.id));
    personasRow.appendChild(el);
  }
}

function updatePersonaSpeaking(activeId) {
  for (const p of PERSONAS) {
    const avatar = document.getElementById(`avatar-${p.id}`);
    if (avatar) {
      avatar.classList.toggle("speaking", p.id === activeId);
    }
  }
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
      <span class="feed-emoji">${p.emoji}</span>
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
      <span class="feed-emoji">${p.emoji}</span>
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
      finalizeStreamingEntry();
      if (finalText.trim()) {
        addFeedEntry(pid, finalText.trim());
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
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  if (!serverUrl) { showError("Server URL is required"); return; }
  // Reflect the normalized URL back into the input so it's visible to the user
  serverUrlInput.value = serverUrl;

  // Pre-flight: required keys must be set. Deepgram is mandatory; without
  // Groq or Anthropic, 2 of the 4 personas will stay silent. Warn clearly
  // rather than silently hang on "Connecting to server..."
  const missing = [];
  if (!deepgramKeyInput.value.trim()) missing.push("Deepgram");
  if (!groqKeyInput.value.trim()) missing.push("Groq");
  if (!anthropicKeyInput.value.trim()) missing.push("Anthropic");
  if (missing.length > 0) {
    // Expand the keys section so user can fill them in
    document.getElementById("keysSection").classList.add("visible");
    document.getElementById("toggleKeys").classList.add("open");
    showError(`Missing required API key${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Free keys are linked below.`);
    return;
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

    showCapturing();
    statusText.textContent = "Connecting to server...";
    statusBar.classList.add("active");
  } catch (err) {
    showError(err.message || String(err));
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
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  fetch(`${serverUrl}/api/transcribe`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "force_fire" }),
  }).catch(() => {});
});

function firePersona(personaId) {
  if (!sessionId) return;
  const serverUrl = normalizeServerUrl(serverUrlInput.value);
  fetch(`${serverUrl}/api/transcribe`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "fire_persona", personaId }),
  }).catch(() => {});
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
