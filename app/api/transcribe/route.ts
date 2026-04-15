/**
 * SSE endpoint: /api/transcribe
 *
 * Accepts a YouTube URL, starts the transcription pipeline,
 * and streams transcript events + persona responses to the client.
 *
 * Event types:
 *   transcript    — real-time transcript text
 *   persona       — persona response (streaming tokens)
 *   persona_done  — persona finished responding
 *   status        — pipeline status updates
 *   error         — error events
 */

import { NextRequest } from "next/server";
import { TranscriptionManager } from "@/lib/transcription";
import { PersonaEngine } from "@/lib/persona-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Active sessions (keyed by a simple counter for now)
const sessions = new Map<string, TranscriptionManager>();

export async function POST(req: NextRequest) {
  const { url: youtubeUrl } = await req.json();

  if (!youtubeUrl) {
    return new Response(JSON.stringify({ error: "Missing YouTube URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate environment
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!deepgramKey || !groqKey) {
    return new Response(
      JSON.stringify({ error: "Missing required API keys (DEEPGRAM, GROQ)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionId = Date.now().toString();
  const transcriber = new TranscriptionManager(deepgramKey);
  sessions.set(sessionId, transcriber);

  const personaEngine = new PersonaEngine({
    anthropicKey: anthropicKey || "",
    groqKey: groqKey,
    braveSearchKey: braveKey || "",
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream may have been closed
        }
      };

      // Wire up transcript events
      transcriber.on("transcript", (event) => {
        send("transcript", event);
      });

      transcriber.on("started", () => {
        send("status", { status: "started", sessionId });
      });

      transcriber.on("deepgram_connected", () => {
        send("status", { status: "deepgram_connected" });
      });

      transcriber.on("error", (err) => {
        send("error", { message: err.message });
      });

      transcriber.on("stopped", () => {
        send("status", { status: "stopped" });
        sessions.delete(sessionId);
      });

      // Persona trigger loop
      const personaInterval = setInterval(async () => {
        if (transcriber.shouldTriggerPersonas()) {
          const transcript = transcriber.transcript;
          transcriber.resetNewTranscript();

          send("status", { status: "personas_firing" });

          await personaEngine.fireAll(transcript, (response) => {
            if (response.done) {
              send("persona_done", { personaId: response.personaId });
            } else {
              send("persona", {
                personaId: response.personaId,
                text: response.text,
              });
            }
          });

          send("status", { status: "personas_complete" });
        }
      }, 5000); // Check every 5 seconds

      // Start the pipeline
      transcriber.start(youtubeUrl).catch((err) => {
        send("error", { message: `Failed to start: ${err.message}` });
      });

      // Cleanup on stream close
      const cleanup = () => {
        clearInterval(personaInterval);
        transcriber.stop();
        sessions.delete(sessionId);
      };

      // Handle client disconnect via AbortSignal
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Session-Id": sessionId,
    },
  });
}

// Stop endpoint
export async function DELETE(req: NextRequest) {
  const { sessionId } = await req.json();
  const transcriber = sessions.get(sessionId);

  if (transcriber) {
    transcriber.stop();
    sessions.delete(sessionId);
    return new Response(JSON.stringify({ stopped: true }));
  }

  return new Response(JSON.stringify({ error: "Session not found" }), {
    status: 404,
  });
}
