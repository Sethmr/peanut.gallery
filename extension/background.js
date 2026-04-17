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

// ── Force icon click to fire onClicked (not auto-open the panel) ──
// With a side_panel declared, some Chrome versions default to auto-opening
// the panel on icon click, which SKIPS our onClicked handler entirely. Set
// this explicitly to false so we always get the click event.
function ensurePanelBehavior() {
  return chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .then(() => console.log("[PG:bg] setPanelBehavior: openPanelOnActionClick=false"))
    .catch((err) => console.error("[PG:bg] setPanelBehavior failed:", err.message));
}
chrome.runtime.onInstalled.addListener(ensurePanelBehavior);
chrome.runtime.onStartup.addListener(ensurePanelBehavior);
// Also call it at SW boot, so reloads of the unpacked extension pick it up
// without needing a browser restart.
ensurePanelBehavior();

// ── storage helpers ──
// Session storage persists for the browser session but clears on restart.
// Survives service-worker eviction. Perfect for single-use stream IDs.
const SESSION = chrome.storage.session;

// Chrome's tab-capture streamId is single-use AND short-lived. If it sits in
// storage across an SW eviction / extension reload / long idle, Chrome will
// reject it at getUserMedia time with "Error starting tab capture". We treat
// anything older than this as stale and refuse to ship it to offscreen.
const STREAM_TTL_MS = 60_000;

async function setPendingStream(streamId, tab) {
  await SESSION.set({
    pendingStreamId: streamId,
    pendingStreamAt: Date.now(),
    lastTab: tab,
  });
}
async function takePendingStream() {
  const { pendingStreamId, pendingStreamAt } = await SESSION.get([
    "pendingStreamId",
    "pendingStreamAt",
  ]);
  // Always clear — these are single-use no matter what.
  if (pendingStreamId || pendingStreamAt) {
    await SESSION.remove(["pendingStreamId", "pendingStreamAt"]);
  }
  if (!pendingStreamId) return null;
  const age = Date.now() - (pendingStreamAt || 0);
  if (age > STREAM_TTL_MS) {
    console.warn(`[PG:bg] streamId is ${age}ms old — discarding as stale`);
    return null;
  }
  return pendingStreamId;
}
async function getLastTab() {
  const { lastTab } = await SESSION.get("lastTab");
  return lastTab || null;
}

// ── Icon click: open panel SYNC first (gesture-preserving), then capture ──
//
// CRITICAL ORDERING: chrome.sidePanel.open() requires an active user gesture.
// `await` (or any microtask boundary) consumes that gesture. So we MUST call
// sidePanel.open() synchronously inside the click handler, BEFORE awaiting
// anything. getMediaStreamId doesn't need a gesture (it needs activeTab),
// so we can do it after.
chrome.action.onClicked.addListener((tab) => {
  console.log("[PG:bg] onClicked fired for tab:", tab?.id, tab?.url);
  if (!tab?.id) {
    console.warn("[PG:bg] onClicked: no tab id, bailing");
    return;
  }

  // 1. Open the side panel FIRST, synchronously. No await before this.
  chrome.sidePanel.open({ windowId: tab.windowId })
    .then(() => console.log("[PG:bg] ✓ sidePanel.open OK"))
    .catch((err) => console.error("[PG:bg] ✗ sidePanel.open failed:", err.message));

  // 2. Now do the async work in a separate function. By this point the
  //    gesture has been consumed by sidePanel.open(), but that's fine —
  //    getMediaStreamId only needs the activeTab grant, which lives until
  //    navigation/close.
  captureAndStash(tab);
});

async function captureAndStash(tab) {
  const tabInfo = {
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
    windowId: tab.windowId,
  };

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
  }

  await setPendingStream(streamId, tabInfo);
  console.log("[PG:bg] persisted streamId to session storage:", !!streamId);

  // Tell an already-open panel to refresh its state
  chrome.runtime.sendMessage({
    type: "STREAM_READY",
    tab: tabInfo,
    hasStream: !!streamId,
  }).catch(() => {});
}

