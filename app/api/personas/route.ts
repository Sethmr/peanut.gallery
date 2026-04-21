/**
 * SSE endpoint: /api/personas
 *
 * Accepts a transcript string and fires all 4 personas against it.
 * Streams responses back via SSE.
 *
 * Useful for testing personas independently of the transcription pipeline.
 */

import { NextRequest } from "next/server";
import { PersonaEngine } from "@/lib/persona-engine";
import { resolvePack } from "@/lib/packs";
import { logPipeline } from "@/lib/debug-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { transcript, packId } = await req.json();

  if (!transcript) {
    return new Response(JSON.stringify({ error: "Missing transcript" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  // Need at least one of the two model providers — otherwise every persona
  // will hit the force-react fallback and the sidebar is all canned lines.
  if (!anthropicKey && !xaiKey) {
    return new Response(
      JSON.stringify({
        error: "Missing ANTHROPIC_API_KEY and XAI_API_KEY — need at least one.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Client may override the default search engine per request (useful for
  // the harness). Anything other than "xai" falls back to "brave" to match
  // the engine-level default.
  const rawSearchEngine = (req.headers.get("X-Search-Engine") || "").toLowerCase();
  const searchEngine: "brave" | "xai" = rawSearchEngine === "xai" ? "xai" : "brave";

  // resolvePack() never throws — unknown / missing / empty packId falls back
  // to Howard (see lib/packs/index.ts). Safe to call with any user input.
  const resolvedPack = resolvePack(packId);

  const engine = new PersonaEngine({
    anthropicKey: anthropicKey || "",
    braveSearchKey: braveKey || "",
    xaiKey: xaiKey || "",
    searchEngine,
    pack: resolvedPack,
    openaiKey: process.env.OPENAI_API_KEY || "",
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      const startedAt = Date.now();
      logPipeline({
        event: "personas_endpoint_start",
        level: "info",
        data: {
          packId: resolvedPack.meta.id,
          searchEngine,
          transcriptLen: transcript.length,
        },
      });
      try {
        await engine.fireAll(transcript, (response) => {
          if (response.done) {
            send("persona_done", { personaId: response.personaId });
          } else {
            send("persona", {
              personaId: response.personaId,
              text: response.text,
            });
          }
        });

        send("status", { status: "complete" });
        logPipeline({
          event: "personas_endpoint_complete",
          level: "info",
          data: {
            packId: resolvedPack.meta.id,
            durationMs: Date.now() - startedAt,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Log the full error context server-side — the SSE-emitted payload
        // is minimal so we don't leak internals to the client, but ops
        // needs the stack + context when debugging a streaming failure.
        logPipeline({
          event: "personas_endpoint_error",
          level: "error",
          data: {
            message,
            packId: resolvedPack.meta.id,
            searchEngine,
            transcriptLen: transcript.length,
            durationMs: Date.now() - startedAt,
            stack: err instanceof Error ? err.stack : undefined,
          },
        });
        send("error", { message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
