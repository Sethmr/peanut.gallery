/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Key insight: chrome.tabCapture.getMediaStreamId() requires a user gesture.
 * Side panels don't grant activeTab, so we capture the stream ID immediately
 * on icon click (which IS a user gesture), store it, then let the side panel
 * use it when the user clicks "Start Listening".
 */

let offscreenReady = false;
let pendingStreamId = null;  // Stream ID captured on icon click
let pendingTabInfo = null;   // Tab info from the icon click

// ── Extension icon click: capture stream ID FIRST, then open side panel ──
// Do NOT use openPanelOnActionClick — we need the click handler for tabCapture
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    // Capture stream ID immediately — this has user gesture context
    const streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(id);
      });
    });

    pendingStreamId = streamId;
    pendingTabInfo = { url: tab.url, title: tab.title, tabId: tab.id };

    console.log("[PG] Stream ID captured on icon click:", streamId?.slice(0, 20) + "...");

    // Notify the side panel (if already open) that stream is ready
    chrome.runtime.sendMessage({
      type: "STREAM_READY",
      tabInfo: pendingTabInfo,
    }).catch(() => {}); // Side panel may not be open yet — that's fine
  } catch (err) {
    console.error("[PG] Failed to get stream ID on click:", err.message);
    pendingStreamId = null;
    pendingTabInfo = { url: tab.url, title: tab.title, tabId: tab.id, error: err.message };

    chrome.runtime.sendMessage({
      type: "STREAM_ERROR",
      error: err.message,
    }).catch(() => {});
  }

  // Open the side panel (or bring it to focus if already open)
  chrome.sidePanel.open({ windowId: tab.windowId });
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
  // START_CAPTURE: side panel is ready to start — use the stored stream ID
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  // STOP_CAPTURE: forward to offscreen
  if (message.type === "STOP_CAPTURE") {
    sendToOffscreen({ type: "STOP_RECORDING" });
    pendingStreamId = null;
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

  // GET_TAB_INFO: return the tab info captured on icon click
  if (message.type === "GET_TAB_INFO") {
    if (pendingTabInfo) {
      sendResponse(pendingTabInfo);
    } else {
      // Fallback: query the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        sendResponse({
          url: tab?.url || "",
          title: tab?.title || "",
          tabId: tab?.id || null,
        });
      });
    }
    return true;
  }

  // GET_STREAM_STATUS: side panel checks if we have a stream ID ready
  if (message.type === "GET_STREAM_STATUS") {
    sendResponse({
      hasStreamId: !!pendingStreamId,
      error: pendingTabInfo?.error || null,
    });
    return false;
  }

  // SSE_EVENT: offscreen forwards these to side panel — ignore here
  if (message.type === "SSE_EVENT") return false;
});

function sendToOffscreen(msg, callback) {
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, callback);
}

async function handleStartCapture({ serverUrl, apiKeys, youtubeUrl }) {
  if (!pendingStreamId) {
    throw new Error(
      "No audio stream available. Close and reopen the side panel by clicking the 🥜 icon on the YouTube tab."
    );
  }

  const streamId = pendingStreamId;
  const tabInfo = pendingTabInfo;
  pendingStreamId = null; // Consume it — stream IDs are single-use

  await ensureOffscreen();

  // Tell offscreen doc to start recording + create server session
  sendToOffscreen({
    type: "START_RECORDING",
    streamId,
    serverUrl,
    apiKeys,
    youtubeUrl: youtubeUrl || tabInfo?.url || "",
    tabTitle: tabInfo?.title || "Unknown tab",
  });

  return { ok: true, tabId: tabInfo?.tabId, tabTitle: tabInfo?.title };
}
