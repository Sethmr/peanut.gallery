/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Flow:
 *   1. User clicks the extension icon (or row in the 🧩 menu) → side panel opens.
 *      We remember which tab they were on so the panel can default to it.
 *   2. User clicks "Start Listening" in the side panel. The side panel calls
 *      chrome.tabCapture.getMediaStreamId() itself — that button click IS a
 *      user gesture inside the panel's document, which is what tabCapture
 *      requires. It forwards the streamId here as part of START_CAPTURE.
 *   3. We spin up the offscreen document and hand it the streamId + config.
 *
 * This avoids depending on chrome.action.onClicked firing reliably (which
 * was flaky when the user invoked the extension from the Extensions dropdown
 * rather than a pinned icon).
 */

let offscreenReady = false;
let lastTabInfo = null; // Remember the tab the panel was opened on

// ── Icon click: just open the side panel and remember the tab ──
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  lastTabInfo = {
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
    windowId: tab.windowId,
  };

  console.log("[PG] Icon clicked — opening side panel for tab:", tab.id);

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    console.error("[PG] Failed to open side panel:", err.message);
  }
});

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
  // START_CAPTURE: the side panel has a streamId from its own user gesture
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // STOP_CAPTURE: forward to offscreen
  if (message.type === "STOP_CAPTURE") {
    sendToOffscreen({ type: "STOP_RECORDING" });
    sendResponse({ ok: true });
    return true;
  }

  // GET_STATUS: ask offscreen
  if (message.type === "GET_STATUS") {
    sendToOffscreen({ type: "QUERY_STATUS" }, (response) => {
      sendResponse(response || { capturing: false });
    });
    return true;
  }

  // GET_TAB_INFO: prefer the tab the panel was opened on; fall back to active
  if (message.type === "GET_TAB_INFO") {
    if (lastTabInfo) {
      sendResponse(lastTabInfo);
      return false;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      sendResponse({
        url: tab?.url || "",
        title: tab?.title || "",
        tabId: tab?.id || null,
        windowId: tab?.windowId || null,
      });
    });
    return true;
  }

  // SSE_EVENT: offscreen forwards these to side panel — ignore here
  if (message.type === "SSE_EVENT") return false;
});

function sendToOffscreen(msg, callback) {
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, callback);
}

async function handleStartCapture({
  serverUrl,
  apiKeys,
  youtubeUrl,
  streamId,
  tabTitle,
  tabId,
}) {
  if (!streamId) {
    throw new Error(
      "No audio stream available. Make sure you're on a YouTube tab, then click Start Listening again."
    );
  }

  await ensureOffscreen();

  // Tell offscreen doc to start recording + create server session
  sendToOffscreen({
    type: "START_RECORDING",
    streamId,
    serverUrl,
    apiKeys,
    youtubeUrl: youtubeUrl || "",
    tabTitle: tabTitle || "Unknown tab",
  });

  return { ok: true, tabId, tabTitle };
}
