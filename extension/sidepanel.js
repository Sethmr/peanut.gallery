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

// ── Init ──
loadSettings();
buildPersonaAvatars();
checkStatus();
detectCurrentTab();
checkStreamReady();

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
    // Show error if tabCapture failed on icon click
    if (response.error) {
      showError(response.error);
      startBtn.disabled = true;
      startBtn.textContent = "Reopen panel to retry";
    }
  });
}

// Check if background has a stream ID ready from the icon click
function checkStreamReady() {
  chrome.runtime.sendMessage({ type: "GET_STREAM_STATUS" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.error) {
      showError(response.error);
      startBtn.disabled = true;
      startBtn.textContent = "Reopen panel to retry";
    } else if (!response?.hasStreamId) {
      // No stream ID — user may have opened panel without clicking icon
      startBtn.disabled = true;
      startBtn.textContent = "Click 🥜 icon first";
    }
  });
}

// ── Settings ──
function loadSettings() {
  chrome.storage.local.get(
    ["serverUrl", "deepgramKey", "groqKey", "anthropicKey", "braveKey"],
    (data) => {
      if (data.serverUrl) serverUrlInput.value = data.serverUrl;
      if (data.deepgramKey) deepgramKeyInput.value = data.deepgramKey;
      if (data.groqKey) groqKeyInput.value = data.groqKey;
      if (data.anthropicKey) anthropicKeyInput.value = data.anthropicKey;
      if (data.braveKey) braveKeyInput.value = data.braveKey;
    }
  );
}

function saveSettings() {
  chrome.storage.local.set({
    serverUrl: serverUrlInput.value.trim(),
    deepgramKey: deepgramKeyInput.value.trim(),
    groqKey: groqKeyInput.value.trim(),
    anthropicKey: anthropicKeyInput.value.trim(),
    braveKey: braveKeyInput.value.trim(),
  });
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

// ── SSE Event Handler ──
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
startBtn.addEventListener("click", async () => {
  saveSettings();
  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
  if (!serverUrl) { showError("Server URL is required"); return; }

  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  try {
    // Get current tab URL (should be YouTube)
    const tabInfo = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, resolve);
    });

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "START_CAPTURE",
        serverUrl,
        apiKeys: {
          deepgram: deepgramKeyInput.value.trim(),
          groq: groqKeyInput.value.trim(),
          anthropic: anthropicKeyInput.value.trim(),
          brave: braveKeyInput.value.trim(),
        },
        youtubeUrl: tabInfo?.url || "",
      }, resolve);
    });

    if (result?.error) throw new Error(result.error);

    showCapturing();
    statusText.textContent = "Connecting to server...";
    statusBar.classList.add("active");
  } catch (err) {
    showError(err.message);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start Listening";
  }
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
  showIdle();
});

fireBtn.addEventListener("click", async () => {
  if (!sessionId) return;
  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
  fetch(`${serverUrl}/api/transcribe`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "force_fire" }),
  }).catch(() => {});
});

function firePersona(personaId) {
  if (!sessionId) return;
  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
  fetch(`${serverUrl}/api/transcribe`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action: "fire_persona", personaId }),
  }).catch(() => {});
}

// ── Toggle keys ──
document.getElementById("toggleKeys").addEventListener("click", () => {
  document.getElementById("keysSection").classList.toggle("visible");
});
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
