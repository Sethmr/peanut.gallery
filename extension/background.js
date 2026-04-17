/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Flow:
 *   1. User clicks the extension icon on a YouTube tab. That click fires
 *      chrome.action.onClicked, which Chrome treats as "invoking" the
 *      extension on that tab — activeTab is granted. We remember the tab
 *      and open the side panel.
 *   2. User clicks "Start Listening" in the side panel. The panel messages
 *      START_CAPTURE to this service worker.
 *   3. We call chrome.tabCapture.getMediaStreamId({ targetTabId }) HERE, in
 *      the service worker (supported since Chrome 116). This consumes the
 *      activeTab grant from step 1. Doing it in the side panel document
 *      is unreliable — side panels don't receive activeTab the way popups
 *      do (crbug/40916430).
 *   4. We spin up an offscreen document and hand it the streamId + config.
 *      The offscreen doc does getUserMedia with the streamId and streams
 *      PCM to the server.
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
  // START_CAPTURE: side panel asked us to begin; we resolve the streamId
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // STOP_CAPTURE: forward to offscreen only if it's running
  if (message.type === "STOP_CAPTURE") {
    offscreenExists().then((exists) => {
      if (exists) sendToOffscreen({ type: "STOP_RECORDING" });
      sendResponse({ ok: true });
    });
    return true;
  }

  // GET_STATUS: ask offscreen if it exists; otherwise not capturing
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
  // Always read chrome.runtime.lastError in the callback to avoid Chrome's
  // "Unchecked runtime.lastError" warnings when the offscreen doc isn't
  // there yet or when a broadcast has no responder.
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, (response) => {
    if (chrome.runtime.lastError) {
      // Suppress: offscreen doc may not exist, or no listener responded.
    }
    if (callback) callback(response);
  });
}

async function handleStartCapture({
  serverUrl,
  apiKeys,
  youtubeUrl,
  tabTitle,
  tabId,
}) {
  // Prefer the tabId the panel sent; fall back to the one we stored on icon
  // click. Either way, activeTab was granted when the user clicked the
  // extension icon on that tab — that grant lives on the extension, not on
  // any particular document, so the service worker can consume it here.
  const targetTabId = tabId || lastTabInfo?.tabId;
  if (!targetTabId) {
    throw new Error(
      "No target tab. Click the peanut icon in the toolbar on a YouTube tab first."
    );
  }

  // Get the stream ID from the service worker. Chrome 116+ supports this.
  // activeTab must be granted on the target tab; it is, because the user
  // clicked the extension's action icon (that's what fired our
  // chrome.action.onClicked handler which opened this panel in the first
  // place). If the grant lapsed (nav or tab close), surface a clear message.
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (id) => {
      const err = chrome.runtime.lastError;
      if (err) {
        const msg = /invoked|activeTab/i.test(err.message)
          ? "Chrome hasn't granted access to this tab. Click the peanut icon in the toolbar on this YouTube tab, then press Start Listening again."
          : err.message;
        reject(new Error(msg));
        return;
      }
      if (!id) {
        reject(new Error("tabCapture returned no stream ID."));
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
    youtubeUrl: youtubeUrl || "",
    tabTitle: tabTitle || "Unknown tab",
  });

  return { ok: true, tabId: targetTabId, tabTitle };
}
