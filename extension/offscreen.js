/**
 * Peanut Gallery — Offscreen Audio Processor
 *
 * Invisible page that handles:
 * 1. Audio capture via getUserMedia (service workers can't use AudioContext)
 * 2. Downsampling to 16kHz PCM + streaming to server
 * 3. SSE stream parsing — forwards transcript/persona events to side panel
 */

console.log("[PG:off] offscreen.js LOADED v2");

let audioContext = null;
let mediaStream = null;
let processor = null;
let passthroughGain = null;
let sendInterval = null;
let chunkBuffer = [];
let capturing = false;
let serverUrl = "";
let sessionId = "";
let sseAbortController = null;

// ── Audio routing prefs (live-updatable via UPDATE_AUDIO_SETTINGS) ──
// passthrough: whether the user hears the tab audio through the extension.
//   Default true — matches pre-v1.1 behavior exactly.
//   Podcasters who route YouTube through OBS / a virtual cable (BlackHole,
//   VB-Audio, Loopback) should set this false to avoid doubling/echo.
// outputDeviceId: which audio device hears the passthrough. "default" = system
//   default (pre-v1.1 behavior). A specific deviceId routes via
//   AudioContext.setSinkId(), letting podcasters send passthrough to a
//   monitor-only device their recording rig doesn't capture.
let passthrough = true;
let outputDeviceId = "default";

// ── Message handler ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[PG:off] message received:", message?.type, "target:", message?.target);
  if (message.target !== "offscreen") return false;

  if (message.type === "START_RECORDING") {
    console.log("[PG:off] → START_RECORDING, serverUrl:", message.serverUrl, "streamId len:", message.streamId?.length);
    startRecording(message)
      .then(() => { console.log("[PG:off] ✓ startRecording ok"); sendResponse({ ok: true }); })
      .catch((err) => { console.error("[PG:off] ✗ startRecording err:", err.message); sendResponse({ error: err.message }); });
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

  if (message.type === "UPDATE_AUDIO_SETTINGS") {
    applyAudioSettings(message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (message.type === "PING") {
    sendResponse({ pong: true });
    return false;
  }
});
console.log("[PG:off] message listener registered");

async function startRecording(config) {
  if (capturing) {
    console.log("[PG] Already capturing, stopping first...");
    stopRecording();
  }

  // Pull initial audio routing prefs from the side panel. Fall back to
  // pre-v1.1 defaults (passthrough on, system default device) if missing so
  // older side panel builds keep working.
  passthrough = config.audio?.passthrough !== false;
  outputDeviceId = config.audio?.outputDeviceId || "default";

  // Normalize: strip trailing slash, and auto-prepend http:// if the user
  // typed "localhost:3000" instead of "http://localhost:3000". Without a
  // scheme, fetch() treats "localhost" as the scheme and errors out.
  let raw = (config.serverUrl || "").trim().replace(/\/$/, "");
  if (raw && !/^https?:\/\//i.test(raw)) raw = "http://" + raw;
  serverUrl = raw;
  console.log(`[PG] Starting capture → ${serverUrl}`);

  // We wrap the whole setup in a try/catch so that if ANY step fails after
  // partial state (SSE open, server session created, AudioContext built,
  // etc.), we clean up before throwing. Without this, an error mid-setup
  // leaves an orphan SSE stream on the server + the side panel stuck in a
  // half-started state. Root cause of the "tap stop and start again"
  // workaround users were hitting.
  try {
    // Step 1: Create server session (SSE)
    const headers = { "Content-Type": "application/json" };
    if (config.apiKeys?.deepgram) headers["X-Deepgram-Key"] = config.apiKeys.deepgram;
    if (config.apiKeys?.groq) headers["X-Groq-Key"] = config.apiKeys.groq;
    if (config.apiKeys?.anthropic) headers["X-Anthropic-Key"] = config.apiKeys.anthropic;
    if (config.apiKeys?.brave) headers["X-Brave-Key"] = config.apiKeys.brave;
    // Install-id lets the hosted backend meter shared demo-key usage per
    // installation (see docs/BUILD-YOUR-OWN-BACKEND.md §non-negotiables).
    // Self-hosters' servers ignore it when ENABLE_FREE_TIER_LIMIT is unset.
    if (config.installId) headers["X-Install-Id"] = config.installId;

    sseAbortController = new AbortController();

    const res = await fetch(`${serverUrl}/api/transcribe`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: config.youtubeUrl || "",
        mode: "browser",
        isLive: false,
        // User-chosen pace dial (1-10, default 5). Older backends ignore
        // the field, so omitting it is always safe.
        rate: Number.isFinite(config.rate) ? config.rate : 5,
        // Persona pack id (howard | twist | ...). Older backends ignore
        // the field. New servers resolve unknown/missing ids to "howard"
        // via resolvePack(), so this is always safe to send.
        packId:
          typeof config.packId === "string" && config.packId.length > 0
            ? config.packId
            : "howard",
      }),
      signal: sseAbortController.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Server error" }));
      // Preserve the server's error code by prefixing the thrown message, so
      // the side panel can recognise a 402 TRIAL_EXHAUSTED and open the keys
      // accordion instead of just showing a raw banner. Chrome runtime
      // messages drop custom Error props, so a string prefix is the reliable
      // way to carry the code across the offscreen → background → panel hop.
      const prefix = err.code ? `${err.code}:` : "";
      throw new Error(
        `${prefix}${err.error || `Server returned ${res.status}`}`
      );
    }

    sessionId = res.headers.get("X-Session-Id");
    if (!sessionId) throw new Error("No session ID returned from server");

    console.log(`[PG] Session created: ${sessionId}`);

    // Start reading the SSE body — we'll forward events once the pipeline is
    // actually live. Reading now so we don't miss any early events.
    readSSE(res.body);

    // Step 2: Capture tab audio
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: config.streamId,
          },
        },
      });
    } catch (err) {
      // Chrome's "Error starting tab capture" almost always means the streamId
      // was stale (SW evicted, extension reloaded, tab navigated, or just
      // expired). Translate into something the user can act on.
      const msg = /tab capture/i.test(err.message)
        ? "Capture token expired. Click the 🥜 icon on this YouTube tab again, then Start Listening within 60 seconds."
        : err.message;
      throw new Error(msg);
    }

    if (!mediaStream.getAudioTracks().length) {
      throw new Error("No audio track in captured stream");
    }

    console.log(`[PG] Got audio: ${mediaStream.getAudioTracks()[0].label}`);

    // Audio processing pipeline
    audioContext = new AudioContext({ sampleRate: 48000 });
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      // Always pass audio through the processor's output buffer — the
      // passthroughGain node downstream controls whether the user hears it.
      // Tab capture mutes the tab by default; this restores it when gain=1.
      event.outputBuffer.getChannelData(0).set(input);
      // Also buffer a copy for upload to the server.
      if (capturing) chunkBuffer.push(new Float32Array(input));
    };

    // Routing: source → processor → passthroughGain → destination.
    // The processor MUST have a path to destination or onaudioprocess won't
    // fire. passthroughGain stays connected always (at gain=0 when
    // passthrough is disabled) so onaudioprocess keeps firing — muting the
    // gain silences the user's ears without breaking capture.
    passthroughGain = audioContext.createGain();
    passthroughGain.gain.value = passthrough ? 1 : 0;
    source.connect(processor);
    processor.connect(passthroughGain);
    passthroughGain.connect(audioContext.destination);

    // Apply initial output device selection. Swallow failures: setSinkId is
    // only available in Chrome 110+ and some environments reject non-default
    // sinks with an unknown-device error. If it fails, we fall back silently
    // to the system default — the user still hears audio.
    if (outputDeviceId && outputDeviceId !== "default") {
      await trySetSinkId(outputDeviceId);
    }

    capturing = true;
    chunkBuffer = [];
    sendInterval = setInterval(flushAudio, 250);

    // ONLY now tell the side panel that capture is truly live. Previously
    // this fired right after SSE open, which made the panel flip to
    // "Waiting for audio..." even when getUserMedia subsequently failed and
    // the pipeline was dead.
    broadcast({
      type: "SSE_EVENT",
      event: "status",
      data: { status: "started", sessionId },
    });

    console.log("[PG] Audio capture started");
  } catch (err) {
    // Partial setup — tear it all down so the next attempt starts clean and
    // we don't leak an SSE stream / server session. stopRecording handles
    // nulls correctly so it's safe to call even if only half of the state
    // was populated.
    console.error("[PG:off] startRecording failed mid-setup, cleaning up:", err.message);
    stopRecording();
    throw err;
  }
}