// ── Offscreen document management ──
async function offscreenExists() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await offscreenExists()) {
    console.log("[PG:bg] offscreen doc already exists");
  } else {
    console.log("[PG:bg] creating offscreen doc…");
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for real-time transcription",
    });
    console.log("[PG:bg] createDocument resolved");
  }
  // PING/PONG handshake — createDocument resolves before offscreen.js's
  // top-level code runs, so we poll until the listener responds.
  const start = Date.now();
  while (Date.now() - start < 3000) {
    try {
      const r = await chrome.runtime.sendMessage({ target: "offscreen", type: "PING" });
      if (r?.pong) {
        console.log("[PG:bg] offscreen PONG in", Date.now() - start, "ms");
        offscreenReady = true;
        return;
      }
    } catch {
      /* listener not registered yet */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Offscreen doc did not become ready within 3s");
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

  // Side panel → offscreen relay for live audio-routing updates
  // (passthrough toggle, output device change). No-op if offscreen isn't
  // running yet — the offscreen doc reads settings from START_RECORDING
  // when a new session spins up.
  if (message.type === "UPDATE_AUDIO_SETTINGS") {
    offscreenExists().then((exists) => {
      if (!exists) { sendResponse({ ok: true, note: "no offscreen" }); return; }
      sendToOffscreen(
        {
          type: "UPDATE_AUDIO_SETTINGS",
          passthrough: message.passthrough,
          outputDeviceId: message.outputDeviceId,
        },
        (response) => sendResponse(response || { ok: true })
      );
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

  // Panel asks: which tab is the CURRENT session actually listening to?
  // Unlike GET_TAB_INFO this never falls back to the active tab — if the
  // captured tab is gone, we want the banner to know and say so rather than
  // point at whatever the user is currently looking at.
  if (message.type === "GET_CAPTURED_TAB") {
    (async () => {
      const lastTab = await getLastTab();
      if (!lastTab?.tabId) { sendResponse(null); return; }
      // Re-read from chrome.tabs so title updates (e.g., YouTube video change
      // inside the same tab) are reflected in the banner.
      try {
        const fresh = await chrome.tabs.get(lastTab.tabId);
        sendResponse({
          tabId: fresh.id,
          windowId: fresh.windowId,
          title: fresh.title || lastTab.title || "",
          url: fresh.url || lastTab.url || "",
          stillAlive: true,
        });
      } catch {
        // Tab was closed — report the last known info but flag it dead.
        sendResponse({ ...lastTab, stillAlive: false });
      }
    })();
    return true;
  }

  // Panel asks to focus the captured tab (user clicked the banner).
  if (message.type === "FOCUS_CAPTURED_TAB") {
    (async () => {
      const lastTab = await getLastTab();
      if (!lastTab?.tabId) { sendResponse({ ok: false, reason: "no-tab" }); return; }
      try {
        await chrome.tabs.update(lastTab.tabId, { active: true });
        if (lastTab.windowId) {
          await chrome.windows.update(lastTab.windowId, { focused: true });
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, reason: err?.message || "focus-failed" });
      }
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

async function handleStartCapture({ serverUrl, apiKeys, youtubeUrl, tabTitle, audio, installId }) {
  const streamId = await takePendingStream();
  console.log("[PG:bg] handleStartCapture: took streamId from session?", !!streamId);

  if (!streamId) {
    throw new Error(
      "No fresh capture session. Click the 🥜 icon on this YouTube tab, then click Start Listening within 60 seconds."
    );
  }

  const lastTab = await getLastTab();

  await ensureOffscreen();

  // Await the offscreen response so errors mid-setup (stale streamId, SSE
  // failure, no audio track) propagate back to the side panel. Previously
  // this was fire-and-forget — the panel would flip to "capturing" on
  // {ok:true} from background even when offscreen silently failed, which
  // forced users into a Stop → Start dance to reset. The offscreen doc's
  // response only resolves AFTER getUserMedia + AudioContext are live,
  // so {ok:true} now means capture is truly running.
  const response = await new Promise((resolve) => {
    sendToOffscreen(
      {
        type: "START_RECORDING",
        streamId,
        serverUrl,
        apiKeys,
        audio, // { passthrough, outputDeviceId } — optional; offscreen defaults to pre-v1.1 behavior
        installId: installId || "", // forwarded to backend as X-Install-Id header
        youtubeUrl: youtubeUrl || lastTab?.url || "",
        tabTitle: tabTitle || lastTab?.title || "Unknown tab",
      },
      (r) => resolve(r || { error: "Offscreen did not respond" })
    );
  });

  if (response?.error) {
    throw new Error(response.error);
  }

  return { ok: true, tabTitle: tabTitle || lastTab?.title };
}
