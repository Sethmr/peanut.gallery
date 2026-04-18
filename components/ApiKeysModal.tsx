"use client";

import { useState, useEffect, useCallback } from "react";

export interface ApiKeys {
  deepgram: string;
  anthropic: string;
  xai: string;
  brave: string;
}

const STORAGE_KEY = "peanut-gallery-keys";

const EMPTY_KEYS: ApiKeys = { deepgram: "", anthropic: "", xai: "", brave: "" };

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
  // Deepgram is mandatory for transcription. At least one LLM provider
  // (Anthropic or xAI) must also be present or no persona fires.
  return !!(keys.deepgram && (keys.anthropic || keys.xai));
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys) => void;
}

export default function ApiKeysModal({ open, onClose, onSave }: Props) {
  const [keys, setKeys] = useState<ApiKeys>(EMPTY_KEYS);
  const [showTrust, setShowTrust] = useState(false);

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
    { key: "anthropic", label: "Anthropic", required: true, hint: "Claude Haiku (Producer + Joker)", url: "https://console.anthropic.com" },
    { key: "xai", label: "xAI", required: true, hint: "Grok 4.1 Fast (Troll + Sound FX)", url: "https://console.x.ai" },
    { key: "brave", label: "Brave Search", required: false, hint: "Live fact-checking (optional — xAI Live Search is used otherwise)", url: "https://brave.com/search/api/" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
          <h2 className="font-display font-bold text-lg text-white">API Keys</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-lg">✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
        {/* Trust / Transparency Banner */}
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5">🔒</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-200/80 leading-relaxed">
                <strong>Your keys are sent to this server</strong> to run the
                transcription pipeline. They&apos;re used for your session only and
                never saved.{" "}
                <button
                  onClick={() => setShowTrust(!showTrust)}
                  className="underline text-amber-300/80 hover:text-amber-200"
                >
                  {showTrust ? "Less detail" : "How does this work?"}
                </button>
              </p>

              {showTrust && (
                <div className="mt-2 text-[11px] text-amber-200/60 leading-relaxed space-y-1.5">
                  <p>
                    Your keys are stored in your browser&apos;s localStorage and sent
                    via request headers when you start a session. The server
                    passes them directly to Deepgram, Anthropic, xAI, and Brave — then
                    discards them when the session ends.
                  </p>
                  <p>
                    This app is{" "}
                    <a
                      href="https://github.com/Sethmr/peanut.gallery"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-300/70 hover:text-amber-200"
                    >
                      fully open source
                    </a>
                    {" "}— you can audit exactly what happens with your keys.
                  </p>
                  <p className="text-amber-300/80 font-semibold">
                    For maximum security, we recommend self-hosting. It takes
                    under 2 minutes:
                  </p>
                  <div className="bg-black/30 rounded px-2 py-1.5 font-mono text-[10px] text-white/50 select-all">
                    git clone https://github.com/Sethmr/peanut.gallery && cd peanut.gallery && ./setup.sh
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3">
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
                  type="text"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  spellCheck={false}
                  value={keys[f.key]}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [f.key]: e.target.value.trim() }))}
                  placeholder={`Paste your ${f.label} key`}
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                  style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
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
        </form>
        </div>

        <div className="flex items-center justify-between px-6 pt-4 pb-6 border-t border-white/5 shrink-0">
          <span className="text-[10px] text-white/20">
            {hasRequiredKeys(keys) ? "Ready to go" : "Deepgram + Anthropic or xAI required"}
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
