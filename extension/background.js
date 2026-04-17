/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Flow (the known-good one — do not re-derive):
 *   1. User clicks the extension icon on a YouTube tab.
 *      chrome.action.onClicked fires. This is the ONLY place in a Chrome
 *      extension that has BOTH an activeTab grant AND a live user-gesture.
 *      We MUST call chrome.tabCapture.getMediaStreamId() right here,
 *      synchronously awaited. Any deferral (e.g., "wait for the side panel
 *      to ask for it on Start Listening") loses that gesture context and
 *      the call rejects. Side panels don't receive activeTab the way popups
 *      do (crbug/40916430).
 *   2. We stash the stream ID on the service worker (pendingStreamId) and
 *      open the side panel.
 *   3. If the side panel was already open when the icon was clicked, we
 *      broadcast STREAM_READY so it can update its UI.
 *   4. User clicks "Start Listening". The side panel sends START_CAPTURE.
 *      We consume pendingStreamId (it's single-use), spin up the offscreen
 *      document, and hand it the stream ID + config.
 *
 * History: see docs/SESSION-NOTES-2026-04-16.md §3. Commit 4dc7fdd
 * established this pattern; commit 9decbbc accidentally regressed it;
 * this file restores it.
 */

let offscreenReady = false;
let lastTabInfo = null;
let pendingStreamId = null; // single-use; captured in onClicked, consumed in START_CAPTURE

// ── Icon click: capture streamId synchronously, then open the panel ──
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  lastTabInfo = {
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
    windowId: tab.windowId,
  };

  console.log("[PG] Icon clicked on tab:", tab.id, tab.url);

  // CRITICAL: capture the stream ID here, in the click handler. This is the
  // only place with both activeTab + user gesture. Do not move this call.
  try {
    pendingStreamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        const err = chrome.runtime.lastError;
        if (err) { reject(new Error(err.message)); return; }
        if (!id) { reject(new Error("tabCapture returned no stream ID.")); return; }
        resolve(id);
      });
    });
    console.log("[PG] Stream ID captured, waiting for Start Listening");
  } catch (err) {
    console.error("[PG] getMediaStreamId failed in onClicked:", err.message);
    pendingStreamId = null;
  }

  // Open the side panel (does nothing if already open)
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    console.error("[PG] Failed to open side panel:", err.message);
  }

  // If the panel was already open, it missed the "icon clicked" event.
  // Broadcast STREAM_READY so it can refresh its detected-tab UI and clear
  // any stale "Chrome hasn't granted access" banner.
  chrome.runtime.sendMessage({
    type: "STREAM_READY",
    tab: lastTabInfo,
  }).catch(() => {
    // No listeners (panel closed) — fine.
  });
});

// ── Offscreen document management ──
async function offscreenExists() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (offscreenReady) return;

  if (await offscreenExists()) {
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
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "STOP_CAPTURE") {
    offscreenExists().then((exists) => {
      if (exists) sendToOffscreen({ type: "STOP_RECORDING" });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "GET_STATUS") {
    offscreenExists().then((exists) => {
      if (!exists) {
        sendResponse({ capturing: false });
        return;
      }
      sendToOffscreen({ type: "QUERY_STATUS" }, (response) => {
        sendResponse(response || { capturing: false });
      });
    });
    return true;
  }

  // Panel asks: do we have a fresh stream ID ready?
  if (message.type === "GET_STREAM_READY") {
    sendResponse({
      ready: !!pendingStreamId,
      tab: lastTabInfo,
    });
    return false;
  }

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

  // Broadcasts — not routed here, but listed so we don't log unknowns
  if (message.type === "SSE_EVENT") return false;
  if (message.type === "STREAM_READY") return false;
});

function sendToOffscreen(msg, callback) {
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, (response) => {
    if (chrome.runtime.lastError) {
      // Suppress: offscreen doc may not exist, or no listener responded.
    }
    if (callback) callback(response);
  });
}

async function handleStartCapture({ serverUrl, apiKeys, youtubeUrl, tabTitle }) {
  // Consume the stream ID that was captured in chrome.action.onClicked.
  // Stream IDs are single-use — null it out after grabbing.
  const streamId = pendingStreamId;
  pendingStreamId = null;

  if (!streamId) {
    throw new Error(
      "Chrome hasn't granted access to this tab. Click the peanut icon in the toolbar on this YouTube tab, then press Start Listening again."
    );
  }

  await ensureOffscreen();

  sendToOffscreen({
    type: "START_RECORDING",
    streamId,
    serverUrl,
    apiKeys,
    youtubeUrl: youtubeUrl || lastTabInfo?.url || "",
    tabTitle: tabTitle || lastTabInfo?.title || "Unknown tab",
  });

  return { ok: true, tabTitle: tabTitle || lastTabInfo?.title };
}
