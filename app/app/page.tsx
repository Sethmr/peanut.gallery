"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import PersonaColumn, { type PersonaMessage } from "@/components/PersonaColumn";
import CombinedFeed, { type FeedEntry } from "@/components/CombinedFeed";
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
  "groq-llama-70b": "Groq · Llama 70B",
  "groq-llama-8b": "Groq · Llama 8B",
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
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ deepgram: "", anthropic: "", groq: "", brave: "" });

  const playerRef = useRef<YouTubePlayerHandle>(null);

  // Load keys from localStorage on mount
  useEffect(() => {
    const saved = loadApiKeys();
    setApiKeys(saved);
    // Auto-open modal if no keys configured
    if (!hasRequiredKeys(saved)) setShowKeysModal(true);
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

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);

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
          "X-Groq-Key": apiKeys.groq,
          "X-Brave-Key": apiKeys.brave,
        },
        body: JSON.stringify({ url: youtubeUrl }),
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
                title="Force the AI personas to react now"
              >
                🔥
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
              <PersonaColumn key={p.id} name={p.name} emoji={p.emoji} color={p.color} model={modelDisplay[p.model] || p.model} messages={personaStates[p.id]?.messages || []} isStreaming={personaStates[p.id]?.isStreaming || false} streamingText={personaStates[p.id]?.streamingText || ""} badge={isLive && isRunning && p.id === "producer" ? "LIVE FACT-CHECK" : undefined} compact />
            ))}
          </div>
        </main>
      ) : layoutMode === "compact" ? (
        /* ═══ COMPACT / SIDEBAR MODE (768–1399px) ═══ */
        <main className="flex-1 flex flex-col min-h-0 p-3 gap-3">
          {/* Top: Persona status strip — 4 mini cards in a row */}
          <div className="flex gap-2 shrink-0">
            {personas.map((p) => {
              const ps = personaStates[p.id];
              const active = ps?.isStreaming;
              return (
                <div
                  key={p.id}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    active
                      ? "bg-bg-secondary border-white/15"
                      : "bg-bg-secondary/50 border-white/5"
                  }`}
                >
                  <span className="text-lg">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/80 truncate">{p.name}</div>
                    <div className="text-[10px] text-white/30 truncate">{modelDisplay[p.model] || p.model}</div>
                  </div>
                  {active && (
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "300ms" }} />
                    </div>
                  )}
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

          {/* Persona status row — compact */}
          <div className="shrink-0 flex gap-1.5 px-2 pb-2 overflow-x-auto">
            {personas.map((p) => {
              const ps = personaStates[p.id];
              const active = ps?.isStreaming;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border whitespace-nowrap transition-all ${
                    active ? "bg-bg-secondary border-white/15" : "bg-bg-secondary/50 border-white/5"
                  }`}
                >
                  <span className="text-sm">{p.emoji}</span>
                  <span className="text-[10px] font-semibold text-white/70">{p.name}</span>
                  {active && (
                    <div className="flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "0ms" }} />
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "150ms" }} />
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: p.color, animationDelay: "300ms" }} />
                    </div>
                  )}
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
          Powered by Deepgram · Claude Haiku · Groq · Brave Search
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
