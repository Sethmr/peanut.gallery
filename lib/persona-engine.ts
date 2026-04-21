/**
 * Peanut Gallery — Persona Engine
 *
 * Takes transcript chunks, fans out to 4 LLM calls in parallel,
 * and streams responses back via callbacks.
 *
 * Multi-provider: xAI Grok (non-reasoning) for fast/reflexive voices (Troll,
 * Jason, Fred, Lon) and Claude Haiku for the nuanced ones (Baba/Molly
 * producer, Jackie/Alex joker). Groq was in the mix pre-v1.4 but hit free-tier
 * TPD caps in production; swapped out for Grok which has a better-fitting
 * voice for the sarcastic/reflex slots anyway.
 *
 * FACT-CHECKING PIPELINE (for Producer persona):
 * 1. Extract verifiable claims from recent transcript
 * 2. Run parallel search queries for each claim (Brave Search or xAI Live
 *    Search — chosen per session by the viewer)
 * 3. Inject search results into Producer's context
 * 4. Producer cross-references and corrects in real-time
 */

import Anthropic from "@anthropic-ai/sdk";
import { logPipeline, logTimed } from "./debug-logger";
import {
  buildPersonaContext,
  type Persona,
  type OtherPersonaResponse,
  type ConversationEntry,
} from "./personas";
import { howardPack } from "./packs/howard";
import type { Pack } from "./packs/types";
import { SemanticCache } from "./semantic-cache";

export interface PersonaResponse {
  personaId: string;
  text: string;
  done: boolean;
}

type StreamCallback = (response: PersonaResponse) => void;

/**
 * A single entry in the unified conversation log. Interleaves:
 * - Transcript snapshots from the video (personaId = null)
 * - Persona responses (personaId = their id)
 * Newest last. The engine uses this to give every persona a coherent
 * picture of what's been said, so they don't repeat themselves.
 */
interface LogEntry {
  personaId: string | null; // null = video transcript snapshot
  text: string;
  timestamp: number;
}

/**
 * Archetype-keyed fallback lines used when the model tries to pass on a
 * user-initiated tap (isForceReact = true). The viewer promised themselves
 * a response by tapping; we owe them visible output no matter what the
 * model decided.
 *
 * Keyed by archetype slot id (`producer` / `troll` / `soundfx` / `joker`)
 * so they work across any pack (Howard, TWiST, future). Lines are
 * deliberately short + hedge-shaped — enough to fill the bubble, easy on
 * the eye, not trying to impersonate the specific persona's sharp voice.
 */
const FORCE_REACT_FALLBACKS: Record<string, string> = {
  producer: "Eh — nothing clean on that one. Let me keep my ears open.",
  troll: "Not enough meat on that bone. I'll get the next one.",
  soundfx: "[crickets]",
  joker: "*still writing — hold.*",
};

function getForceReactFallback(persona: Persona): string {
  return FORCE_REACT_FALLBACKS[persona.id] ?? `[${persona.name} is still thinking.]`;
}

