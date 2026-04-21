/**
 * SemanticCache — per-persona ring buffer of response embeddings.
 *
 * Embeds persona outputs via OpenAI text-embedding-3-small (1536-dim,
 * $0.02/M tokens) and stores the last K=5 per persona. Before a new
 * response reaches the SSE client, PersonaEngine calls maxSimilarity()
 * to check cosine distance against the ring. If the result exceeds
 * τ=0.82 (configurable via the caller), the engine re-rolls once.
 *
 * Why OpenAI over a local model:
 *   - No new runtime dependency (raw fetch — same pattern as xAI).
 *   - text-embedding-3-small is cheap and fast (~50-100ms p99 round-trip).
 *   - Local alternatives (e.g. @xenova/transformers) add a large WASM bundle
 *     and cold-start latency that doesn't fit the streaming latency budget.
 *   - Tradeoff: requires OPENAI_API_KEY; feature is disabled if key absent.
 *
 * Gated externally by ENABLE_SEMANTIC_ANTI_REPEAT=true; this class is only
 * instantiated when that flag is set.
 *
 * SET-8
 */

/** Dimensionality of text-embedding-3-small output. */
const EMBED_DIM = 1536;

/** Max entries per persona before the oldest is evicted. */
const RING_SIZE = 5;

/** Hard timeout for the embedding API round-trip. */
const EMBED_TIMEOUT_MS = 5_000;

/** 1536-dimensional embedding vector. */
export type Embedding = number[];

interface RingEntry {
  embedding: Embedding;
}

export class SemanticCache {
  private rings = new Map<string, RingEntry[]>();
  private readonly openaiKey: string;

  constructor(openaiKey: string) {
    this.openaiKey = openaiKey;
  }

  /**
   * Embed text via OpenAI text-embedding-3-small.
   *
   * Throws on API error or timeout — callers should catch and treat a failure
   * as "no similarity data available this turn" (fail-open: skip the semantic
   * check rather than blocking the response).
   */
  async embed(text: string): Promise<Embedding> {
    if (!this.openaiKey) {
      throw new Error("SemanticCache: OPENAI_API_KEY not configured");
    }

    // Truncate conservatively — the API limit is 8192 tokens, not chars, but
    // 4000 chars comfortably covers any 1-2 sentence persona response.
    const input = text.slice(0, 4000);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input,
      }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable>");
      throw new Error(`OpenAI embeddings API ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const embedding: Embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBED_DIM) {
      throw new Error(
        `OpenAI embeddings API returned unexpected shape: length=${Array.isArray(embedding) ? embedding.length : "non-array"}`
      );
    }

    return embedding;
  }

  /**
   * Cosine similarity between two equal-length vectors.
   * Returns 0 for zero-norm vectors (avoids division by zero).
   */
  static cosineSimilarity(a: Embedding, b: Embedding): number {
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
   * Maximum cosine similarity between the given embedding and all stored
   * embeddings for personaId. Returns 0 if the ring is empty (first response —
   * nothing to compare against, always passes).
   */
  maxSimilarity(personaId: string, embedding: Embedding): number {
    const ring = this.rings.get(personaId) ?? [];
    if (ring.length === 0) return 0;
    return Math.max(...ring.map((e) => SemanticCache.cosineSimilarity(embedding, e.embedding)));
  }

  /**
   * Add an embedding to the ring for personaId.
   * Evicts the oldest entry once the ring exceeds RING_SIZE.
   */
  store(personaId: string, embedding: Embedding): void {
    if (!this.rings.has(personaId)) {
      this.rings.set(personaId, []);
    }
    const ring = this.rings.get(personaId)!;
    ring.push({ embedding });
    if (ring.length > RING_SIZE) {
      ring.shift();
    }
  }
}
