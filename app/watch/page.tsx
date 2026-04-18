"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import PersonaColumn, { type PersonaMessage } from "@/components/PersonaColumn";
import CombinedFeed, { type FeedEntry } from "@/components/CombinedFeed";
import PersonaIcon from "@/components/PersonaIcon";
import ApiKeysModal, { type ApiKeys, loadApiKeys, hasRequiredKeys } from "@/components/ApiKeysModal";
import YouTubePlayer, {
  extractVideoId,
  type YouTubePlayerHandle,
} from "@/components/YouTubePlayer";
import { personas } from "@/lib/personas";

// ──────────────────────────────────────────────────────
// MODE RULES
//
// LIVE MODE:
//   - No pause button (you can't pause a live show)
//   - No YouTube player controls override — video stays at live edge
//   - Red accent theme, pulsing "LIVE" badge, urgency cues
//   - "End Session" instead of "Stop"
//   - Transcript header: "LIVE TRANSCRIPT" with red pulse dot
//   - Producer gets "LIVE FACT-CHECK" label
//
// RECORDED MODE:
//   - Pause/Resume button syncs video + pipeline
//   - YouTube player has full controls
//   - Blue accent theme, calmer feel
//   - "Stop" button
//   - Transcript header: "TRANSCRIPT" with blue dot
// ──────────────────────────────────────────────────────

const modelDisplay: Record<string, string> = {
  "claude-haiku": "Claude Haiku",
  "xai-grok-4-fast": "xAI · Grok 4.1 Fast",
};

