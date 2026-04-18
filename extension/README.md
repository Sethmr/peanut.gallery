# Peanut Gallery Chrome Extension

AI podcast sidebar that lives right next to your YouTube video. Uses `chrome.tabCapture` for silent audio capture and `chrome.sidePanel` for the gallery UI — no screen share picker, no interference with playback, no second tab needed.

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `extension/` folder

## Usage

1. Start the Peanut Gallery server (`npm run dev`)
2. Open a YouTube video
3. Click the 🥜 extension icon — the side panel opens
4. Set your server URL + API keys — Deepgram, Anthropic, xAI (optional: Brave Search, used when the search-engine dropdown is set to "brave"). Saved in `chrome.storage.local` between sessions.
5. Pick a pack from the dropdown — **Howard** (default: Baba Booey, The Troll, Fred Norris, Jackie Martling) or **TWiST** (Molly Wood, Jason Calacanis, Lon Harris, Alex Wilhelm).
6. Click **Start Listening**

Four AI personas react in real-time in the sidebar while you watch. Pack choice applies on the next Start Listening — mid-session swaps are intentionally not supported (same reason the response-rate dial is setup-time only).

## Architecture

```
YouTube Tab                    Extension Side Panel
    │                               │
    │ chrome.tabCapture             │ Shows transcript +
    │ (silent, no picker)           │ persona reactions
    ▼                               │
┌──────────┐                        │
│ Offscreen │── SSE events ────────▶│
│ Document  │                       │
│           │── PCM audio ──────▶ Server ──▶ Deepgram ──▶ AI Personas
└──────────┘
```

- **Background** (`background.js`) — Service worker. Opens side panel on click, gets `tabCapture` stream ID, manages offscreen document.
- **Offscreen** (`offscreen.js`) — Invisible page. Captures audio via `getUserMedia`, downsamples to 16kHz PCM, streams to server every 250ms. Parses SSE events and broadcasts to side panel.
- **Side Panel** (`sidepanel.html/js`) — The gallery UI. Shows persona avatars, transcript, and a feed of AI reactions. Click a persona to make them react.

## Why Chrome Extension?

Every production transcription tool (Otter.ai, Fireflies, Recall.ai, Tactiq) uses `chrome.tabCapture` because it's the only API that captures tab audio without a permission picker and without YouTube detecting it. The Side Panel API makes the experience feel native — it's literally a sidebar next to the video.
