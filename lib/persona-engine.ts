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
import {
  personas,
  buildPersonaContext,
  type Persona,
  type OtherPersonaResponse,
} from "./personas";

export interface PersonaResponse {
  personaId: string;
  text: string;
  done: boolean;
}

type StreamCallback = (response: PersonaResponse) => void;

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

  // Track previous responses per persona for continuity
  private previousResponses: Map<string, string[]> = new Map();
  private readonly MAX_PREVIOUS = 3;

  constructor(config: {
    anthropicKey: string;
    groqKey: string;
    braveSearchKey: string;
  }) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicKey });
    this.groq = new Groq({ apiKey: config.groqKey });
    this.braveApiKey = config.braveSearchKey;

    // Initialize response history
    for (const p of personas) {
      this.previousResponses.set(p.id, []);
    }
  }

  /**
   * Fire all 4 personas in parallel against the current transcript.
   * Streams each persona's response token-by-token via the callback.
   *
   * @param isPaused - If true, personas react to the pause instead of the show
   */
  async fireAll(
    transcript: string,
    onStream: StreamCallback,
    isPaused = false
  ): Promise<void> {
    // Start fact-check search in parallel (skip if paused — nothing new to check)
    const searchPromise = isPaused
      ? Promise.resolve(undefined)
      : this.fetchSearchResults(transcript);

    // Build cross-persona context: each persona sees the others' last response
    const otherPersonaMap = new Map<string, OtherPersonaResponse[]>();
    for (const p of personas) {
      const others: OtherPersonaResponse[] = [];
      for (const op of personas) {
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

    const tasks = personas.map(async (persona) => {
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
          isPaused
        );
      } catch (err) {
        console.error(
          `[${persona.id}] Error:`,
          err instanceof Error ? err.message : err
        );
        onStream({
          personaId: persona.id,
          text: `[${persona.name} is having technical difficulties]`,
          done: true,
        });
      }
    });

    // Promise.allSettled — one failure doesn't block the others
    await Promise.allSettled(tasks);
  }

  private async firePersona(
    persona: Persona,
    transcript: string,
    searchResults: string | undefined,
    onStream: StreamCallback,
    otherPersonas: OtherPersonaResponse[] = [],
    isPaused = false
  ): Promise<void> {
    const previous = this.previousResponses.get(persona.id) || [];
    const context = buildPersonaContext(
      persona,
      transcript,
      previous,
      searchResults,
      otherPersonas,
      isPaused
    );

    let fullResponse = "";

    if (persona.model === "claude-haiku") {
      // Use Anthropic Claude Haiku
      const stream = this.anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: context }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          onStream({
            personaId: persona.id,
            text: event.delta.text,
            done: false,
          });
        }
      }
    } else {
      // Use Groq (Llama models)
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
        if (delta) {
          fullResponse += delta;
          onStream({
            personaId: persona.id,
            text: delta,
            done: false,
          });
        }
      }
    }

    // Signal done
    onStream({
      personaId: persona.id,
      text: "",
      done: true,
    });

    // Store response for continuity
    this.storeResponse(persona.id, fullResponse);
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
    if (!this.braveApiKey) return undefined;

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
