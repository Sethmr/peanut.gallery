"use client";

import { useState, useCallback, useRef } from "react";
import PersonaColumn, { type PersonaMessage } from "@/components/PersonaColumn";
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

  const playerRef = useRef<YouTubePlayerHandle>(null);

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

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const messageCountRef = useRef(0);

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
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
                    const msg: PersonaMessage = {
                      id: `${pid}-${messageCountRef.current++}`,
                      text: finalText.trim(),
                      timestamp: Date.now(),
                    };
                    setPersonaStates((prev) => ({
                      ...prev,
                      [pid]: {
                        messages: [...prev[pid].messages, msg],
                        isStreaming: false,
                        streamingText: "",
                      },
                    }));
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
  // RENDER
  // ──────────────────────────────────────────────────────

  // Mode-aware accent color
  const modeAccent = isLive && isRunning ? "red" : "blue";

  return (
    <div className="h-screen flex flex-col">
      {/* ── TOP BAR ── */}
      <header
        className={`flex items-center gap-4 px-4 py-3 bg-bg-secondary border-b transition-colors ${
          isLive && isRunning
            ? "border-red-500/20"
            : "border-white/5"
        }`}
      >
        {/* Logo + Live Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xl">🥜</span>
          <h1 className="font-display font-bold text-base text-white/90">
            Peanut Gallery
          </h1>
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

        <a
          href="https://github.com/Sethmr/peanut.gallery"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          GitHub ↗
        </a>
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
      <main className="flex-1 flex gap-3 p-3 min-h-0">
        {/* Left: Video Player + Transcript */}
        <div className="w-[420px] shrink-0 flex flex-col gap-3">
          {/* Video */}
          <div
            className={`bg-bg-secondary rounded-xl overflow-hidden border transition-colors ${
              isLive && isRunning
                ? "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
                : "border-white/5"
            }`}
          >
            {videoId ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={videoId}
                onStateChange={handleVideoStateChange}
              />
            ) : (
              <div
                className="flex items-center justify-center bg-black/50 text-white/20 text-sm"
                style={{ aspectRatio: "16/9" }}
              >
                <div className="text-center">
                  <span className="text-3xl block mb-2">📺</span>
                  Paste a URL and hit Start
                </div>
              </div>
            )}
          </div>

          {/* Transcript */}
          <div
            className={`flex-1 bg-bg-secondary rounded-xl border p-3 overflow-y-auto persona-scroll transition-colors ${
              isLive && isRunning
                ? "border-red-500/10"
                : "border-white/5"
            }`}
          >
            {/* Transcript Header */}
            <div className="flex items-center gap-2 mb-2">
              {isLive && isRunning ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 live-pulse" />
                  <span className="text-[10px] text-red-400/80 font-mono uppercase tracking-widest font-semibold">
                    Live Transcript
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm">📝</span>
                  <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                    Transcript
                  </span>
                  {isRunning && !isPaused && (
                    <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                  )}
                  {isPaused && (
                    <span className="text-[10px] text-accent-amber font-mono uppercase tracking-wider">
                      Paused
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Transcript Content */}
            <p className="text-sm text-white/50 leading-relaxed">
              {transcriptText && <span>{transcriptText} </span>}
              {interimText && (
                <span className="text-white/30 italic">{interimText}</span>
              )}
              {!transcriptText && !interimText && (
                <span className="text-white/20">
                  {isRunning
                    ? isLive
                      ? "Waiting for audio from live stream..."
                      : "Listening..."
                    : "Transcript will appear here..."}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: 2x2 Persona Grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">
          {personas.map((p) => {
            // In live mode, give the Producer a special "FACT-CHECK" accent
            const isProducerLive = isLive && isRunning && p.id === "producer";

            return (
              <PersonaColumn
                key={p.id}
                name={p.name}
                emoji={p.emoji}
                color={p.color}
                model={modelDisplay[p.model] || p.model}
                messages={personaStates[p.id]?.messages || []}
                isStreaming={personaStates[p.id]?.isStreaming || false}
                streamingText={personaStates[p.id]?.streamingText || ""}
                badge={isProducerLive ? "LIVE FACT-CHECK" : undefined}
              />
            );
          })}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer
        className={`px-4 py-2 text-center border-t transition-colors ${
          isLive && isRunning ? "border-red-500/10" : "border-white/5"
        }`}
      >
        <p className="text-[10px] text-white/20">
          Powered by Deepgram · Claude Haiku · Groq · Brave Search —
          Multi-provider, no platform trap
        </p>
      </footer>
    </div>
  );
}
