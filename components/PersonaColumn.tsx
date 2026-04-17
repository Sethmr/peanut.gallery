"use client";

import { useEffect, useRef } from "react";
import PersonaIcon from "./PersonaIcon";

export interface PersonaMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface PersonaColumnProps {
  name: string;
  role: string;
  /** Emoji used as a fallback when `personaId` is missing or unknown. */
  emoji: string;
  /** Persona id — drives which archetype SVG glyph is rendered. Falls back to `emoji`. */
  personaId?: string;
  color: string;
  model: string;
  messages: PersonaMessage[];
  isStreaming: boolean;
  streamingText: string;
  /** Optional badge shown next to name (e.g., "LIVE FACT-CHECK") */
  badge?: string;
  /** Compact mode for sidebar mini-cards */
  compact?: boolean;
  /** Callback when the avatar glyph is tapped — fires this persona on demand */
  onAvatarClick?: () => void;
  /**
   * When true, crossfades the persona avatar glyph to a spinner — driven by the
   * parent's "awaiting response" state after the avatar is tapped. Clear this
   * when the matching persona_done event arrives (or on a safety timeout).
   */
  isFiring?: boolean;
}

/** Sine wave bars — animated when speaking, idle otherwise */
function SineWave({ color, active, small }: { color: string; active: boolean; small?: boolean }) {
  const barClass = active ? "sine-bar" : "sine-bar-idle";
  return (
    <div className={`flex items-end gap-[2px] ${small ? "h-3" : "h-5"}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`${barClass}${small ? " !w-[2px]" : ""}`}
          style={{
            backgroundColor: color,
            ...(small && !active ? { height: `${[3, 4, 3, 4, 3][i]}px` } : {}),
            ...(small && active ? { height: `${[8, 11, 7, 12, 8][i]}px` } : {}),
          }}
        />
      ))}
    </div>
  );
}

export default function PersonaColumn({
  name,
  role,
  emoji,
  personaId,
  color,
  model,
  messages,
  isStreaming,
  streamingText,
  badge,
  compact = false,
  onAvatarClick,
  isFiring = false,
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
        {/* Compact Header — Centered bubble with info */}
        <div className="flex flex-col items-center gap-1.5 px-3 pt-3 pb-2">
          {/* Avatar bubble with ring — clickable to fire this persona */}
          <div
            className="relative group"
            onClick={onAvatarClick}
            role={onAvatarClick ? "button" : undefined}
            title={onAvatarClick ? `Make ${name} react now` : undefined}
            style={{ cursor: onAvatarClick ? "pointer" : "default" }}
          >
            <div
              className={`persona-avatar transition-transform ${onAvatarClick ? "group-hover:scale-110 group-active:scale-95" : ""}`}
              style={{ backgroundColor: `${color}20`, width: 40, height: 40, fontSize: "1.1rem" }}
            >
              <div
                className={`persona-avatar-ring ${isStreaming ? "speaking" : ""}`}
                style={{ "--ring-color": color } as React.CSSProperties}
              />
              <PersonaIcon personaId={personaId} fallbackEmoji={emoji} color={color} firing={isFiring} />
            </div>
          </div>
          <div className="text-center min-w-0 w-full">
            <h3
              className="font-display font-semibold text-xs truncate"
              style={{ color }}
            >
              {name}
            </h3>
            <p className="text-[9px] text-white/30 truncate">{role}</p>
            <p className="text-[8px] text-white/20 font-mono truncate">{model}</p>
          </div>
          {/* Sine wave below the text — reserves space so the layout is
              stable whether speaking or idle, and removes the visual gap
              between the avatar and the label block. */}
          <div className="h-3 flex items-center">
            {isStreaming && <SineWave color={color} active={true} small />}
          </div>
          {badge && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 border border-red-500/25 rounded text-[8px] font-mono text-red-400 uppercase tracking-wider whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-red-500 live-pulse" />
              {badge}
            </span>
          )}
        </div>

        {/* Messages — scrollable, no truncation */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto persona-scroll px-3 pb-3 space-y-2"
        >
          {visibleMessages.length === 0 && !isStreaming ? (
            <p className="text-white/20 text-[11px] text-center mt-2">
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

  // ── FULL / WIDE MODE ──
  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl border border-white/5 overflow-hidden">
      {/* Header — Centered profile bubble with sine wave + full info */}
      <div
        className="flex flex-col items-center gap-2 px-4 py-4 border-b border-white/5"
        style={{ borderBottomColor: `${color}30` }}
      >
        {/* Avatar bubble with pulsing ring — clickable to fire this persona */}
        <div
          className="relative group"
          onClick={onAvatarClick}
          role={onAvatarClick ? "button" : undefined}
          title={onAvatarClick ? `Make ${name} react now` : undefined}
          style={{ cursor: onAvatarClick ? "pointer" : "default" }}
        >
          <div
            className={`persona-avatar transition-transform ${onAvatarClick ? "group-hover:scale-110 group-active:scale-95" : ""}`}
            style={{ backgroundColor: `${color}20` }}
          >
            <div
              className={`persona-avatar-ring ${isStreaming ? "speaking" : ""}`}
              style={{ "--ring-color": color } as React.CSSProperties}
            />
            <PersonaIcon personaId={personaId} fallbackEmoji={emoji} color={color} firing={isFiring} />
          </div>
        </div>

        {/* Name + Role + Model */}
        <div className="text-center min-w-0 w-full mt-1">
          <div className="flex items-center justify-center gap-2">
            <h3
              className="font-display font-semibold text-sm"
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
          <p className="text-[10px] text-white/40 mt-0.5">{role}</p>
          <p className="text-[9px] text-white/20 font-mono mt-0.5">{model}</p>
        </div>

        {/* Sine wave sits under the text block so the label group hugs the
            avatar without an interstitial gap. Reserved space keeps layout
            stable between speaking/idle. */}
        <div className="h-3 mt-1 flex items-center">
          {isStreaming && <SineWave color={color} active={true} small />}
        </div>
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
