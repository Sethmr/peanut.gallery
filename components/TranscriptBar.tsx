"use client";

import { useEffect, useRef } from "react";

interface TranscriptBarProps {
  text: string;
  interimText: string;
  isActive: boolean;
}

export default function TranscriptBar({
  text,
  interimText,
  isActive,
}: TranscriptBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [text, interimText]);

  return (
    <div className="bg-bg-secondary border-t border-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm">📝</span>
          <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
            Live Transcript
          </span>
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto whitespace-nowrap text-sm text-white/50 scrollbar-none"
        >
          {text && <span>{text} </span>}
          {interimText && (
            <span className="text-white/30 italic">{interimText}</span>
          )}
          {!text && !interimText && (
            <span className="text-white/20">
              {isActive
                ? "Listening..."
                : "Paste a YouTube URL and hit Start to begin"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
