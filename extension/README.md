# Peanut Gallery Chrome Extension

Companion Chrome extension that captures tab audio for real-time AI commentary. Uses the `chrome.tabCapture` API — no screen share picker, no interference with YouTube playback.

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `extension/` folder

## Usage

1. Start Peanut Gallery (`npm run dev` or visit peanut.gallery)
2. Open a YouTube video in another tab
3. Click the 🥜 extension icon on the YouTube tab
4. Set your server URL (default: `http://localhost:3000`)
5. Click **Start Capturing This Tab**

The extension silently captures the tab's audio and streams it to your Peanut Gallery server. No screen share dialog, no interference with video playback.

## How It Works

- **Service Worker** (`background.js`) — Gets a `tabCapture` stream ID when you click Start
- **Offscreen Document** (`offscreen.js`) — Processes audio (getUserMedia → AudioContext → PCM 16kHz → base64 → HTTP PATCH)
- **Popup** (`popup.html/js`) — Start/stop UI, settings persistence

The extension creates a server session, captures tab audio, downsamples to 16kHz mono PCM, and streams chunks to the Peanut Gallery server every 250ms. The server passes them straight to Deepgram for real-time transcription.

## Why a Chrome Extension?

Every production real-time transcription tool (Otter.ai, Fireflies, Recall.ai, Tactiq) uses `chrome.tabCapture` because it's the only API that:

- Captures tab audio without a permission picker dialog
- Doesn't interfere with YouTube playback (unlike `getDisplayMedia` tab capture)
- Works identically on localhost and deployed servers
- Requires only a single click to activate
