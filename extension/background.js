/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Orchestrates:
 * 1. Side panel — opens when extension icon is clicked
 * 2. Tab audio capture — via chrome.tabCapture → offscreen document
 * 3. Message routing between side panel, offscreen doc, and popup
 */

let offscreenReady = false;

// ── Extension icon click → open side panel ──
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Offscreen document management ──
async function ensureOffscreen() {
  if (offscreenReady) return;

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Capture tab audio for real-time transcription",
  });

  offscreenReady = true;
}

// ── Message routing ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // START_CAPTURE: from side panel → get tabCapture stream → forward to offscreen
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  // STOP_CAPTURE: from side panel → forward to offscreen
  if (message.type === "STOP_CAPTURE") {
    sendToOffscreen({ type: "STOP_RECORDING" });
    sendResponse({ ok: true });
    return true;
  }

  // GET_STATUS: from side panel → ask offscreen
  if (message.type === "GET_STATUS") {
    sendToOffscreen({ type: "QUERY_STATUS" }, (response) => {
      sendResponse(response || { capturing: false });
    });
    return true;
  }

  // GET_TAB_INFO: side panel needs the current tab's URL
  if (message.type === "GET_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      sendResponse({
        url: tab?.url || "",
        title: tab?.title || "",
        tabId: tab?.id || null,
      });
    });
    return true;
  }

  // SSE_EVENT: offscreen doc forwards parsed SSE events → side panel picks them up
  // Background doesn't need to handle these — just ignore
  if (message.type === "SSE_EVENT") return false;
});

function sendToOffscreen(msg, callback) {
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, callback);
}

async function handleStartCapture({ serverUrl, apiKeys, youtubeUrl }) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");

  // Get a media stream ID for this tab
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(id);
    });
  });

  await ensureOffscreen();

  // Tell offscreen doc to start recording + create server session
  sendToOffscreen({
    type: "START_RECORDING",
    streamId,
    serverUrl,
    apiKeys,
    youtubeUrl: youtubeUrl || tab.url || "",
    tabTitle: tab.title || "Unknown tab",
  });

  return { ok: true, tabId: tab.id, tabTitle: tab.title };
}
