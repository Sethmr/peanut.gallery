"use client";

import { useState, useCallback, useRef } from "react";
import PersonaColumn, { type PersonaMessage } from "@/components/PersonaColumn";
import TranscriptBar from "@/components/TranscriptBar";
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
  const [isRunning, setIsRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

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
  const messageCountRef = useRef(0);

  const handleStart = useCallback(async () => {
    if (!youtubeUrl.trim()) return;

    setError(null);
    setIsConnecting(true);

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
    setIsRunning(false);
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
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-accent-red text-white text-sm font-medium rounded-lg hover:bg-accent-red/80 transition-all"
            >
              Stop
            </button>
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

      {/* 4-Column Persona Grid */}
      <main className="flex-1 grid grid-cols-4 gap-3 p-3 min-h-0">
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
      </main>

      {/* Transcript Bar */}
      <TranscriptBar
        text={transcriptText}
        interimText={interimText}
        isActive={isRunning}
      />

      {/* Footer */}
      <footer className="px-4 py-2 text-center border-t border-white/5">
        <p className="text-[10px] text-white/20">
          Powered by Deepgram · Claude Haiku · Groq · Brave Search — Multi-provider, no platform trap
        </p>
      </footer>
    </div>
  );
}