function stopRecording() {
  console.log("[PG] Stopping capture...");
  capturing = false;

  if (sendInterval) { clearInterval(sendInterval); sendInterval = null; }
  flushAudio();

  if (processor) { processor.disconnect(); processor = null; }
  if (passthroughGain) { passthroughGain.disconnect(); passthroughGain = null; }
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

/**
 * Live-update audio routing without restarting capture. Called by the side
 * panel when the user toggles passthrough or picks a different output device
 * mid-session. Returns quietly if no session is active — the new values are
 * still cached so the next startRecording() picks them up.
 */
async function applyAudioSettings(msg) {
  if (typeof msg.passthrough === "boolean") {
    passthrough = msg.passthrough;
    if (passthroughGain) passthroughGain.gain.value = passthrough ? 1 : 0;
  }
  if (typeof msg.outputDeviceId === "string") {
    outputDeviceId = msg.outputDeviceId;
    if (audioContext) {
      await trySetSinkId(outputDeviceId);
    }
  }
  console.log("[PG:off] audio settings applied:", { passthrough, outputDeviceId });
}

/**
 * Try to route AudioContext output to a specific device. Available in
 * Chrome 110+. Failure is non-fatal — we log and keep the previous sink.
 * The special value "default" means "system default device".
 */
async function trySetSinkId(deviceId) {
  try {
    if (!audioContext) return;
    if (typeof audioContext.setSinkId !== "function") {
      console.warn("[PG:off] audioContext.setSinkId unavailable — using default device");
      return;
    }
    const target = deviceId === "default" ? "" : deviceId;
    await audioContext.setSinkId(target);
    console.log("[PG:off] ✓ setSinkId OK:", deviceId);
  } catch (err) {
    console.warn("[PG:off] setSinkId failed, keeping previous sink:", err.message);
  }
}
