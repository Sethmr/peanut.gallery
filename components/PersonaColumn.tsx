"use client";

import { useEffect, useRef } from "react";

export interface PersonaMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface PersonaColumnProps {
  name: string;
  emoji: string;
  color: string;
  model: string;
  messages: PersonaMessage[];
  isStreaming: boolean;
  streamingText: string;
  /** Optional badge shown next to name (e.g., "LIVE FACT-CHECK") */
  badge?: string;
  /** Compact mode for sidebar mini-cards */
  compact?: boolean;
}

/** Sine wave bars — animated when speaking, idle otherwise */
function SineWave({ color, active }: { color: string; active: boolean }) {
  const barClass = active ? "sine-bar" : "sine-bar-idle";
  return (
    <div className="flex items-end gap-[2px] h-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={barClass}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export default function PersonaColumn({
  name,
  emoji,
  color,
  model,
  messages,
  isStreaming,
  streamingText,
  badge,
  compact = false,
}: PersonaColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Show recent messages in compact mode (scrollable, no truncation)
  const visibleMessages = compact ? messages.slice(-3) : messages;

  if (compact) {
    return (
      <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
        {/* Compact Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-white/5"
          style={{ borderBottomColor: `${color}20` }}
        >
          <span className="text-sm">{emoji}</span>
          <h3
            className="font-display font-semibold text-xs flex-1 min-w-0"
            style={{ color }}
          >
            {name}
          </h3>
          {isStreaming && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
        </div>

        {/* Messages — scrollable, no truncation */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto persona-scroll p-3 space-y-2"
        >
          {visibleMessages.length === 0 && !isStreaming ? (
            <p className="text-white/20 text-[11px] text-center mt-3">
              Waiting...
            </p>
          ) : (
            visibleMessages.map((msg) => (
              <p key={msg.id} className="text-xs text-white/60 leading-relaxed">
                {msg.text}
              </p>
            ))
          )}
          {isStreaming && streamingText && (
            <p className="text-xs text-white/60 leading-relaxed">
              {streamingText}
              <span
                className="inline-block w-1 h-3 ml-0.5 animate-pulse"
                style={{ backgroundColor: color }}
              />
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
      {/* Header — Bubble style with avatar + sine wave */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
        style={{ borderBottomColor: `${color}30` }}
      >
        {/* Avatar bubble */}
        <div
          className="persona-avatar"
          style={{ backgroundColor: `${color}20` }}
        >
          <div
            className={`persona-avatar-ring ${isStreaming ? "speaking" : ""}`}
            style={{ "--ring-color": color } as React.CSSProperties}
          />
          <span>{emoji}</span>
        </div>

        {/* Name + Model */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="font-display font-semibold text-sm truncate"
              style={{ color }}
            >
              {name}
            </h3>
            {badge && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 border border-red-500/25 rounded text-[9px] font-mono text-red-400 uppercase tracking-wider whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
                {badge}
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/30 font-mono">{model}</p>
        </div>

        {/* Sine wave indicator */}
        <SineWave color={color} active={isStreaming} />
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto persona-scroll p-3 space-y-3"
      >
        {messages.length === 0 && !isStreaming && (
          <p className="text-white/20 text-xs text-center mt-8">
            Waiting for transcript...
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="message-enter">
            <p className="text-sm text-white/80 leading-relaxed">{msg.text}</p>
            <p className="text-[10px] text-white/20 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}

        {/* Currently streaming message */}
        {isStreaming && streamingText && (
          <div className="message-enter">
            <p className="text-sm text-white/80 leading-relaxed">
              {streamingText}
              <span
                className="inline-block w-1.5 h-4 ml-0.5 animate-pulse"
                style={{ backgroundColor: color }}
              />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
