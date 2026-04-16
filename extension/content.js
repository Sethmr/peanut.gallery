/**
 * Peanut Gallery — Content Script
 *
 * Injected into the Peanut Gallery web app to bridge session info
 * between the web UI and the Chrome extension.
 *
 * The web app exposes session data via a DOM element with id="pg-extension-bridge".
 * This script reads that data and makes it available to the extension popup.
 */

// Listen for requests from the popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PAGE_SESSION") {
    const bridge = document.getElementById("pg-extension-bridge");
    if (bridge) {
      try {
        const data = JSON.parse(bridge.dataset.session || "{}");
        sendResponse(data);
      } catch {
        sendResponse({ error: "Failed to parse session data" });
      }
    } else {
      sendResponse({ error: "No Peanut Gallery session found on this page" });
    }
    return false;
  }
});
