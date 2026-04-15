"use client";

import { useState, useEffect, useCallback } from "react";

export interface ApiKeys {
  deepgram: string;
  anthropic: string;
  groq: string;
  brave: string;
}

const STORAGE_KEY = "peanut-gallery-keys";

const EMPTY_KEYS: ApiKeys = { deepgram: "", anthropic: "", groq: "", brave: "" };

/** Load keys from localStorage (returns empty strings if missing) */
export function loadApiKeys(): ApiKeys {
  if (typeof window === "undefined") return EMPTY_KEYS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_KEYS;
    return { ...EMPTY_KEYS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_KEYS;
  }
}

/** True if the minimum required keys are set */
export function hasRequiredKeys(keys: ApiKeys): boolean {
  return !!(keys.deepgram && keys.groq);
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
}

export default function ApiKeysModal({ open, onClose, onSave }: Props) {
  const [keys, setKeys] = useState<ApiKeys>(EMPTY_KEYS);

  useEffect(() => {
    if (open) setKeys(loadApiKeys());
  }, [open]);

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    onSave(keys);
    onClose();
  }, [keys, onSave, onClose]);

  if (!open) return null;

  const fields: { key: keyof ApiKeys; label: string; required: boolean; hint: string; url: string }[] = [
    { key: "deepgram", label: "Deepgram", required: true, hint: "Real-time transcription", url: "https://console.deepgram.com/signup" },
    { key: "groq", label: "Groq", required: true, hint: "Fast LLM (Troll + Fred)", url: "https://console.groq.com/keys" },
    { key: "anthropic", label: "Anthropic", required: false, hint: "Claude Haiku (Baba Booey + Jackie)", url: "https://console.anthropic.com" },
    { key: "brave", label: "Brave Search", required: false, hint: "Live fact-checking", url: "https://brave.com/search/api/" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-white">API Keys</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-lg">✕</button>
        </div>

        <p className="text-xs text-white/40 mb-4 leading-relaxed">
          Your keys stay in your browser. They&apos;re sent directly to each API — never stored on our server.
        </p>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-white/70">
                  {f.label}
                  {f.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <span className="text-[10px] text-white/30">{f.hint}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keys[f.key]}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [f.key]: e.target.value.trim() }))}
                  placeholder={`Paste your ${f.label} key`}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                />
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-2 py-2 text-[10px] text-white/40 hover:text-white/70 border border-white/10 rounded-lg"
                >
                  Get key
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-5">
          <span className="text-[10px] text-white/20">
            {hasRequiredKeys(keys) ? "Ready to go" : "Deepgram + Groq required"}
          </span>
          <button
            onClick={handleSave}
            disabled={!hasRequiredKeys(keys)}
            className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
}
