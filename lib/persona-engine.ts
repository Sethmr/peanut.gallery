/**
 * Peanut Gallery — Persona Engine
 *
 * Takes transcript chunks, fans out to 4 LLM calls in parallel,
 * and streams responses back via callbacks.
 *
 * Multi-provider: Groq (Llama) for speed, Claude Haiku for nuance.
 */

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { personas, buildPersonaContext, type Persona } from "./personas";

export interface PersonaResponse {
  personaId: string;
  text: string;
  done: boolean;
}

type StreamCallback = (response: PersonaResponse) => void;

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
   */
  async fireAll(
    transcript: string,
    onStream: StreamCallback
  ): Promise<void> {
    // For the producer, fetch search results for fact-checking
    const searchResults = await this.fetchSearchResults(transcript);

    const tasks = personas.map((persona) =>
      this.firePersona(persona, transcript, searchResults, onStream).catch(
        (err) => {
          console.error(`[${persona.id}] Error:`, err.message);
          onStream({
            personaId: persona.id,
            text: `[${persona.name} is having technical difficulties]`,
            done: true,
          });
        }
      )
    );

    // Promise.allSettled — one failure doesn't block the others
    await Promise.allSettled(tasks);
  }

  private async firePersona(
    persona: Persona,
    transcript: string,
    searchResults: string | undefined,
    onStream: StreamCallback
  ): Promise<void> {
    const previous = this.previousResponses.get(persona.id) || [];
    const context = buildPersonaContext(
      persona,
      transcript,
      previous,
      searchResults
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

  /**
   * Extract key claims from transcript and search Brave for fact-checking.
   * Only used by the Producer persona.
   */
  private async fetchSearchResults(
    transcript: string
  ): Promise<string | undefined> {
    if (!this.braveApiKey) return undefined;

    try {
      // Extract the most recent substantial claim from the transcript
      // Take the last ~500 chars and search for key factual claims
      const recentText = transcript.slice(-500);

      // Simple heuristic: search for the most specific/factual sentence
      const sentences = recentText
        .split(/[.!?]/)
        .filter((s) => s.trim().length > 20);
      if (sentences.length === 0) return undefined;

      // Pick the sentence most likely to contain a verifiable claim
      // (contains numbers, dates, names, or comparisons)
      const claimSentence =
        sentences.find(
          (s) =>
            /\d/.test(s) ||
            /founded|started|launched|raised|worth|billion|million|percent/i.test(
              s
            )
        ) || sentences[sentences.length - 1];

      const query = claimSentence.trim().slice(0, 150);

      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
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
            `[${r.title}] ${r.description} (${r.url})`
        )
        .join("\n");
    } catch {
      return undefined;
    }
  }
}
