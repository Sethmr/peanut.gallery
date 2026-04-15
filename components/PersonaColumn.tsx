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
}: PersonaColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-white/5"
        style={{ borderBottomColor: `${color}30` }}
      >
        <span className="text-xl">{emoji}</span>
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
        {isStreaming && (
          <div className="flex gap-1">
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          </div>
        )}
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
