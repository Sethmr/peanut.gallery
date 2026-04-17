"use client";

import { useEffect, useRef } from "react";
import type { PersonaMessage } from "./PersonaColumn";
import PersonaIcon from "./PersonaIcon";

/** A single entry in the combined feed — persona name + message */
export interface FeedEntry {
  id: string;
  personaId: string;
  personaName: string;
  personaEmoji: string;
  personaColor: string;
  text: string;
  timestamp: number;
}

interface CombinedFeedProps {
  entries: FeedEntry[];
  /** Currently streaming persona (if any) */
  streamingPersonaId: string | null;
  streamingPersonaName: string;
  streamingPersonaEmoji: string;
  streamingPersonaColor: string;
  streamingText: string;
}

export default function CombinedFeed({
  entries,
  streamingPersonaId,
  streamingPersonaName,
  streamingPersonaEmoji,
  streamingPersonaColor,
  streamingText,
}: CombinedFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, streamingText]);

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
        <span className="text-sm">🥜</span>
        <h3 className="font-display font-semibold text-xs text-white/60 uppercase tracking-wider">
          The Gallery
        </h3>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto persona-scroll p-3 space-y-2.5"
      >
        {entries.length === 0 && !streamingPersonaId && (
          <p className="text-white/20 text-xs text-center mt-8">
            Waiting for the peanut gallery to react...
          </p>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="message-enter">
            <div className="flex items-start gap-2">
              <PersonaIcon
                personaId={entry.personaId}
                fallbackEmoji={entry.personaEmoji}
                color={entry.personaColor}
                className="shrink-0 mt-0.5"
                size="1em"
              />
              <div className="min-w-0">
                <span
                  className="text-xs font-semibold font-display mr-1.5"
                  style={{ color: entry.personaColor }}
                >
                  {entry.personaName}
                </span>
                <span className="text-[10px] text-white/20">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <p
                  className="text-sm leading-relaxed mt-0.5"
                  style={{ color: `${entry.personaColor}cc` }}
                >
                  {entry.text}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Currently streaming */}
        {streamingPersonaId && streamingText && (
          <div className="message-enter">
            <div className="flex items-start gap-2">
              <PersonaIcon
                personaId={streamingPersonaId}
                fallbackEmoji={streamingPersonaEmoji}
                color={streamingPersonaColor}
                className="shrink-0 mt-0.5"
                size="1em"
              />
              <div className="min-w-0">
                <span
                  className="text-xs font-semibold font-display mr-1.5"
                  style={{ color: streamingPersonaColor }}
                >
                  {streamingPersonaName}
                </span>
                <p
                  className="text-sm leading-relaxed mt-0.5"
                  style={{ color: `${streamingPersonaColor}cc` }}
                >
                  {streamingText}
                  <span
                    className="inline-block w-1.5 h-4 ml-0.5 animate-pulse"
                    style={{ backgroundColor: streamingPersonaColor }}
                  />
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
