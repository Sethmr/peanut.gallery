/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Flow (the known-good one — do not re-derive):
 *   1. User clicks the extension icon on a YouTube tab.
 *      chrome.action.onClicked fires. This is the ONLY place with BOTH an
 *      activeTab grant AND a live user-gesture. We MUST call
 *      chrome.tabCapture.getMediaStreamId() right here, synchronously.
 *   2. We persist the stream ID to chrome.storage.session (NOT a module
 *      variable — MV3 service workers die after ~30s of inactivity and lose
 *      all in-memory state). Then we open the side panel.
 *   3. User clicks "Start Listening". The side panel sends START_CAPTURE.
 *      We read the stream ID from session storage, consume it (single-use),
 *      and hand it to the offscreen doc.
 *
 * History: see docs/SESSION-NOTES-2026-04-16.md §3. Commit 4dc7fdd
 * established this pattern; commit 9decbbc regressed it; this file both
 * restores the pattern AND hardens it against SW eviction.
 */

let offscreenReady = false;

// ── storage helpers ──
// Session storage persists for the browser session but clears on restart.
// Survives service-worker eviction. Perfect for single-use stream IDs.
const SESSION = chrome.storage.session;

async function setPendingStream(streamId, tab) {
  await SESSION.set({
    pendingStreamId: streamId,
    lastTab: tab,
  });
}
async function takePendingStream() {
  const { pendingStreamId } = await SESSION.get("pendingStreamId");
  if (pendingStreamId) await SESSION.remove("pendingStreamId");
  return pendingStreamId || null;
}
async function getLastTab() {
  const { lastTab } = await SESSION.get("lastTab");
  return lastTab || null;
}

// ── Icon click: capture streamId synchronously, persist, open panel ──
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[PG:bg] onClicked fired for tab:", tab?.id, tab?.url);
  if (!tab?.id) {
    console.warn("[PG:bg] onClicked: no tab id, bailing");
    return;
  }

  const tabInfo = {
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
    windowId: tab.windowId,
  };

  // CRITICAL: capture the stream ID here, in the click handler. This is the
  // only place with both activeTab + user gesture. Do not move this call.
  let streamId = null;
  try {
    streamId = await new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
        const err = chrome.runtime.lastError;
        if (err) { reject(new Error(err.message)); return; }
        if (!id) { reject(new Error("tabCapture returned no stream ID.")); return; }
        resolve(id);
      });
    });
    console.log("[PG:bg] ✓ getMediaStreamId OK, id length:", streamId.length);
  } catch (err) {
    console.error("[PG:bg] ✗ getMediaStreamId failed:", err.message);
    // Still open the panel so the user sees a message, but don't store a bad id.
  }

  await setPendingStream(streamId, tabInfo);
  console.log("[PG:bg] persisted streamId to session storage:", !!streamId);

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log("[PG:bg] sidePanel.open OK");
  } catch (err) {
    console.error("[PG:bg] sidePanel.open failed:", err.message);
  }

  // Tell an already-open panel to refresh its state
  chrome.runtime.sendMessage({
    type: "STREAM_READY",
    tab: tabInfo,
    hasStream: !!streamId,
  }).catch(() => {});
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
  if (await offscreenExists()) { offscreenReady = true; return; }
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
    console.log("[PG:bg] START_CAPTURE received");
    handleStartCapture(message)
      .then((r) => { console.log("[PG:bg] START_CAPTURE ok"); sendResponse(r); })
      .catch((err) => { console.error("[PG:bg] START_CAPTURE err:", err.message); sendResponse({ error: err.message }); });
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
      if (!exists) { sendResponse({ capturing: false }); return; }
      sendToOffscreen({ type: "QUERY_STATUS" }, (response) => {
        sendResponse(response || { capturing: false });
      });
    });
    return true;
  }

  // Panel asks: is there a fresh stream ID waiting?
  if (message.type === "GET_STREAM_READY") {
    (async () => {
      const { pendingStreamId } = await SESSION.get("pendingStreamId");
      const lastTab = await getLastTab();
      sendResponse({ ready: !!pendingStreamId, tab: lastTab });
    })();
    return true;
  }

  if (message.type === "GET_TAB_INFO") {
    (async () => {
      const lastTab = await getLastTab();
      if (lastTab) { sendResponse(lastTab); return; }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        sendResponse({
          url: tab?.url || "",
          title: tab?.title || "",
          tabId: tab?.id || null,
          windowId: tab?.windowId || null,
        });
      });
    })();
    return true;
  }

  if (message.type === "SSE_EVENT") return false;
  if (message.type === "STREAM_READY") return false;
});

function sendToOffscreen(msg, callback) {
  chrome.runtime.sendMessage({ ...msg, target: "offscreen" }, (response) => {
    if (chrome.runtime.lastError) { /* suppress */ }
    if (callback) callback(response);
  });
}

async function handleStartCapture({ serverUrl, apiKeys, youtubeUrl, tabTitle }) {
  const streamId = await takePendingStream();
  console.log("[PG:bg] handleStartCapture: took streamId from session?", !!streamId);

  if (!streamId) {
    throw new Error(
      "Chrome hasn't granted access to this tab. Click the peanut icon in the toolbar on this YouTube tab, then press Start Listening again."
    );
  }

  const lastTab = await getLastTab();

  await ensureOffscreen();

  sendToOffscreen({
    type: "START_RECORDING",
    streamId,
    serverUrl,
    apiKeys,
    youtubeUrl: youtubeUrl || lastTab?.url || "",
    tabTitle: tabTitle || lastTab?.title || "Unknown tab",
  });

  return { ok: true, tabTitle: tabTitle || lastTab?.title };
}
