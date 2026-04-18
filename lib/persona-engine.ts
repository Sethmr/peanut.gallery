/**
 * Peanut Gallery — Persona Engine
 *
 * Takes transcript chunks, fans out to 4 LLM calls in parallel,
 * and streams responses back via callbacks.
 *
 * Multi-provider: Groq (Llama) for speed, Claude Haiku for nuance.
 *
 * FACT-CHECKING PIPELINE (for Producer persona):
 * 1. Extract verifiable claims from recent transcript
 * 2. Run parallel Brave Search queries for each claim
 * 3. Inject search results into Producer's context
 * 4. Producer cross-references and corrects in real-time
 */

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { logPipeline, logTimed } from "./debug-logger";
import {
  buildPersonaContext,
  type Persona,
  type OtherPersonaResponse,
  type ConversationEntry,
} from "./personas";
import { howardPack } from "./packs/howard";
import type { Pack } from "./packs/types";

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

export class PersonaEngine {
  private anthropic: Anthropic;
  private groq: Groq;
  private braveApiKey: string;

  /**
   * The active pack. Defaults to the Howard pack so pre-v1.3 call sites that
   * construct the engine without a pack keep working unchanged. All internal
   * references to "the 4 personas" flow through `this.pack.personas`, which
   * means swapping packs is a constructor-arg change — no engine rewrite.
   */
  private pack: Pack;
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
    groqKey: string;
    braveSearchKey: string;
    /**
     * Optional. Defaults to the Howard pack (pre-v1.3 behavior). When v1.3's
     * pack selector forwards a user-chosen pack from the extension, the
     * transcribe route resolves it via `resolvePack(...)` and passes the
     * resulting `Pack` object here. `resolvePack` never returns undefined,
     * so this argument is either a valid Pack or unset.
     */
    pack?: Pack;
  }) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicKey });
    this.groq = new Groq({ apiKey: config.groqKey });
    this.braveApiKey = config.braveSearchKey;
    this.pack = config.pack ?? howardPack;

    // Initialize response history for every persona in the active pack
    for (const p of this.pack.personas) {
      this.previousResponses.set(p.id, []);
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
   * @returns The full response text (for feeding into the next cascade)
   */
  async fireSingle(
    personaId: string,
    transcript: string,
    onStream: StreamCallback,
    isSilence = false,
    cascadeFrom?: { personaId: string; name: string; emoji: string; text: string }
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

    // Fetch search results for producer
    const searchResults =
      persona.id === "producer" && !isSilence
        ? await this.fetchSearchResults(transcript)
        : undefined;

    const conversationLog = this.buildConversationLogView();

    try {
      await this.firePersona(
        persona,
        transcript,
        searchResults,
        onStream,
        otherPersonas,
        isSilence,
        conversationLog
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
    const context = buildPersonaContext(
      persona,
      transcript,
      previous,
      searchResults,
      otherPersonas,
      isSilence,
      conversationLog,
      isForceReact
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

    if (persona.model === "claude-haiku") {
      const stream = this.anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: context }],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          handleDelta(event.delta.text);
        }
      }
    } else {
      const model =
        persona.model === "groq-llama-70b"
          ? "llama-3.3-70b-versatile"
          : "llama-3.1-8b-instant";
      const stream = await this.groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: persona.systemPrompt },
          { role: "user", content: context },
        ],
        max_tokens: 200,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) handleDelta(delta);
      }
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
    if (!this.braveApiKey) {
      logPipeline({ event: "brave_search_skip", level: "debug", data: { reason: "no_api_key" } });
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

      if (sentences.length === 0) return undefined;

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

      if (scoredClaims.length === 0) return undefined;

      // Take top 2-3 claims and search in parallel
      const topClaims = scoredClaims.slice(0, 3);

      const searchTasks = topClaims.map(async ({ sentence }) => {
        // Build a focused search query from the claim
        const query = this.buildSearchQuery(sentence);
        return this.searchBrave(query);
      });

      const results = await Promise.allSettled(searchTasks);

      // Combine all successful search results
      const allResults: string[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          allResults.push(
            `--- CLAIM: "${topClaims[i].sentence.slice(0, 100)}..." ---`
          );
          allResults.push(result.value);
          allResults.push("");
        }
      });

      return allResults.length > 0 ? allResults.join("\n") : undefined;
    } catch {
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
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&freshness=py`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": this.braveApiKey,
          },
        }
      );

      if (!response.ok) return undefined;

      const data = await response.json();
      const results = data.web?.results || [];

      if (results.length === 0) return undefined;

      return results
        .map(
          (r: { title: string; description: string; url: string }) =>
            `• [${r.title}] ${r.description}`
        )
        .join("\n");
    } catch {
      return undefined;
    }
  }
}
