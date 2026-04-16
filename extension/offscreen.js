/**
 * Peanut Gallery — Offscreen Audio Processor
 *
 * Runs in an offscreen document (invisible page) so we can use AudioContext,
 * which service workers can't do. Captures tab audio via getUserMedia with
 * the stream ID from chrome.tabCapture, downsamples to 16kHz PCM, and
 * streams base64-encoded chunks to the Peanut Gallery server every 250ms.
 *
 * Also manages the SSE connection to the server for the session lifecycle.
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

// Listen for messages — only handle ones targeted at us
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only process messages meant for the offscreen document
  if (message.target !== "offscreen") return false;

  if (message.type === "START_RECORDING") {
    startRecording(message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // async
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
    console.log("[PG Extension] Already capturing, stopping first...");
    stopRecording();
  }

  serverUrl = config.serverUrl.replace(/\/$/, "");

  console.log(`[PG Extension] Starting capture...`);
  console.log(`[PG Extension] Server: ${serverUrl}`);

  // Step 1: Create a session on the Peanut Gallery server
  const headers = { "Content-Type": "application/json" };
  if (config.apiKeys?.deepgram) headers["X-Deepgram-Key"] = config.apiKeys.deepgram;
  if (config.apiKeys?.groq) headers["X-Groq-Key"] = config.apiKeys.groq;

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
  if (!sessionId) {
    throw new Error("No session ID returned from server");
  }

  console.log(`[PG Extension] Session created: ${sessionId}`);

  // Save session ID
  chrome.storage.local.set({ sessionId });

  // Read SSE stream in background (keeps connection alive)
  readSSE(res.body);

  // Step 2: Get the actual MediaStream from the tab capture stream ID
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

  console.log(`[PG Extension] Got audio stream: ${mediaStream.getAudioTracks()[0].label}`);

  // Set up AudioContext for processing
  audioContext = new AudioContext({ sampleRate: 48000 });
  const source = audioContext.createMediaStreamSource(mediaStream);

  // ScriptProcessorNode to intercept raw audio frames
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    if (!capturing) return;
    const inputData = event.inputBuffer.getChannelData(0);
    chunkBuffer.push(new Float32Array(inputData));
  };

  // Connect: source → processor → destination (must connect for onaudioprocess to fire)
  // The offscreen document is invisible, so audio goes nowhere audible
  source.connect(processor);
  processor.connect(audioContext.destination);

  capturing = true;
  chunkBuffer = [];

  // Send accumulated audio to server every 250ms
  sendInterval = setInterval(flushAudio, 250);

  console.log("[PG Extension] Audio capture started successfully");
}

function stopRecording() {
  console.log("[PG Extension] Stopping capture...");
  capturing = false;

  if (sendInterval) {
    clearInterval(sendInterval);
    sendInterval = null;
  }

  // Flush any remaining audio
  flushAudio();

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  // Stop SSE connection
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }

  // Tell server to stop the session
  if (serverUrl && sessionId) {
    fetch(`${serverUrl}/api/transcribe`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }

  chunkBuffer = [];
  sessionId = "";
  console.log("[PG Extension] Capture stopped");
}

/**
 * Read the SSE stream to keep the server session alive.
 * We don't need to process the events here — the web UI does that.
 * But the fetch body must be consumed to keep the connection open.
 */
async function readSSE(body) {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Log SSE events for debugging
      const text = decoder.decode(value, { stream: true });
      if (text.includes("event: error")) {
        console.warn("[PG Extension] SSE error:", text);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("[PG Extension] SSE read error:", err);
    }
  }
}

/**
 * Flush accumulated audio chunks to the server.
 * Merges all buffered Float32 frames, downsamples from 48kHz to 16kHz,
 * converts to Int16 PCM, base64-encodes, and sends via PATCH.
 */
function flushAudio() {
  if (chunkBuffer.length === 0 || !serverUrl || !sessionId) return;

  const chunks = chunkBuffer;
  chunkBuffer = [];

  // Merge all chunks into one Float32Array
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  // Downsample from 48kHz to 16kHz (ratio 3:1)
  const sourceSampleRate = audioContext?.sampleRate || 48000;
  const targetSampleRate = 16000;
  const ratio = sourceSampleRate / targetSampleRate;
  const downsampled = new Float32Array(Math.floor(merged.length / ratio));

  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = merged[Math.floor(i * ratio)];
  }

  // Convert Float32 (-1.0 to 1.0) to Int16 PCM
  const pcm = new Int16Array(downsampled.length);
  for (let i = 0; i < downsampled.length; i++) {
    const s = Math.max(-1, Math.min(1, downsampled[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Base64-encode the PCM data
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Send to server
  if (base64.length > 0) {
    fetch(`${serverUrl}/api/transcribe`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        action: "audio_chunk",
        audio: base64,
      }),
    }).catch((err) => {
      console.debug("[PG Extension] Audio send failed:", err.message);
    });
  }
}