interface PersonaState {
  messages: PersonaMessage[];
  isStreaming: boolean;
  streamingText: string;
}

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ deepgram: "", anthropic: "", xai: "", brave: "" });

  // Audio capture mode: "server" = yt-dlp, "extension" = Chrome extension tab capture
  const [captureMode, setCaptureMode] = useState<"server" | "extension">("server");
  const [serverHasYtdlp, setServerHasYtdlp] = useState<boolean | null>(null);

  const playerRef = useRef<YouTubePlayerHandle>(null);

  // Load keys from localStorage on mount + check server capabilities
  useEffect(() => {
    const saved = loadApiKeys();
    setApiKeys(saved);
    // Auto-open modal if no keys configured
    if (!hasRequiredKeys(saved)) setShowKeysModal(true);

    // Check if server has yt-dlp available
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        const hasYtdlp = data.binaries?.["yt-dlp"]?.found === true;
        setServerHasYtdlp(hasYtdlp);
        // Default to extension mode if yt-dlp not available
        if (!hasYtdlp) setCaptureMode("extension");
      })
      .catch(() => {
        setServerHasYtdlp(false);
        setCaptureMode("extension");
      });
  }, []);

  // Per-persona state
  const [personaStates, setPersonaStates] = useState<
    Record<string, PersonaState>
  >(() => {
    const initial: Record<string, PersonaState> = {};
    for (const p of personas) {
      initial[p.id] = { messages: [], isStreaming: false, streamingText: "" };
    }
    return initial;
  });

  // Combined feed — all persona messages interleaved chronologically
  const [combinedFeed, setCombinedFeed] = useState<FeedEntry[]>([]);

  // Per-persona "awaiting response" state — true from the moment the user taps
  // the avatar until the matching persona_done event arrives (or 15s timeout).
  // Drives the icon-to-spinner crossfade on the avatar glyph.
  const [firingPersonaIds, setFiringPersonaIds] = useState<Record<string, boolean>>({});
  const firingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);

  // Clear any pending firing timeouts on unmount so we don't leak timers.
  useEffect(() => {
    const timeouts = firingTimeoutsRef.current;
    return () => {
      for (const t of Object.values(timeouts)) clearTimeout(t);
    };
  }, []);

  const clearFiring = useCallback((pid: string) => {
    const t = firingTimeoutsRef.current[pid];
    if (t) {
      clearTimeout(t);
      delete firingTimeoutsRef.current[pid];
    }
    setFiringPersonaIds((prev) => {
      if (!prev[pid]) return prev;
      const next = { ...prev };
      delete next[pid];
      return next;
    });
  }, []);

  // Determine which persona is currently streaming (for combined feed)
  const streamingPersona = useMemo(() => {
    for (const p of personas) {
      const state = personaStates[p.id];
      if (state?.isStreaming && state.streamingText) {
        return { id: p.id, name: p.name, emoji: p.emoji, color: p.color };
      }
    }
    return null;
  }, [personaStates]);

  // ──────────────────────────────────────────────────────
  // ACTIONS
  // ──────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!youtubeUrl.trim()) return;

    const vid = extractVideoId(youtubeUrl);
    if (!vid) {
      setError("Couldn't parse a YouTube video ID from that URL");
      return;
    }
    setVideoId(vid);

    setError(null);
    setIsConnecting(true);
    setIsPaused(false);
    setIsLive(false);
    setStatusDetail(null);
    setTranscriptText("");
    setInterimText("");
    setPipelineStages([]);
    setCombinedFeed([]);

    // Reset persona states
    setPersonaStates((prev) => {
      const reset: Record<string, PersonaState> = {};
      for (const id of Object.keys(prev)) {
        reset[id] = { messages: [], isStreaming: false, streamingText: "" };
      }
      return reset;
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (!hasRequiredKeys(apiKeys)) {
        setShowKeysModal(true);
        setIsConnecting(false);
        return;
      }

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Deepgram-Key": apiKeys.deepgram,
          "X-Anthropic-Key": apiKeys.anthropic,
          "X-XAI-Key": apiKeys.xai,
          "X-Brave-Key": apiKeys.brave,
        },
        body: JSON.stringify({
          url: youtubeUrl,
          mode: captureMode === "extension" ? "browser" : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start");
      }

      setIsRunning(true);
      setIsConnecting(false);

      // Auto-play the video once pipeline is connected
      setTimeout(() => playerRef.current?.play(), 500);

      // SSE stream reader
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const streamBuffers: Record<string, string> = {};

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);

              switch (eventType) {
                case "transcript":
                  if (data.isFinal) {
                    setTranscriptText((prev) =>
                      (prev + " " + data.text).trim().slice(-500)
                    );
                    setInterimText("");
                  } else {
                    setInterimText(data.text);
                  }
                  break;

                case "persona": {
                  const pid = data.personaId;
                  if (!streamBuffers[pid]) streamBuffers[pid] = "";
                  streamBuffers[pid] += data.text;
                  setPersonaStates((prev) => ({
                    ...prev,
                    [pid]: {
                      ...prev[pid],
                      isStreaming: true,
                      streamingText: streamBuffers[pid],
                    },
                  }));
                  break;
                }

                case "persona_done": {
                  const pid = data.personaId;
                  const finalText = streamBuffers[pid] || "";
                  streamBuffers[pid] = "";
                  // Clear the "awaiting" spinner on this persona's avatar —
                  // regardless of whether the response was substantive or a "-".
                  clearFiring(pid);
                  if (finalText.trim()) {
                    const msgId = `${pid}-${messageCountRef.current++}`;
                    const now = Date.now();
                    const msg: PersonaMessage = {
                      id: msgId,
                      text: finalText.trim(),
                      timestamp: now,
                    };
                    setPersonaStates((prev) => ({
                      ...prev,
                      [pid]: {
                        messages: [...prev[pid].messages, msg],
                        isStreaming: false,
                        streamingText: "",
                      },
                    }));
                    // Also push to the combined feed
                    const p = personas.find((p) => p.id === pid);
                    if (p) {
                      setCombinedFeed((prev) => [
                        ...prev,
                        {
                          id: msgId,
                          personaId: pid,
                          personaName: p.name,
                          personaEmoji: p.emoji,
                          personaColor: p.color,
                          text: finalText.trim(),
                          timestamp: now,
                        },
                      ]);
                    }
                  } else {
                    setPersonaStates((prev) => ({
                      ...prev,
                      [pid]: {
                        ...prev[pid],
                        isStreaming: false,
                        streamingText: "",
                      },
                    }));
                  }
                  break;
                }

                case "error":
                  setError(data.message);
                  break;

                case "status":
                  if (data.status === "started" && data.sessionId) {
                    sessionIdRef.current = data.sessionId;
                    // Expose session ID to Chrome extension via DOM bridge
                    const bridge = document.getElementById("pg-extension-bridge");
                    if (bridge) {
                      bridge.dataset.session = JSON.stringify({
                        sessionId: data.sessionId,
                        serverUrl: window.location.origin,
                      });
                    }
                  }
                  if (data.status === "live_detected") {
                    setIsLive(data.isLive);
                  }
                  if (data.status === "detail") {
                    setStatusDetail(data.message);
                    // Accumulate pipeline stages so user can see progress
                    setPipelineStages((prev) => [...prev.slice(-8), data.message]);
                    // Clear the top-bar banner after 5s, but stages persist in transcript area
                    setTimeout(() => setStatusDetail(null), 5000);
                  }
                  if (data.status === "stopped") {
                    setIsRunning(false);
                  }
                  break;
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      setIsConnecting(false);
    }
  }, [youtubeUrl]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    playerRef.current?.pause();
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  // RECORDED MODE ONLY — pause/resume video + pipeline
  const handlePauseResume = useCallback(async () => {
    if (isLive) return; // never pause live

    const sid = sessionIdRef.current;
    if (isPaused) {
      playerRef.current?.play();
      setIsPaused(false);
      if (sid) {
        fetch("/api/transcribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, action: "resume" }),
        }).catch(() => {});
      }
    } else {
      playerRef.current?.pause();
      setIsPaused(true);
      if (sid) {
        fetch("/api/transcribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, action: "pause" }),
        }).catch(() => {});
      }
    }
  }, [isPaused, isLive]);

  // Force-fire personas manually (debug + fallback)
  const handleForceFire = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await fetch("/api/transcribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, action: "force_fire" }),
      });
    } catch {
      // ignore
    }
  }, []);

  // Fire a SINGLE persona on demand (glyph tap). Flips that persona's avatar
  // to a spinner until the matching persona_done event arrives — or a 15s
  // safety timeout fires so the UI never sits stuck on a spinner.
  const handleFirePersona = useCallback(
    async (personaId: string) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      if (firingPersonaIds[personaId]) return; // debounce — tap already in-flight

      setFiringPersonaIds((prev) => ({ ...prev, [personaId]: true }));
      // Safety net: 15s matches the extension's FORCE_REACT_TIMEOUT_MS.
      if (firingTimeoutsRef.current[personaId]) {
        clearTimeout(firingTimeoutsRef.current[personaId]);
      }
      firingTimeoutsRef.current[personaId] = setTimeout(() => {
        clearFiring(personaId);
      }, 15000);

      try {
        await fetch("/api/transcribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, action: "fire_persona", personaId }),
        });
      } catch {
        // Network error — don't leave the spinner stuck on the avatar.
        clearFiring(personaId);
      }
    },
    [firingPersonaIds, clearFiring]
  );

  // Sync when user uses YouTube's native controls
  const handleVideoStateChange = useCallback(
    (isPlaying: boolean) => {
      if (isLive) return; // ignore in live mode — video stays at edge

      const sid = sessionIdRef.current;
      setIsPaused(!isPlaying);
      if (sid) {
        fetch("/api/transcribe", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            action: isPlaying ? "resume" : "pause",
          }),
        }).catch(() => {});
      }
    },
    [isLive]
  );

  // ──────────────────────────────────────────────────────
  // RESPONSIVE LAYOUT
  // ──────────────────────────────────────────────────────

  type LayoutMode = "wide" | "compact" | "mobile";
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("wide");

  useEffect(() => {
    function updateLayout() {
      const w = window.innerWidth;
      if (w < 768) setLayoutMode("mobile");
      else if (w < 1400) setLayoutMode("compact");
      else setLayoutMode("wide");
    }
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // ──────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────

  // Mode-aware accent color
  const modeAccent = isLive && isRunning ? "red" : "blue";

  return (
    <div className="h-screen flex flex-col">
      {/* DOM bridge for Chrome extension */}
      <div id="pg-extension-bridge" style={{ display: "none" }} />

      {/* Legacy-page CTA banner — funnels /watch traffic to the CWS listing.
          /watch is the legacy reference web app (see project memory); this
          nudges visitors toward the real product without rebuilding the page. */}
      <a
        href="https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-accent-blue/10 border-b border-accent-blue/20 px-4 py-2 text-xs text-center text-accent-blue/90 hover:bg-accent-blue/15 transition-colors"
      >
        <span className="font-semibold">This is the reference web app.</span>{" "}
        For live AI reactions while you watch any YouTube video, get the Chrome extension →
      </a>

      {/* ── TOP BAR ── */}
      <header
        className={`flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 sm:py-3 bg-bg-secondary border-b transition-colors ${
          isLive && isRunning
            ? "border-red-500/20"
            : "border-white/5"
        }`}
      >
        {/* Logo + Live Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <a href="/" className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity">
            <span className="text-lg sm:text-xl">🥜</span>
            {layoutMode !== "mobile" && (
              <h1 className="font-display font-bold text-base text-white/90">
                Peanut Gallery
              </h1>
            )}
          </a>
          {isRunning && isLive && (
            <span className="live-badge flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 live-pulse" />
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest font-semibold">
                Live
              </span>
            </span>
          )}
          {isRunning && !isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-blue/10 border border-accent-blue/20 rounded-full">
              <span className="text-[10px] font-mono text-accent-blue/70 uppercase tracking-wider">
                Recorded
              </span>
            </span>
          )}
        </div>

        {/* URL Input + Controls */}
        <div className="flex-1 flex items-center gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Paste YouTube URL (live or recorded)..."
            className="flex-1 bg-bg-tertiary border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
            disabled={isRunning}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isRunning) handleStart();
            }}
          />

          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={isConnecting || !youtubeUrl.trim()}
              className="px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded-lg hover:bg-accent-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isConnecting ? "Connecting..." : "Start"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* RECORDED ONLY: Pause / Resume */}
              {!isLive && (
                <button
                  onClick={handlePauseResume}
                  className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all ${
                    isPaused
                      ? "bg-accent-amber hover:bg-accent-amber/80"
                      : "bg-white/10 hover:bg-white/15"
                  }`}
                >
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>
              )}

              {/* Force Fire — manual trigger for personas */}
              <button
                onClick={handleForceFire}
                className="px-3 py-2 bg-accent-amber/20 hover:bg-accent-amber/30 text-accent-amber text-sm font-medium rounded-lg transition-all"
                title="Force all personas to react to the latest transcript now"
              >
                🔥 React
              </button>

              {/* Stop / End Session */}
              <button
                onClick={handleStop}
                className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-all ${
                  isLive
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-accent-red hover:bg-accent-red/80"
                }`}
              >
                {isLive ? "End Session" : "Stop"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCaptureMode("server")}
              disabled={isRunning}
              className={`px-2 py-1 text-[10px] rounded transition-all ${
                captureMode === "server"
                  ? "bg-white/10 text-white/70"
                  : "text-white/25 hover:text-white/40"
              } ${!serverHasYtdlp ? "opacity-30" : ""}`}
              title={serverHasYtdlp ? "Server-side audio (yt-dlp)" : "yt-dlp not available on this server"}
            >
              Server
            </button>
            <button
              onClick={() => setCaptureMode("extension")}
              disabled={isRunning}
              className={`px-2 py-1 text-[10px] rounded transition-all ${
                captureMode === "extension"
                  ? "bg-white/10 text-white/70"
                  : "text-white/25 hover:text-white/40"
              }`}
              title="Chrome extension tab capture"
            >
              Extension
            </button>
          </div>
          <button
            onClick={() => setShowKeysModal(true)}
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            {hasRequiredKeys(apiKeys) ? "API Keys" : "Set API Keys"}
          </button>
          <a
            href="https://github.com/Sethmr/peanut.gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-500 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── EXTENSION MODE BANNER ── */}
      {isRunning && captureMode === "extension" && !transcriptText && (
        <div className="bg-accent-blue/5 border-b border-accent-blue/10 px-4 py-2 text-xs text-accent-blue/70 flex items-center gap-2">
          <span>🧩</span>
          <span>
            Session <strong className="font-mono text-white/50">{sessionIdRef.current || "..."}</strong> ready —{" "}
            click the <strong>Peanut Gallery extension</strong> on your YouTube tab to start audio capture
          </span>
        </div>
      )}

      {/* ── STATUS DETAIL ── */}
      {statusDetail && (
        <div
          className={`border-b px-4 py-1.5 text-[11px] font-mono transition-colors ${
            isLive
              ? "bg-red-500/5 border-red-500/10 text-red-400/70"
              : "bg-accent-blue/5 border-accent-blue/10 text-accent-blue/70"
          }`}
        >
          {statusDetail}
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      {layoutMode === "wide" ? (
        /* ═══ WIDE LAYOUT (≥1400px) ═══ */
        <main className="flex-1 flex gap-3 p-3 min-h-0">
          {/* Left Column: Video + Transcript */}
          <div className="w-[510px] shrink-0 flex flex-col gap-3">
            <div
              className={`bg-bg-secondary rounded-xl overflow-hidden border transition-colors ${
                isLive && isRunning
                  ? "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                  : "border-white/5"
              }`}
            >
              {videoId ? (
                <YouTubePlayer ref={playerRef} videoId={videoId} onStateChange={handleVideoStateChange} />
              ) : (
                <div className="flex items-center justify-center bg-black/50 text-white/20 text-sm" style={{ aspectRatio: "16/9" }}>
                  <div className="text-center"><span className="text-3xl block mb-2">📺</span>Paste a URL and hit Start</div>
                </div>
              )}
            </div>
            <div className={`flex-1 bg-bg-secondary rounded-xl border p-3 overflow-y-auto persona-scroll transition-colors ${isLive && isRunning ? "border-red-500/10" : "border-white/5"}`}>
              <div className="flex items-center gap-2 mb-2">
                {isLive && isRunning ? (
                  <><span className="w-2 h-2 rounded-full bg-red-500 live-pulse" /><span className="text-[10px] text-red-400/80 font-mono uppercase tracking-widest font-semibold">Live Transcript</span></>
                ) : (
                  <><span className="text-sm">📝</span><span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">Transcript</span>{isRunning && !isPaused && <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />}{isPaused && <span className="text-[10px] text-accent-amber font-mono uppercase tracking-wider">Paused</span>}</>
                )}
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                {transcriptText && <span>{transcriptText} </span>}
                {interimText && <span className="text-white/30 italic">{interimText}</span>}
                {!transcriptText && !interimText && (
                  <span className="text-white/20">
                    {isRunning ? (pipelineStages.length > 0 ? <span className="flex flex-col gap-1">{pipelineStages.map((stage, i) => <span key={i} className={i === pipelineStages.length - 1 ? "text-white/40" : "text-white/15"}>{stage}</span>)}</span> : isLive ? "Waiting for audio from live stream..." : "Connecting to pipeline...") : "Transcript will appear here..."}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Center: The Gallery */}
          <div className="flex-1 min-w-0 min-h-0">
            <CombinedFeed entries={combinedFeed} streamingPersonaId={streamingPersona?.id ?? null} streamingPersonaName={streamingPersona?.name ?? ""} streamingPersonaEmoji={streamingPersona?.emoji ?? ""} streamingPersonaColor={streamingPersona?.color ?? ""} streamingText={streamingPersona ? personaStates[streamingPersona.id]?.streamingText || "" : ""} />
          </div>

          {/* Right: Persona Cards (2x2) */}
          <div className="w-[520px] shrink-0 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">
            {personas.map((p) => (
              <PersonaColumn key={p.id} name={p.name} role={p.role} emoji={p.emoji} personaId={p.id} color={p.color} model={modelDisplay[p.model] || p.model} messages={personaStates[p.id]?.messages || []} isStreaming={personaStates[p.id]?.isStreaming || false} streamingText={personaStates[p.id]?.streamingText || ""} badge={isLive && isRunning && p.id === "producer" ? "LIVE FACT-CHECK" : undefined} compact onAvatarClick={() => handleFirePersona(p.id)} isFiring={!!firingPersonaIds[p.id]} />
            ))}
          </div>
        </main>
      ) : layoutMode === "compact" ? (
        /* ═══ COMPACT / SIDEBAR MODE (768–1399px) ═══ */
        <main className="flex-1 flex flex-col min-h-0 p-3 gap-3">
          {/* Top: Persona bubbles — centered horizontally */}
          <div className="flex justify-center gap-4 shrink-0 py-1">
            {personas.map((p) => {
              const ps = personaStates[p.id];
              const active = ps?.isStreaming;
              const firing = !!firingPersonaIds[p.id];
              return (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-1 w-[100px]"
                >
                  {/* Avatar bubble — clickable to fire this persona */}
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => handleFirePersona(p.id)}
                    role="button"
                    title={`Make ${p.name} react now`}
                  >
                    <div
                      className="persona-avatar transition-transform group-hover:scale-110 group-active:scale-95"
                      style={{ backgroundColor: `${p.color}20`, width: 36, height: 36, fontSize: "1rem" }}
                    >
                      <div
                        className={`persona-avatar-ring ${active ? "speaking" : ""}`}
                        style={{ "--ring-color": p.color } as React.CSSProperties}
                      />
                      <PersonaIcon personaId={p.id} fallbackEmoji={p.emoji} color={p.color} firing={firing} />
                    </div>
                  </div>
                  {/* Info */}
                  <div className="text-center min-w-0 w-full">
                    <div className="text-[10px] font-semibold truncate" style={{ color: p.color }}>{p.name}</div>
                    <div className="text-[8px] text-white/30 truncate">{p.role}</div>
                    <div className="text-[7px] text-white/15 font-mono truncate">{modelDisplay[p.model] || p.model}</div>
                  </div>
                  {/* Sine wave — below text so it doesn't create a gap
                      between avatar and labels. Reserved space keeps layout
                      stable when idle. */}
                  <div className="h-2.5 flex items-end">
                    {active && (
                      <div className="flex items-end gap-[1px] h-2.5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className="sine-bar"
                            style={{ backgroundColor: p.color, width: 2, height: `${[6, 9, 5, 10, 6][i]}px` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main area: Video (small) + Gallery feed */}
          <div className="flex-1 flex gap-3 min-h-0">
            {/* Small video sidebar */}
            <div className="w-[320px] shrink-0 flex flex-col gap-3">
              <div className={`bg-bg-secondary rounded-xl overflow-hidden border transition-colors ${isLive && isRunning ? "border-red-500/20" : "border-white/5"}`}>
                {videoId ? (
                  <YouTubePlayer ref={playerRef} videoId={videoId} onStateChange={handleVideoStateChange} />
                ) : (
                  <div className="flex items-center justify-center bg-black/50 text-white/20 text-xs" style={{ aspectRatio: "16/9" }}>
                    <div className="text-center"><span className="text-2xl block mb-1">📺</span>Paste a URL</div>
                  </div>
                )}
              </div>
              {/* Compact transcript */}
              <div className={`flex-1 bg-bg-secondary rounded-xl border p-2 overflow-y-auto persona-scroll transition-colors ${isLive && isRunning ? "border-red-500/10" : "border-white/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isLive && isRunning ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" /><span className="text-[9px] text-red-400/80 font-mono uppercase tracking-widest font-semibold">Live</span></>
                  ) : (
                    <><span className="text-xs">📝</span><span className="text-[9px] text-white/30 font-mono uppercase tracking-wider">Transcript</span>{isRunning && !isPaused && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />}</>
                  )}
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  {transcriptText && <span>{transcriptText} </span>}
                  {interimText && <span className="text-white/25 italic">{interimText}</span>}
                  {!transcriptText && !interimText && <span className="text-white/15">{isRunning ? "Listening..." : "Transcript..."}</span>}
                </p>
              </div>
            </div>

            {/* The Gallery feed — takes most of the space */}
            <div className="flex-1 min-w-0 min-h-0">
              <CombinedFeed entries={combinedFeed} streamingPersonaId={streamingPersona?.id ?? null} streamingPersonaName={streamingPersona?.name ?? ""} streamingPersonaEmoji={streamingPersona?.emoji ?? ""} streamingPersonaColor={streamingPersona?.color ?? ""} streamingText={streamingPersona ? personaStates[streamingPersona.id]?.streamingText || "" : ""} />
            </div>
          </div>
        </main>
      ) : (
        /* ═══ MOBILE LAYOUT (<768px) ═══ */
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Video at top */}
          <div className="shrink-0 p-2">
            <div className={`bg-bg-secondary rounded-xl overflow-hidden border transition-colors ${isLive && isRunning ? "border-red-500/20" : "border-white/5"}`}>
              {videoId ? (
                <YouTubePlayer ref={playerRef} videoId={videoId} onStateChange={handleVideoStateChange} />
              ) : (
                <div className="flex items-center justify-center bg-black/50 text-white/20 text-sm" style={{ aspectRatio: "16/9" }}>
                  <div className="text-center"><span className="text-2xl block mb-1">📺</span>Paste a URL</div>
                </div>
              )}
            </div>
          </div>

          {/* Persona bubbles — horizontal scroll on mobile */}
          <div className="shrink-0 flex justify-center gap-3 px-2 pb-2 overflow-x-auto">
            {personas.map((p) => {
              const ps = personaStates[p.id];
              const active = ps?.isStreaming;
              const firing = !!firingPersonaIds[p.id];
              return (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-0.5 min-w-[64px]"
                >
                  {/* Avatar — clickable to fire this persona */}
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => handleFirePersona(p.id)}
                    role="button"
                    title={`Make ${p.name} react now`}
                  >
                    <div
                      className="persona-avatar transition-transform group-hover:scale-110 group-active:scale-95"
                      style={{ backgroundColor: `${p.color}20`, width: 32, height: 32, fontSize: "0.9rem" }}
                    >
                      <div
                        className={`persona-avatar-ring ${active ? "speaking" : ""}`}
                        style={{ "--ring-color": p.color } as React.CSSProperties}
                      />
                      <PersonaIcon personaId={p.id} fallbackEmoji={p.emoji} color={p.color} firing={firing} />
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold truncate max-w-[72px]" style={{ color: p.color }}>{p.name}</span>
                  {/* Sine wave — below name to eliminate gap between avatar
                      and text. Reserved space keeps layout steady when idle. */}
                  <div className="h-2 flex items-end">
                    {active && (
                      <div className="flex items-end gap-[1px] h-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className="sine-bar"
                            style={{ backgroundColor: p.color, width: 1.5, height: `${[5, 7, 4, 8, 5][i]}px` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The Gallery feed — takes remaining space */}
          <div className="flex-1 min-h-0 px-2 pb-2">
            <CombinedFeed entries={combinedFeed} streamingPersonaId={streamingPersona?.id ?? null} streamingPersonaName={streamingPersona?.name ?? ""} streamingPersonaEmoji={streamingPersona?.emoji ?? ""} streamingPersonaColor={streamingPersona?.color ?? ""} streamingText={streamingPersona ? personaStates[streamingPersona.id]?.streamingText || "" : ""} />
          </div>
        </main>
      )}

      {/* ── FOOTER ── */}
      <footer
        className={`px-4 py-2 text-center border-t transition-colors ${
          isLive && isRunning ? "border-red-500/10" : "border-white/5"
        }`}
      >
        <p className="text-[10px] text-white/20">
          Powered by Deepgram · Claude Haiku · xAI Grok · Brave Search
          {" · "}
          <a
            href="https://github.com/Sethmr/peanut.gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-white/50 underline"
          >
            Open source — self-host for full privacy
          </a>
        </p>
      </footer>

      {/* ── API KEYS MODAL ── */}
      <ApiKeysModal
        open={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onSave={setApiKeys}
      />
    </div>
  );
}
