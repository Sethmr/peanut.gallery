/**
 * Peanut Gallery — Offscreen Audio Processor
 *
 * Invisible page that handles:
 * 1. Audio capture via getUserMedia (service workers can't use AudioContext)
 * 2. Downsampling to 16kHz PCM + streaming to server
 * 3. SSE stream parsing — forwards transcript/persona events to side panel
 */

let audioContext = null;
let mediaStream = null;
let processor = null;
let sendInterval = null;
let chunkBuffer = [];
let capturing = false;
let serverUrl = "";
let sessionId = "";
let sseAbortController = null;

// ── Message handler ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  if (message.type === "START_RECORDING") {
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "STOP_RECORDING") {
    stopRecording();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "QUERY_STATUS") {
    sendResponse({ capturing, serverUrl, sessionId });
    return false;
  }
});

async function startRecording(config) {
  if (capturing) {
    console.log("[PG] Already capturing, stopping first...");
    stopRecording();
  }

  serverUrl = config.serverUrl.replace(/\/$/, "");
  console.log(`[PG] Starting capture → ${serverUrl}`);

  // Step 1: Create server session (SSE)
  const headers = { "Content-Type": "application/json" };
  if (config.apiKeys?.deepgram) headers["X-Deepgram-Key"] = config.apiKeys.deepgram;
  if (config.apiKeys?.groq) headers["X-Groq-Key"] = config.apiKeys.groq;
  if (config.apiKeys?.anthropic) headers["X-Anthropic-Key"] = config.apiKeys.anthropic;
  if (config.apiKeys?.brave) headers["X-Brave-Key"] = config.apiKeys.brave;

  sseAbortController = new AbortController();

  const res = await fetch(`${serverUrl}/api/transcribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: config.youtubeUrl || "",
      mode: "browser",
      isLive: false,
    }),
    signal: sseAbortController.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Server error" }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }

  sessionId = res.headers.get("X-Session-Id");
  if (!sessionId) throw new Error("No session ID returned from server");

  console.log(`[PG] Session created: ${sessionId}`);
  chrome.storage.local.set({ sessionId });

  // Broadcast session start to side panel
  broadcast({ type: "SSE_EVENT", event: "status", data: { status: "started", sessionId } });

  // Parse SSE stream and forward events to side panel
  readSSE(res.body);

  // Step 2: Capture tab audio
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: config.streamId,
      },
    },
  });

  if (!mediaStream.getAudioTracks().length) {
    throw new Error("No audio track in captured stream");
  }

  console.log(`[PG] Got audio: ${mediaStream.getAudioTracks()[0].label}`);

  // Audio processing pipeline
  audioContext = new AudioContext({ sampleRate: 48000 });
  const source = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    if (!capturing) return;
    chunkBuffer.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  // source → processor → destination
  // Connecting to destination keeps audio audible in the captured tab
  source.connect(processor);
  processor.connect(audioContext.destination);

  capturing = true;
  chunkBuffer = [];
  sendInterval = setInterval(flushAudio, 250);

  console.log("[PG] Audio capture started");
}

function stopRecording() {
  console.log("[PG] Stopping capture...");
  capturing = false;

  if (sendInterval) { clearInterval(sendInterval); sendInterval = null; }
  flushAudio();

  if (processor) { processor.disconnect(); processor = null; }
  if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
  if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
  if (sseAbortController) { sseAbortController.abort(); sseAbortController = null; }

  // Tell server to stop
  if (serverUrl && sessionId) {
    fetch(`${serverUrl}/api/transcribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }

  broadcast({ type: "SSE_EVENT", event: "status", data: { status: "stopped" } });

  chunkBuffer = [];
  sessionId = "";
  console.log("[PG] Capture stopped");
}

/** Broadcast a message to all extension contexts (side panel, background, etc.) */
function broadcast(msg) {
  // chrome.runtime.sendMessage delivers to all listeners in the extension
  // (side panel, background, etc.) — no target needed
  chrome.runtime.sendMessage(msg).catch(() => {
    // No listeners yet (side panel may not be open) — that's fine
  });
}

/**
 * Parse SSE stream from server and forward each event to the side panel.
 */
async function readSSE(body) {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            broadcast({ type: "SSE_EVENT", event: eventType, data });
          } catch {
            // Malformed JSON — skip
          }
          eventType = "";
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("[PG] SSE read error:", err);
    }
  }
}

/**
 * Flush buffered audio → downsample → PCM → base64 → server PATCH
 */
function flushAudio() {
  if (chunkBuffer.length === 0 || !serverUrl || !sessionId) return;

  const chunks = chunkBuffer;
  chunkBuffer = [];

  // Merge
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

  // Downsample 48kHz → 16kHz
  const ratio = (audioContext?.sampleRate || 48000) / 16000;
  const downsampled = new Float32Array(Math.floor(merged.length / ratio));
  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = merged[Math.floor(i * ratio)];
  }

  // Float32 → Int16 PCM
  const pcm = new Int16Array(downsampled.length);
  for (let i = 0; i < downsampled.length; i++) {
    const s = Math.max(-1, Math.min(1, downsampled[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Base64
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  if (base64.length > 0) {
    fetch(`${serverUrl}/api/transcribe`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "audio_chunk", audio: base64 }),
    }).catch(() => {});
  }
}
