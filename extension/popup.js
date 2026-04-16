/**
 * Peanut Gallery — Extension Popup
 *
 * Two flows:
 * 1. "Full" mode — extension creates the server session and streams audio
 *    (for standalone use without the web UI)
 * 2. "Attach" mode — web UI already created a session, extension just
 *    captures audio and sends it to the existing session ID
 *
 * The popup detects which mode based on whether a session ID is provided.
 */

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const errorBox = document.getElementById("errorBox");
const serverUrlInput = document.getElementById("serverUrl");
const deepgramKeyInput = document.getElementById("deepgramKey");
const groqKeyInput = document.getElementById("groqKey");
const toggleKeysBtn = document.getElementById("toggleKeys");
const keysSection = document.getElementById("keysSection");

// Toggle API keys section
toggleKeysBtn.addEventListener("click", () => {
  keysSection.classList.toggle("visible");
});

// Load saved settings
chrome.storage.local.get(
  ["serverUrl", "deepgramKey", "groqKey", "activeSessionId", "activeServerUrl"],
  (data) => {
    if (data.serverUrl) serverUrlInput.value = data.serverUrl;
    if (data.deepgramKey) deepgramKeyInput.value = data.deepgramKey;
    if (data.groqKey) groqKeyInput.value = data.groqKey;

    // If there's an active session, show capturing state
    if (data.activeSessionId) {
      showCapturing(data.activeSessionId);
    }
  }
);

// Check current capture status from offscreen doc
chrome.runtime.sendMessage({ type: "GET_STATUS", target: "offscreen" }, (response) => {
  if (chrome.runtime.lastError) return; // offscreen doc may not exist yet
  if (response?.capturing) {
    showCapturing(response.sessionId);
  }
});

// Save settings on change
[serverUrlInput, deepgramKeyInput, groqKeyInput].forEach((input) => {
  input.addEventListener("change", saveSettings);
});

function saveSettings() {
  chrome.storage.local.set({
    serverUrl: serverUrlInput.value.trim(),
    deepgramKey: deepgramKeyInput.value.trim(),
    groqKey: groqKeyInput.value.trim(),
  });
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = "block";
  setTimeout(() => { errorBox.style.display = "none"; }, 8000);
}

function showCapturing(sid) {
  statusEl.classList.add("capturing");
  statusText.textContent = sid
    ? `Capturing → session ${sid}`
    : "Capturing tab audio...";
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
}

function showIdle() {
  statusEl.classList.remove("capturing");
  statusText.textContent = "Not capturing";
  startBtn.style.display = "block";
  stopBtn.style.display = "none";
  chrome.storage.local.remove(["activeSessionId", "activeServerUrl"]);
}

startBtn.addEventListener("click", async () => {
  errorBox.style.display = "none";
  saveSettings();

  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
  if (!serverUrl) {
    showError("Server URL is required");
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const youtubeUrl = tab?.url || "";

    const deepgramKey = deepgramKeyInput.value.trim();
    const groqKey = groqKeyInput.value.trim();

    // Start capture via the service worker → offscreen document
    const captureResult = await chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      serverUrl,
      apiKeys: { deepgram: deepgramKey, groq: groqKey },
      youtubeUrl,
    });

    if (captureResult?.error) {
      throw new Error(captureResult.error);
    }

    // Wait a beat for the offscreen doc to create the session
    await new Promise((r) => setTimeout(r, 500));

    // Get the session ID from storage
    const data = await chrome.storage.local.get(["sessionId"]);
    const sid = data.sessionId || "connecting...";

    chrome.storage.local.set({
      activeSessionId: sid,
      activeServerUrl: serverUrl,
    });

    showCapturing(sid);
  } catch (err) {
    showError(err.message);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start Capturing This Tab";
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
  } catch (err) {
    console.error("[PG Extension] Stop error:", err);
  }
  showIdle();
});
