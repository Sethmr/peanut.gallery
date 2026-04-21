/**
 * Peanut Gallery — Semantic anti-repetition cache
 *
 * Per-persona ring buffer of recent response embeddings. After each successful
 * persona fire, the response is embedded and checked against the ring.
 *
 * Design (Option B from the Opus SET-8 review — supersedes PR #61):
 * - Stream normally — tokens flow to SSE in real time. No buffering.
 * - Embed at end-of-stream (after `done` frame has been sent).
 * - On similarity hit (maxSim > τ): log `persona_reroll_flagged`, store the
 *   flagged draft in the persona's "repeat slot" for injection on the next fire.
 * - On the NEXT fire for that persona: inject "AVOID repeating or paraphrasing:
 *   '<flagged draft>' — find a different angle." into the prompt context, then
 *   clear the slot once the new draft clears threshold.
 * - Fail-open: embed errors skip the check, emit `semantic_embed_error`, and
 *   leave the repeat slot unchanged.
 *
 * Enabled by ENABLE_SEMANTIC_ANTI_REPEAT=true env flag.
 * Skipped on isForceReact=true (force-react wants speed, not dedup).
 *
 * Embedding: OpenAI text-embedding-3-small via raw fetch (no SDK dep — matches
 * the xAI fetch pattern already established in persona-engine.ts).
 */

import { logPipeline } from "./debug-logger";

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_TIMEOUT_MS = 3000;

export class SemanticCache {
  private readonly threshold: number;
  private readonly ringSize: number;
  private readonly openAiKey: string;

  /** Circular ring buffer of embedding vectors. */
  private ring: number[][] = [];
  /** Next write position in the ring (circular). */
  private ringHead = 0;

  constructor(openAiKey: string, ringSize = 10, threshold = 0.82) {
    this.openAiKey = openAiKey;
    this.ringSize = ringSize;
    this.threshold = threshold;
  }

  /**
   * Cosine similarity between two equal-length float32 arrays.
   * Returns a value in [-1, 1]; values above the cache threshold indicate
   * near-duplicate responses.
   *
   * This is the single point of failure for the entire feature — unit-tested
   * explicitly in scripts/test-semantic-cache.ts.
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Embed `text` via OpenAI text-embedding-3-small.
   * Throws on network errors, non-2xx responses, or malformed payloads.
   * Caller catches and treats as fail-open.
   */
  private async embed(text: string): Promise<number[]> {
    const response = await fetch(OPENAI_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openAiKey}`,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable>");
      throw new Error(`OpenAI embed API ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const embedding: number[] | undefined = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("OpenAI embed API returned empty embedding");
    }
    return embedding;
  }

  /**
   * Embed `text`, check it against the ring buffer, then append it to the ring.
   *
   * Call order matters: check BEFORE append so the response isn't compared
   * against itself. On success, the vector is always added to the ring
   * regardless of whether it was flagged.
   *
   * @returns `{ flagged: true, maxSim }` when `maxSim > threshold`; otherwise
   *   `{ flagged: false, maxSim }`. On embed error: `{ flagged: false, maxSim:
   *   0, error }` — caller emits telemetry already set inside this method.
   */
  async addAndCheck(
    text: string,
    personaId: string
  ): Promise<{ flagged: boolean; maxSim: number; error?: string }> {
    let vec: number[];
    try {
      vec = await this.embed(text);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logPipeline({
        event: "semantic_embed_error",
        level: "warn",
        personaId,
        data: { error: error.slice(0, 300) },
      });
      return { flagged: false, maxSim: 0, error };
    }

    // Check against the current ring before appending.
    let maxSim = 0;
    for (const stored of this.ring) {
      const sim = SemanticCache.cosineSimilarity(vec, stored);
      if (sim > maxSim) maxSim = sim;
    }

    // Append to ring (circular overwrite once full).
    if (this.ring.length < this.ringSize) {
      this.ring.push(vec);
    } else {
      this.ring[this.ringHead] = vec;
      this.ringHead = (this.ringHead + 1) % this.ringSize;
    }

    const flagged = maxSim > this.threshold;
    return { flagged, maxSim };
  }
}
