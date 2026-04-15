"use client";

import { useState, useCallback, useRef } from "react";
import PersonaColumn, { type PersonaMessage } from "@/components/PersonaColumn";
import YouTubePlayer, {
  extractVideoId,
  type YouTubePlayerHandle,
} from "@/components/YouTubePlayer";
import { personas } from "@/lib/personas";

// Map persona model names to display strings
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

  const handleStart = useCallback(async () => {
    if (!youtubeUrl.trim()) return;

    // Extract and set video ID for the player
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

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Track streaming text per persona for assembly
      const streamBuffers: Record<string, string> = {};

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

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
                    // Auto-clear status detail after 5 seconds
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

  const handlePauseResume = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (isPaused) {
      // Resume video + server pipeline
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
      // Pause video + server pipeline
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
  }, [isPaused]);

  // Sync: when user pauses/plays the YouTube player directly via its controls
  const handleVideoStateChange = useCallback((isPlaying: boolean) => {
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
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center gap-4 px-4 py-3 bg-bg-secondary border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥜</span>
          <h1 className="font-display font-bold text-base text-white/90">
            Peanut Gallery
          </h1>
          {isRunning && isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                Live
              </span>
            </span>
          )}
        </div>

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
              {/* Pause / Resume */}
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

              {/* Stop */}
              <button
                onClick={handleStop}
                className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red/80 transition-all"
              >
                Stop
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

      {/* Error Banner */}
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

      {/* Status Detail */}
      {statusDetail && (
        <div className="bg-accent-blue/5 border-b border-accent-blue/10 px-4 py-1.5 text-[11px] text-accent-blue/70 font-mono">
          {statusDetail}
        </div>
      )}

      {/* Main Content: Video + Personas */}
      <main className="flex-1 flex gap-3 p-3 min-h-0">
        {/* Left: Video Player */}
        <div className="w-[420px] shrink-0 flex flex-col gap-3">
          <div className="bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
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

          {/* Transcript below video */}
          <div className="flex-1 bg-bg-secondary rounded-xl border border-white/5 p-3 overflow-y-auto persona-scroll">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">📝</span>
              <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                {isLive ? "Live Transcript" : "Transcript"}
              </span>
              {isRunning && !isPaused && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {isPaused && (
                <span className="text-[10px] text-accent-amber font-mono uppercase tracking-wider">
                  Paused
                </span>
              )}
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              {transcriptText && <span>{transcriptText} </span>}
              {interimText && (
                <span className="text-white/30 italic">{interimText}</span>
              )}
              {!transcriptText && !interimText && (
                <span className="text-white/20">
                  {isRunning
                    ? "Listening..."
                    : "Transcript will appear here..."}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: 2x2 Persona Grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">
          {personas.map((p) => (
            <PersonaColumn
              key={p.id}
              name={p.name}
              emoji={p.emoji}
              color={p.color}
              model={modelDisplay[p.model] || p.model}
              messages={personaStates[p.id]?.messages || []}
              isStreaming={personaStates[p.id]?.isStreaming || false}
              streamingText={personaStates[p.id]?.streamingText || ""}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 text-center border-t border-white/5">
        <p className="text-[10px] text-white/20">
          Powered by Deepgram · Claude Haiku · Groq · Brave Search —
          Multi-provider, no platform trap
        </p>
      </footer>
    </div>
  );
}