// Patterns that indicate a verifiable factual claim
const CLAIM_PATTERNS = [
  // Numbers, dates, statistics
  /(?:founded|started|launched|created|began)\s+(?:in|around)\s+\d{4}/i,
  /\$[\d.,]+\s*(?:billion|million|thousand|[BMK])/i,
  /\d+[\d.,]*\s*(?:percent|%|billion|million|thousand|users|employees|customers)/i,
  // Attributions and quotes
  /(?:said|claimed|announced|reported|according to)\s/i,
  // Comparisons and rankings
  /(?:largest|biggest|first|fastest|most|only|world's|best)\s/i,
  // Company/product facts
  /(?:acquired|merged|IPO|went public|valuation|revenue|profit|raised)\s/i,
  // Specific fact claims
  /(?:is worth|was worth|valued at|market cap|founded by|CEO of|invented|created by)/i,
];

/**
 * Which search backend to use for Producer fact-checking. User-selectable per
 * session — Brave hits the Brave Search REST API; "xai" uses xAI's Grok Live
 * Search (`search_parameters` on a chat completion) which returns a synthesized
 * answer + citations in one round-trip. Default is "brave" to preserve the
 * existing behavior for users who haven't flipped the toggle.
 */
export type SearchEngine = "brave" | "xai";

export class PersonaEngine {
  private anthropic: Anthropic;
  private braveApiKey: string;
  /**
   * xAI Grok uses an OpenAI-compatible REST API, so we call it with raw
   * fetch + SSE parsing instead of pulling in another SDK. Keys flow in the
   * same way as the other providers (header override → env var). Empty
   * string means "not configured" — the xai branch in firePersona will throw
   * a clear error, which the force-react fallback will then catch and
   * convert into a visible canned bubble.
   */
  private xaiKey: string;

  /**
   * Which search engine the Producer uses for fact-checking. Fixed at
   * construction time so a single session has deterministic behavior; the
   * route picks this up from the client header and hands it to us.
   */
  private searchEngine: SearchEngine;

  /**
   * The active pack. Defaults to the Howard pack so pre-v1.3 call sites that
   * construct the engine without a pack keep working unchanged. All internal
   * references to "the 4 personas" flow through `this.pack.personas`, which
   * means swapping packs is a constructor-arg change — no engine rewrite.
   */
  private pack: Pack;

  // ── SEMANTIC ANTI-REPEAT (SET-15) ──
  // One SemanticCache per persona, initialised when ENABLE_SEMANTIC_ANTI_REPEAT
  // is on and an OpenAI key is available. Each cache holds a K=10 ring buffer
  // of recent response embeddings. After each successful fire we embed the
  // response and check it against the ring; on a hit we flag the draft and
  // store it in `repeatSlots` so the NEXT fire for that persona gets an
  // explicit "don't repeat this" injection in its prompt.
  private readonly semanticEnabled: boolean;
  private readonly semanticCaches: Map<string, SemanticCache> = new Map();
  /**
   * Per-persona "last flagged draft". When set, the text is injected into the
   * next prompt for that persona and cleared once the new draft clears the
   * similarity threshold (or on a successful addAndCheck with maxSim <= τ).
   */
  private readonly repeatSlots: Map<string, string> = new Map();
  private get personas(): Persona[] {
    return this.pack.personas;
  }

  // Track previous responses per persona for continuity
  private previousResponses: Map<string, string[]> = new Map();
  private readonly MAX_PREVIOUS = 3;

  // Unified, ordered conversation log: video transcript snapshots interleaved
  // with persona responses. Every persona sees a SMALL recent window of this
  // so they can self-check for duplication — but the TRANSCRIPT is the main
  // signal. Window is intentionally small: we saw personas anchoring to old
  // chatter (repeating "$2.4 million house" 8 messages in a row) when the
  // window was 20. Short window forces the model to follow the video.
  private conversationLog: LogEntry[] = [];
  private readonly LOG_WINDOW = 10; // just enough to catch "did I just say this"
  private readonly LOG_MAX = 40; // hard cap to keep memory bounded
  // Remember the last snippet of video we logged so we only push NEW transcript
  private lastTranscriptLength = 0;

  constructor(config: {
    anthropicKey: string;
    braveSearchKey: string;
    /**
     * xAI Grok key. Every pack's Troll/Jason AND soundfx slot routes through
     * Grok as of v1.4, so a working xAI key is required for both packs to
     * fire cleanly. Empty-string is still accepted (force-react fallback
     * catches the resulting throw into a visible canned bubble), but the
     * sidebar will look sparse.
     */
    xaiKey: string;
    /**
     * Optional. Defaults to the Howard pack (pre-v1.3 behavior). When v1.3's
     * pack selector forwards a user-chosen pack from the extension, the
     * transcribe route resolves it via `resolvePack(...)` and passes the
     * resulting `Pack` object here. `resolvePack` never returns undefined,
     * so this argument is either a valid Pack or unset.
     */
    pack?: Pack;
    /**
     * Optional. Search backend for Producer fact-checking. "brave" preserves
     * the pre-v1.4 behavior (Brave Search REST API); "xai" uses Grok Live
     * Search and folds the whole search+synthesize step into one Grok call
     * (removes the second network hop + removes the Brave-Search dependency
     * for users who only want one key). Defaults to "brave".
     */
    searchEngine?: SearchEngine;
    /**
     * Optional. OpenAI API key for semantic anti-repetition embeddings (SET-15).
     * Required when ENABLE_SEMANTIC_ANTI_REPEAT=true; ignored otherwise.
     * Uses text-embedding-3-small via raw fetch (no SDK dep).
     */
    openAiKey?: string;
  }) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicKey });
    this.braveApiKey = config.braveSearchKey;
    this.xaiKey = config.xaiKey;
    this.searchEngine = config.searchEngine ?? "brave";
    this.pack = config.pack ?? howardPack;

    // Initialize response history for every persona in the active pack
    for (const p of this.pack.personas) {
      this.previousResponses.set(p.id, []);
    }

    // ── Semantic anti-repeat setup ──
    // Only activate when the feature flag is on AND an OpenAI key is present.
    // Without a key the embed call would fail on every fire — fail-open would
    // still work, but we'd burn 3s of timeout per response. Safer to gate
    // entirely on key presence.
    const semanticFlag = process.env.ENABLE_SEMANTIC_ANTI_REPEAT === "true";
    const openAiKey = config.openAiKey ?? "";
    this.semanticEnabled = semanticFlag && openAiKey.length > 0;
    if (this.semanticEnabled) {
      for (const p of this.pack.personas) {
        // K=10 ring (covers a full 2-hour session's worth of recent fires for
        // personas that fire frequently). τ=0.82 per the ticket spec.
        this.semanticCaches.set(p.id, new SemanticCache(openAiKey, 10, 0.82));
      }
    }
  }

  /** Exposes the active pack's meta so the route can log packId per session. */
  getPackMeta(): Pack["meta"] {
    return this.pack.meta;
  }

  /** Log a fresh chunk of video transcript so personas can reference it. */
  private logTranscriptDelta(transcript: string): void {
    // Only log the text added since the last log (to avoid re-logging the same
    // words over and over as the rolling buffer grows).
    if (transcript.length <= this.lastTranscriptLength) return;
    const delta = transcript.slice(this.lastTranscriptLength).trim();
    if (delta.length >= 20) {
      // Keep each snapshot tight — the FULL transcript is shown separately as
      // the primary signal. These log snippets are just "what moment was being
      // discussed when each persona spoke", for anti-repeat bookkeeping.
      const snippet = delta.length > 160 ? "…" + delta.slice(-150) : delta;
      this.conversationLog.push({
        personaId: null,
        text: snippet,
        timestamp: Date.now(),
      });
      this.trimLog();
    }
    this.lastTranscriptLength = transcript.length;
  }

  private trimLog(): void {
    if (this.conversationLog.length > this.LOG_MAX) {
      this.conversationLog = this.conversationLog.slice(-this.LOG_MAX);
    }
  }

  /** Build the conversation-log view passed to a persona's system prompt. */
  private buildConversationLogView(): ConversationEntry[] {
    const now = Date.now();
    const recent = this.conversationLog.slice(-this.LOG_WINDOW);
    return recent.map((entry) => {
      if (entry.personaId === null) {
        return {
          personaName: "",
          personaEmoji: "",
          text: entry.text,
          secondsAgo: Math.round((now - entry.timestamp) / 1000),
        };
      }
      const p = this.personas.find((x) => x.id === entry.personaId);
      return {
        personaName: p?.name || "Someone",
        personaEmoji: p?.emoji || "",
        text: entry.text,
        secondsAgo: Math.round((now - entry.timestamp) / 1000),
      };
    });
  }

  /**
   * Fire a SINGLE persona against the current transcript.
   * Used by the Director for natural staggered conversation.
   *
   * @param personaId - Which persona to fire
   * @param transcript - Current transcript text
   * @param onStream - Streaming callback
   * @param isSilence - If true, persona reacts to dead air / crickets on the
   *   show (the transcript went quiet for a while). NOT a viewer pause.
   * @param cascadeFrom - If this is a cascade, the previous persona's response to riff on
   * @param isForceReact - If true, the persona is told NOT to pass with "-".
   *   Used by the emoji-tap path in /api/transcribe: the user clicked that
   *   specific avatar, so that specific avatar must speak — passing silently
   *   makes the UI look broken (spinner fires, no text, tap seems ignored).
   *   Off-limits to the Director cascade path, which still uses "-" to keep
   *   the sidebar conversational instead of wall-to-wall.
   * @returns The full response text (for feeding into the next cascade)
   */
  async fireSingle(
    personaId: string,
    transcript: string,
    onStream: StreamCallback,
    isSilence = false,
    cascadeFrom?: { personaId: string; name: string; emoji: string; text: string },
    isForceReact = false
  ): Promise<string> {
    const persona = this.personas.find((p) => p.id === personaId);
    if (!persona) {
      logPipeline({ event: "persona_not_found", level: "error", data: { personaId } });
      return "";
    }

    // Log a fresh chunk of transcript (if any) before the persona fires,
    // so the conversation log view includes the latest thing the video said.
    if (!isSilence) this.logTranscriptDelta(transcript);

    // Build cross-persona context: other personas' LAST responses + cascade source
    const otherPersonas: OtherPersonaResponse[] = [];
    for (const op of this.personas) {
      if (op.id === persona.id) continue;
      const prev = this.previousResponses.get(op.id) || [];
      if (prev.length > 0) {
        otherPersonas.push({
          name: op.name,
          emoji: op.emoji,
          text: prev[prev.length - 1],
        });
      }
    }

    // If this is a cascade, make the triggering response the FIRST thing they see
    if (cascadeFrom) {
      // Move the cascade source to the front so this persona reacts to it
      const idx = otherPersonas.findIndex(
        (op) => op.name === cascadeFrom.name
      );
      if (idx !== -1) {
        otherPersonas[idx].text = cascadeFrom.text; // update with latest
        const [source] = otherPersonas.splice(idx, 1);
        otherPersonas.unshift(source);
      }
    }

    // Fetch search results for producer.
    //
    // Explicitly SKIPPED on isForceReact: a tap on Baba's avatar must feel
    // instant, and search is the only pre-stream I/O this persona does. A
    // slow or hung upstream (Brave 500, xAI Live Search drag) would block
    // `firePersona` from ever starting, leaving the avatar's spinner running
    // with no bubble to show for it — the exact "animates and doesn't
    // respond" symptom we shipped in v1.4. Baba's prompt already handles the
    // no-search case (context / callback / heads-up / self-deprecating), so
    // skipping on force-react costs us a fact but never the response itself.
    // Director-driven fires still fetch search — that path has budget for
    // the round-trip and benefits from cited facts.
    // Decide + log separately so a force-react skip is trackable. Baba fires
    // without citation context in that branch, which degrades his value
    // prop; if tap frequency is high we may want to revisit (e.g. serve a
    // cached recent-fact lookup on tap instead of skipping entirely).
    let searchResults: string | undefined;
    if (persona.id === "producer" && !isSilence) {
      if (isForceReact) {
        logPipeline({
          event: "search_skip",
          level: "info",
          personaId: persona.id,
          data: { reason: "force_react", engine: this.searchEngine },
        });
      } else {
        searchResults = await this.fetchSearchResults(transcript);
      }
    }

    const conversationLog = this.buildConversationLogView();

    try {
      await this.firePersona(
        persona,
        transcript,
        searchResults,
        onStream,
        otherPersonas,
        isSilence,
        conversationLog,
        isForceReact
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logPipeline({ event: "persona_error", level: "error", personaId: persona.id, data: { error: msg } });
      onStream({
        personaId: persona.id,
        text: `[${persona.name} is having technical difficulties]`,
        done: true,
      });
    }

    // Return the full response for cascade feeding
    const prev = this.previousResponses.get(personaId) || [];
    return prev.length > 0 ? prev[prev.length - 1] : "";
  }

  /**
   * Fire all 4 personas in parallel against the current transcript.
   * Used by the 🔥 React button path — when the user explicitly asks for
   * reactions, we skip the Director and get everyone on the mic.
   *
   * @param isSilence - If true, personas react to the dead-air moment on the
   *   show (transcript went quiet) instead of to fresh content.
   * @param isForceReact - If true, personas are told NOT to pass with "-" —
   *   the user explicitly hit the React button and expects visible takes.
   */
  async fireAll(
    transcript: string,
    onStream: StreamCallback,
    isSilence = false,
    isForceReact = false
  ): Promise<void> {
    const doneAll = logTimed("personas_fire_all", "info", {
      data: {
        transcriptLength: transcript.length,
        isSilence,
        isForceReact,
        personaCount: this.personas.length,
      },
    });

    if (!isSilence) this.logTranscriptDelta(transcript);

    // Start fact-check search in parallel (skip if paused — nothing new to check)
    const searchPromise = isSilence
      ? Promise.resolve(undefined)
      : this.fetchSearchResults(transcript);

    // Build cross-persona context: each persona sees the others' last response
    const otherPersonaMap = new Map<string, OtherPersonaResponse[]>();
    for (const p of this.personas) {
      const others: OtherPersonaResponse[] = [];
      for (const op of this.personas) {
        if (op.id === p.id) continue;
        const prev = this.previousResponses.get(op.id) || [];
        if (prev.length > 0) {
          others.push({
            name: op.name,
            emoji: op.emoji,
            text: prev[prev.length - 1],
          });
        }
      }
      otherPersonaMap.set(p.id, others);
    }

    // Snapshot the conversation log so all 4 parallel fires see the same view
    const logView = this.buildConversationLogView();

    const tasks = this.personas.map(async (persona) => {
      try {
        const searchResults =
          persona.id === "producer" ? await searchPromise : undefined;

        const otherPersonas = otherPersonaMap.get(persona.id) || [];

        await this.firePersona(
          persona,
          transcript,
          searchResults,
          onStream,
          otherPersonas,
          isSilence,
          logView,
          isForceReact
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logPipeline({ event: "persona_error", level: "error", personaId: persona.id, data: { error: msg } });
        onStream({
          personaId: persona.id,
          text: `[${persona.name} is having technical difficulties]`,
          done: true,
        });
      }
    });

    // Promise.allSettled — one failure doesn't block the others
    await Promise.allSettled(tasks);
    doneAll({ completed: true });
  }

  private async firePersona(
    persona: Persona,
    transcript: string,
    searchResults: string | undefined,
    onStream: StreamCallback,
    otherPersonas: OtherPersonaResponse[] = [],
    isSilence = false,
    conversationLog: ConversationEntry[] = [],
    isForceReact = false
  ): Promise<void> {
    const donePersona = logTimed("persona_fire", "info", {
      personaId: persona.id,
      data: {
        model: persona.model,
        hasSearchResults: !!searchResults,
        otherPersonaCount: otherPersonas.length,
        logSize: conversationLog.length,
        isForceReact,
      },
    });

    const previous = this.previousResponses.get(persona.id) || [];

    // Inject the repeat-slot text (if any) so the model is told explicitly
    // not to paraphrase its most-recently-flagged response. Skipped when
    // isForceReact is true — force-react already overrides all pass/format
    // rules and the additional constraint can conflict with the "you MUST
    // produce something" directive, causing model confusion.
    const lastRepeatText =
      !isForceReact ? (this.repeatSlots.get(persona.id) ?? undefined) : undefined;

    const context = buildPersonaContext(
      persona,
      transcript,
      previous,
      searchResults,
      otherPersonas,
      isSilence,
      conversationLog,
      isForceReact,
      lastRepeatText
    );

    let fullResponse = "";
    // PASS-DETECTION strategy: buffer the very first chunk. If the response
    // starts with a bare dash (pass signal), we drop the whole thing. Otherwise
    // we flush the buffer and continue streaming normally so the UX still
    // feels live.
    const PASS_BUFFER_CHARS = 12;
    let passBuffer = "";
    let passDecided = false; // once we flush or declare a pass, stream directly
    let passed = false;

    const handleDelta = (delta: string) => {
      fullResponse += delta;
      if (passed) return; // dropped — ignore further deltas
      if (passDecided) {
        onStream({ personaId: persona.id, text: delta, done: false });
        return;
      }
      passBuffer += delta;
      // Keep buffering until we have enough to decide, unless the stream is
      // clearly past the "dash pass" signal already.
      if (passBuffer.trim().length >= 2 || passBuffer.length >= PASS_BUFFER_CHARS) {
        const early = passBuffer.trim();
        // Pass-if: starts with a dash AND is very short or only whitespace after
        if (/^-(\s|$)/.test(early) && early.length <= 3) {
          passed = true;
          return;
        }
        // Not a pass: flush the buffer as one chunk and switch to direct streaming
        passDecided = true;
        onStream({ personaId: persona.id, text: passBuffer, done: false });
        passBuffer = "";
      }
    };

    // Pick the concrete xAI model id for any persona whose alias routes to
    // Grok. Kept local to firePersona so the alias→id mapping stays next to
    // the call site rather than scattered across the file. Easy to extend
    // later (grok-4-fast-reasoning for a director, etc.) by branching here.
    const xaiModelId = (alias: Persona["model"]): string => {
      switch (alias) {
        case "xai-grok-4-fast":
          // Non-reasoning variant: The Troll is instinctual/fast, not
          // deliberative. Reasoning mode would add latency and push the
          // voice toward over-considered takes — wrong gear for this slot.
          return "grok-4-1-fast-non-reasoning";
        default:
          throw new Error(`No xAI model mapping for alias: ${alias}`);
      }
    };

    // ── UPSTREAM STREAM (with force-react error fallback) ──
    // A force-react tap has already committed to "this persona speaks." If the
    // provider errors out BEFORE we've flushed any content to the client
    // (rate limit, 5xx, network blip), a raw throw here would bubble to
    // fireSingle's outer catch and emit "[technical difficulties]" — which is
    // both unhelpful voice and, historically, got swallowed entirely by a
    // streamCallback bug that dropped text on done=true. So: for force-react,
    // we route upstream failures to the same deterministic fallback we already
    // use for model-initiated "-" passes. For non-force-react paths, we still
    // rethrow — the director's caller decides how to present failures.
    // 25s upstream-stream ceiling. Typical responses finish in 2-4s; this
    // only trips when the provider gets stuck mid-stream or never ACKs.
    // Without it, the Anthropic SDK's default ~10 min timeout would lock
    // the route's per-session `personasFiring` flag for that entire window
    // and strand every director tick + avatar tap on the session. 25s is
    // comfortably under the route-level safety budget but well past the
    // 99th-percentile response time, so healthy streams never see it.
    const STREAM_TIMEOUT_MS = 25_000;
    try {
      if (persona.model === "claude-haiku") {
        const stream = this.anthropic.messages.stream(
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [{ role: "user", content: context }],
          },
          { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) }
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            handleDelta(event.delta.text);
          }
        }
      } else if (persona.model === "xai-grok-4-fast") {
        // xAI Grok via raw fetch against the OpenAI-compatible endpoint.
        // System-role carries the persona prompt so Grok's native voice
        // training gets a clean anchor; the `context` in user-role carries
        // transcript + force-react preamble + self-check.
        for await (const delta of this.streamXai(
          xaiModelId(persona.model),
          [
            { role: "system", content: persona.systemPrompt },
            { role: "user", content: context },
          ],
          AbortSignal.timeout(STREAM_TIMEOUT_MS)
        )) {
          handleDelta(delta);
        }
      } else {
        // TypeScript-exhaustiveness guard. If Persona["model"] gets a new
        // alias and someone forgets to add a branch above, this throws
        // loudly at fire time instead of silently no-op'ing the persona.
        const _exhaustive: never = persona.model;
        throw new Error(`Unrouted persona model alias: ${String(_exhaustive)}`);
      }
    } catch (streamErr) {
      const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      // Only intercept when the tap hasn't already seen visible content.
      // If passDecided is true we've already streamed a partial bubble; in
      // that case preserve what the viewer saw and let the done frame close
      // it cleanly rather than double-bubbling the fallback on top.
      if (isForceReact && !passDecided) {
        const fallback = getForceReactFallback(persona);
        logPipeline({
          event: "force_react_fallback",
          level: "warn",
          personaId: persona.id,
          data: { reason: "upstream_error", error: errMsg, fallback },
        });
        onStream({ personaId: persona.id, text: fallback, done: false });
        onStream({ personaId: persona.id, text: "", done: true });
        this.storeResponse(persona.id, fallback);
        this.conversationLog.push({
          personaId: persona.id,
          text: fallback,
          timestamp: Date.now(),
        });
        this.trimLog();
        donePersona({ responseLength: fallback.length, fallback: true, upstreamError: errMsg });
        return;
      }
      // Non-force-react (director cascades, 🔥 burst individual failures):
      // rethrow so the existing outer catch emits its technical-difficulties
      // message. With the route's streamCallback fix, that message now
      // actually reaches the client instead of being dropped.
      throw streamErr;
    }

    // Final decision if we never left the buffer phase (tiny responses)
    if (!passDecided && !passed) {
      const finalEarly = passBuffer.trim();
      if (/^-(\s|$)?$/.test(finalEarly) && finalEarly.length <= 2) {
        passed = true;
      } else if (passBuffer) {
        onStream({ personaId: persona.id, text: passBuffer, done: false });
      }
    }

    if (passed) {
      // ── FORCE-REACT SAFETY NET ──
      // The model is NOT allowed to decide IF it responds on an explicit tap —
      // only HOW it responds. If the model tried to pass with "-" anyway, we
      // override that decision with a deterministic in-voice fallback so the
      // viewer always sees something after tapping. Pass behavior is fine for
      // director-driven fires (where the director hasn't committed to a
      // response yet); it's not fine for user-initiated taps.
      if (isForceReact) {
        const fallback = getForceReactFallback(persona);
        logPipeline({
          event: "force_react_fallback",
          level: "warn",
          personaId: persona.id,
          data: { reason: "model_returned_dash_pass_on_force_react", fallback },
        });
        onStream({ personaId: persona.id, text: fallback, done: false });
        onStream({ personaId: persona.id, text: "", done: true });
        this.storeResponse(persona.id, fallback);
        this.conversationLog.push({
          personaId: persona.id,
          text: fallback,
          timestamp: Date.now(),
        });
        this.trimLog();
        donePersona({ responseLength: fallback.length, fallback: true });
        return;
      }

      logPipeline({
        event: "persona_pass",
        level: "info",
        personaId: persona.id,
        data: { reason: "explicit_dash_pass" },
      });
      onStream({ personaId: persona.id, text: "", done: true });
      donePersona({ responseLength: 0, passed: true });
      return;
    }

    // Normal completion
    onStream({ personaId: persona.id, text: "", done: true });

    const trimmed = fullResponse.trim();
    donePersona({ responseLength: trimmed.length, preview: trimmed.slice(0, 100) });

    // Store response for continuity (both per-persona history AND shared log)
    this.storeResponse(persona.id, trimmed);
    this.conversationLog.push({
      personaId: persona.id,
      text: trimmed,
      timestamp: Date.now(),
    });
    this.trimLog();

    // ── SEMANTIC ANTI-REPEAT CHECK (SET-15, Option B) ──
    // Runs AFTER `done` has been sent — no streaming UX impact.
    // Skipped on isForceReact (speed path) and when the feature is off.
    if (this.semanticEnabled && !isForceReact && trimmed.length > 0) {
      const cache = this.semanticCaches.get(persona.id);
      if (cache) {
        // Fire-and-forget at the call site, but we await it internally so
        // the repeat-slot is written synchronously with respect to the next
        // tick. The outer `firePersona` is still `async` so the route's
        // `fireSingle` / `fireAll` wrapper waits for us here anyway.
        const { flagged, maxSim, error } = await cache.addAndCheck(trimmed, persona.id);

        if (error) {
          // Already logged inside addAndCheck (semantic_embed_error). Nothing
          // more to do — slot is left unchanged (neither set nor cleared) so
          // the previous instruction (if any) is still injected next turn.
        } else if (flagged) {
          logPipeline({
            event: "persona_reroll_flagged",
            level: "info",
            personaId: persona.id,
            data: {
              maxSim: Math.round(maxSim * 1000) / 1000,
              textLen: trimmed.length,
              preview: trimmed.slice(0, 80),
            },
          });
          // Store the flagged draft for injection on the next fire.
          this.repeatSlots.set(persona.id, trimmed);
        } else {
          // Draft cleared the threshold — remove any existing slot.
          this.repeatSlots.delete(persona.id);
          if (maxSim > 0) {
            // Log near-misses (above 0.70) at debug level for τ calibration.
            // These are not flagged but are useful data for SET-17.
            if (maxSim > 0.70) {
              logPipeline({
                event: "persona_similarity_near_miss",
                level: "debug",
                personaId: persona.id,
                data: { maxSim: Math.round(maxSim * 1000) / 1000 },
              });
            }
          }
        }
      }
    }
  }

  /**
   * Stream a chat completion from xAI's Grok API (OpenAI-compatible SSE).
   * Yields text deltas only — the caller is responsible for buffering and
   * pass-detection. Throws on missing key, non-2xx response, or malformed
   * stream. All error shapes are caught by the upstream-stream try/catch
   * inside firePersona, which routes force-react taps to the deterministic
   * fallback and rethrows for director-driven calls.
   *
   * Kept SDK-free on purpose: xAI's surface area we need is one endpoint
   * with one message shape, and the `openai` package would be another
   * ~5MB dep for a ~50-line fetch wrapper.
   */
  private async *streamXai(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    if (!this.xaiKey) {
      throw new Error("xAI API key not configured (set X-XAI-Key header or XAI_API_KEY env)");
    }

    // The caller passes an AbortSignal backed by AbortSignal.timeout so a
    // stalled or silent-midstream xAI connection can't hang firePersona
    // forever. Plumbed through to both the initial fetch AND every
    // reader.read() via the body-stream tie — aborting the signal cancels
    // both. See firePersona's STREAM_TIMEOUT_MS comment for the reasoning.
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.xaiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 200,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      // Preserve the body in the error so rate-limit / auth failures surface
      // readably in the force_react_fallback log line.
      const body = await response.text().catch(() => "<unreadable body>");
      throw new Error(`xAI API ${response.status}: ${body.slice(0, 500)}`);
    }
    if (!response.body) {
      throw new Error("xAI API returned no response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    // SSE chunks can split across network frames mid-line. Buffer everything
    // that isn't terminated by a newline and carry it into the next read.
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the (possibly partial) last line in the buffer.
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Malformed individual chunk — skip rather than abort the stream.
            // xAI occasionally includes keepalive or metadata frames that
            // don't parse; losing one delta is better than killing the fire.
          }
        }
      }
    } finally {
      // Be kind to the connection pool even on early termination.
      reader.releaseLock();
    }
  }

  private storeResponse(personaId: string, response: string): void {
    const prev = this.previousResponses.get(personaId) || [];
    prev.push(response);
    if (prev.length > this.MAX_PREVIOUS) {
      prev.shift();
    }
    this.previousResponses.set(personaId, prev);
  }

  // ──────────────────────────────────────────────────────
  // FACT-CHECKING PIPELINE
  // ──────────────────────────────────────────────────────

  /**
   * Extract verifiable claims from the transcript and search for each.
   * Returns formatted search results for the Producer to cross-reference.
   */
  private async fetchSearchResults(
    transcript: string
  ): Promise<string | undefined> {
    // Route on the session's configured search engine. Both branches share
    // the same claim-extraction logic — they differ only in how the actual
    // "look this up on the web" step runs. That keeps the Producer's prompt
    // shape identical whether we're using Brave or xAI under the hood.
    const engine = this.searchEngine;
    const requiredKey = engine === "brave" ? this.braveApiKey : this.xaiKey;
    if (!requiredKey) {
      logPipeline({
        event: "search_skip",
        level: "debug",
        data: { reason: "no_api_key", engine },
      });
      return undefined;
    }

    try {
      // Focus on the most recent portion of the transcript
      const recentText = transcript.slice(-1500);

      // Split into sentences
      const sentences = recentText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15);

      if (sentences.length === 0) {
        logPipeline({
          event: "search_no_claims_detected",
          level: "info",
          data: { reason: "no_sentences", engine, transcriptLength: transcript.length },
        });
        return undefined;
      }

      // Score each sentence by how likely it is to contain a verifiable claim
      const scoredClaims = sentences
        .map((sentence) => {
          let score = 0;
          for (const pattern of CLAIM_PATTERNS) {
            if (pattern.test(sentence)) score++;
          }
          // Bonus for sentences with specific numbers
          const numberMatches = sentence.match(/\d+/g);
          if (numberMatches) score += Math.min(numberMatches.length, 2);
          // Bonus for proper nouns (capitalized words mid-sentence)
          const properNouns = sentence.match(/\s[A-Z][a-z]+/g);
          if (properNouns) score += Math.min(properNouns.length, 2);

          return { sentence, score };
        })
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scoredClaims.length === 0) {
        // This is a value-reducing branch: Baba fires without search context
        // because our claim-extraction heuristics flagged nothing. If this
        // fires too often, the CLAIM_PATTERNS regex set probably needs a
        // new rule (common in new domains — see how many TWiST episodes
        // lean on startup-speak the old Howard patterns never caught).
        logPipeline({
          event: "search_no_claims_detected",
          level: "info",
          data: { reason: "no_claims_scored", engine, sentenceCount: sentences.length },
        });
        return undefined;
      }

      // Take top 2-3 claims and search in parallel
      const topClaims = scoredClaims.slice(0, 3);

      const searchTasks = topClaims.map(async ({ sentence }) => {
        const query = this.buildSearchQuery(sentence);
        return engine === "brave"
          ? this.searchBrave(query)
          : this.searchXai(query);
      });

      const results = await Promise.allSettled(searchTasks);

      // Combine all successful search results + count outcomes so we can
      // see the hit rate per engine at the aggregate level. Individual
      // failure reasons are logged inside searchBrave/searchXai.
      const allResults: string[] = [];
      let succeeded = 0;
      let emptyOrFailed = 0;
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          allResults.push(
            `--- CLAIM: "${topClaims[i].sentence.slice(0, 100)}..." ---`
          );
          allResults.push(result.value);
          allResults.push("");
          succeeded++;
        } else {
          emptyOrFailed++;
        }
      });

      logPipeline({
        event: "search_complete",
        level: succeeded === 0 ? "warn" : "info",
        data: {
          engine,
          attempted: topClaims.length,
          succeeded,
          emptyOrFailed,
          // Flag the value-reducing outcome so we can alert on it: Baba
          // fires without citation context even though we had claims to
          // check, which usually means the upstream is degraded.
          degraded: succeeded === 0,
        },
      });

      return allResults.length > 0 ? allResults.join("\n") : undefined;
    } catch (err) {
      // The outer try/catch used to swallow everything silently — meaning a
      // regex bug or an unexpected throw inside claim extraction would
      // silently neuter Baba's fact-checking. Log the shape so we can tell
      // "upstream blew up" (handled per-engine below) from "our own
      // pipeline threw" (handled here).
      logPipeline({
        event: "search_pipeline_error",
        level: "error",
        data: {
          engine,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return undefined;
    }
  }

  /**
   * Build a focused search query from a claim sentence.
   * Strips filler words and focuses on the verifiable core.
   */
  private buildSearchQuery(sentence: string): string {
    // Remove common filler phrases
    let query = sentence
      .replace(
        /^(I think|I believe|you know|like|so|well|basically|honestly|look|I mean)\s*/gi,
        ""
      )
      .replace(/\s+(right|you know|like|basically)\s*/gi, " ")
      .trim();

    // If the claim mentions a company/person + a fact, build a targeted query
    // e.g., "Uber was founded in 2007" → "Uber founding year"
    const foundedMatch = query.match(
      /(\w+)\s+(?:was|were)\s+(?:founded|started|created|launched)\s+(?:in\s+)?(\d{4})/i
    );
    if (foundedMatch) {
      return `${foundedMatch[1]} founded year ${foundedMatch[2]}`;
    }

    // e.g., "Tesla is worth 800 billion" → "Tesla market cap valuation"
    const valuationMatch = query.match(
      /(\w+)\s+(?:is|was|are)\s+(?:worth|valued at)\s+(.+)/i
    );
    if (valuationMatch) {
      return `${valuationMatch[1]} valuation market cap ${valuationMatch[2]}`;
    }

    // e.g., "They raised 50 million" → keep as-is but trim
    // Default: use the first 120 chars of the claim
    return query.slice(0, 120);
  }

  /**
   * Execute a single Brave Search query and format results.
   */
  private async searchBrave(query: string): Promise<string | undefined> {
    const BRAVE_TIMEOUT_MS = 5000;
    try {
      // 5-second hard timeout. Node's native fetch has no default timeout,
      // so a silently-stalled upstream would hang the producer's fireSingle
      // forever and strand the avatar's spinner. 5s is generous for Brave
      // (typical <1s) and well below the client's 15s safety timeout, so
      // even a director-driven fact-check that bails out still gives
      // firePersona time to produce a visible in-voice fallback.
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&freshness=py`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": this.braveApiKey,
          },
          signal: AbortSignal.timeout(BRAVE_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        logPipeline({
          event: "search_upstream_error",
          level: "warn",
          data: {
            engine: "brave",
            status: response.status,
            query: query.slice(0, 100),
          },
        });
        return undefined;
      }

      const data = await response.json();
      const results = data.web?.results || [];

      if (results.length === 0) {
        // Brave returned 200 but no hits. This isn't an error, but it IS
        // value-reducing: the Producer will have to fall back to its own
        // knowledge for this claim. Track frequency so we can tune the
        // query builder (freshness window, term extraction, etc.) if the
        // empty-hit rate climbs.
        logPipeline({
          event: "search_empty_result",
          level: "info",
          data: { engine: "brave", query: query.slice(0, 100) },
        });
        return undefined;
      }

      return results
        .map(
          (r: { title: string; description: string; url: string }) =>
            `• [${r.title}] ${r.description}`
        )
        .join("\n");
    } catch (err) {
      // AbortSignal.timeout() throws a DOMException with name "TimeoutError"
      // in Node 18+. Split timeout from generic network errors so operational
      // dashboards can distinguish a slow upstream (actionable: raise the
      // ceiling or switch engines) from a transient failure.
      const isTimeout =
        err instanceof DOMException && err.name === "TimeoutError";
      logPipeline({
        event: isTimeout ? "search_timeout" : "search_upstream_error",
        level: "warn",
        data: {
          engine: "brave",
          query: query.slice(0, 100),
          ...(isTimeout
            ? { timeoutMs: BRAVE_TIMEOUT_MS }
            : { error: err instanceof Error ? err.message : String(err) }),
        },
      });
      return undefined;
    }
  }

  /**
   * Execute a single fact-check query using xAI's Grok Live Search.
   *
   * Unlike Brave — which returns raw SERP entries — xAI's search returns a
   * synthesized answer with inline citations in one call. We force
   * `search_parameters.mode = "on"` so Grok ALWAYS consults the web for this
   * call (otherwise Grok's "auto" heuristic sometimes answers from training
   * data alone, which is exactly what we're trying to avoid for fact checks).
   *
   * We use the non-reasoning variant here — fact-checking is fetch-and-cite,
   * not multi-step reasoning, and the non-reasoning model is cheaper and
   * faster. If we ever need chained reasoning on a claim, swap to the
   * reasoning variant on this one call without touching the persona models.
   */
  private async searchXai(query: string): Promise<string | undefined> {
    if (!this.xaiKey) return undefined;
    const XAI_TIMEOUT_MS = 8000;
    try {
      // 8-second hard timeout. xAI Live Search is a search + synthesis
      // round-trip, so it's inherently slower than Brave — we give it a
      // little more headroom but still well under the client's 15s safety
      // timeout. Without this, a stalled upstream would block the
      // producer's fireSingle forever (see the Baba silent-spin bug that
      // shipped in v1.4 when this function was first introduced).
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.xaiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4-1-fast-non-reasoning",
          messages: [
            {
              role: "system",
              content:
                "You are a terse fact-check assistant. For the given claim, answer with 1-3 bullet points of verified facts, each followed by its source URL in parens. Do not editorialize. If the search returns no reliable data, say so and stop.",
            },
            { role: "user", content: `Fact-check this claim: ${query}` },
          ],
          max_tokens: 300,
          stream: false,
          search_parameters: {
            mode: "on",
            sources: [{ type: "web" }],
            max_search_results: 5,
            return_citations: true,
          },
        }),
        signal: AbortSignal.timeout(XAI_TIMEOUT_MS),
      });

      if (!response.ok) {
        logPipeline({
          event: "search_upstream_error",
          level: "warn",
          data: {
            engine: "xai",
            status: response.status,
            query: query.slice(0, 100),
          },
        });
        return undefined;
      }

      const data = await response.json();
      const answer: string | undefined =
        data?.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        // xAI returned 200 with no synthesized answer — the call cost money
        // and time but gave the Producer nothing to cite. Log so we can
        // spot patterns (e.g. specific claim shapes that consistently
        // produce empty synths) and tune the prompt or fall back to Brave.
        logPipeline({
          event: "search_empty_result",
          level: "info",
          data: { engine: "xai", query: query.slice(0, 100) },
        });
        return undefined;
      }

      // xAI may attach citations either as top-level `citations` or on the
      // message itself — we accept either and append unique URLs so the
      // Producer can quote them if the bullet text alone isn't clear.
      const citations: string[] = Array.isArray(data?.citations)
        ? data.citations
        : Array.isArray(data?.choices?.[0]?.message?.citations)
          ? data.choices[0].message.citations
          : [];
      const uniqueCites = Array.from(
        new Set(citations.filter((c) => typeof c === "string"))
      ).slice(0, 3);

      return uniqueCites.length > 0
        ? `${answer}\n(sources: ${uniqueCites.join(", ")})`
        : answer;
    } catch (err) {
      const isTimeout =
        err instanceof DOMException && err.name === "TimeoutError";
      logPipeline({
        event: isTimeout ? "search_timeout" : "search_upstream_error",
        level: "warn",
        data: {
          engine: "xai",
          query: query.slice(0, 100),
          ...(isTimeout
            ? { timeoutMs: XAI_TIMEOUT_MS }
            : { error: err instanceof Error ? err.message : String(err) }),
        },
      });
      return undefined;
    }
  }
}
