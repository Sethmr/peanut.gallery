/**
 * Peanut Gallery — Chrome Extension Service Worker
 *
 * Orchestrates tab audio capture via chrome.tabCapture API.
 * Audio processing happens in an offscreen document (service workers can't use AudioContext).
 */

let offscreenReady = false;

// Create offscreen document for audio processing
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_CAPTURE") {
    handleStartCapture(message).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true; // async response
  }

  if (message.type === "STOP_CAPTURE") {
    // Forward to offscreen document only (not back to ourselves)
    sendToOffscreen({ type: "STOP_RECORDING" });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "GET_STATUS") {
    sendToOffscreen({ type: "QUERY_STATUS" }, (response) => {
      sendResponse(response || { capturing: false });
    });
    return true;
  }
});

/** Send a message specifically to the offscreen document via its port or targeted messaging */
function sendToOffscreen(msg, callback) {
  // Use chrome.runtime.sendMessage — the offscreen doc listens on the same channel.
  // We differentiate by having the offscreen doc check message.target === "offscreen"
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

  // Ensure offscreen document exists
  await ensureOffscreen();

  // Tell offscreen document to start recording with this stream ID
  // The offscreen doc will create the server session and start streaming audio
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
