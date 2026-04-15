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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();

  if (!transcript) {
    return new Response(JSON.stringify({ error: "Missing transcript" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!groqKey) {
    return new Response(
      JSON.stringify({ error: "Missing GROQ_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const engine = new PersonaEngine({
    anthropicKey: anthropicKey || "",
    groqKey: groqKey,
    braveSearchKey: braveKey || "",
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
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
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
