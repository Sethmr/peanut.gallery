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
import { createSessionLogger } from "@/lib/debug-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Session {
  transcriber: TranscriptionManager;
  paused: boolean;
  pauseFiredCount: number; // how many times personas fired while paused (cap at 1)
}

// Active sessions (keyed by session ID)
const sessions = new Map<string, Session>();

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
  const log = createSessionLogger(sessionId);
  log.info("session_create", { url: youtubeUrl, hasAnthropic: !!anthropicKey, hasBrave: !!braveKey });

  const transcriber = new TranscriptionManager(deepgramKey);
  const session: Session = { transcriber, paused: false, pauseFiredCount: 0 };
  sessions.set(sessionId, session);

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
        if (!session.paused) {
          send("transcript", event);
        }
      });

      transcriber.on("started", () => {
        send("status", { status: "started", sessionId });
      });

      transcriber.on("deepgram_connected", () => {
        send("status", { status: "deepgram_connected" });
      });

      transcriber.on("live_status", (isLive: boolean) => {
        send("status", { status: "live_detected", isLive });
      });

      transcriber.on("status_detail", (message: string) => {
        send("status", { status: "detail", message });
      });

      transcriber.on("error", (err) => {
        send("error", { message: err.message });
      });

      transcriber.on("stopped", () => {
        send("status", { status: "stopped" });
        sessions.delete(sessionId);
      });

      // Persona trigger loop
      // When paused: personas still fire but in "paused" mode (annoyed, meta-commentary)
      // When playing: normal reactions to transcript
      let personasFiring = false;
      const personaInterval = setInterval(async () => {
        if (personasFiring) return; // don't overlap

        const shouldFire = transcriber.shouldTriggerPersonas();
        // Also fire once shortly after pause starts (so AIs react to it)
        const justPaused = session.paused && session.pauseFiredCount === 0;

        // When paused, ONLY allow the one-shot "just paused" reaction.
        // Don't let shouldFire trigger — the audio pipeline keeps running
        // even when the YouTube player is paused, so transcript accumulates
        // behind the scenes and would cause personas to fire repeatedly.
        if ((shouldFire && !session.paused) || justPaused) {
          personasFiring = true;
          const transcript = transcriber.transcript;
          log.info("personas_trigger", {
            reason: justPaused ? "just_paused" : "transcript_threshold",
            transcriptLength: transcript.length,
            isPaused: session.paused,
          });

          if (!session.paused) {
            transcriber.resetNewTranscript();
          }
          if (session.paused) {
            session.pauseFiredCount++;
          }

          send("status", { status: "personas_firing" });

          await personaEngine.fireAll(
            transcript,
            (response) => {
              if (response.done) {
                send("persona_done", { personaId: response.personaId });
              } else {
                send("persona", {
                  personaId: response.personaId,
                  text: response.text,
                });
              }
            },
            session.paused
          );

          send("status", { status: "personas_complete" });
          personasFiring = false;
        }
      }, 5000); // Check every 5 seconds

      // Start the pipeline
      transcriber.start(youtubeUrl).catch((err) => {
        send("error", { message: `Failed to start: ${err.message}` });
      });

      // Cleanup on stream close
      const cleanup = () => {
        log.info("session_cleanup", { reason: "client_disconnect" });
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

// Pause / Resume / Stop
export async function PATCH(req: NextRequest) {
  const { sessionId, action } = await req.json();
  const session = sessions.get(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "pause") {
    session.paused = true;
    session.pauseFiredCount = 0; // reset so personas fire once when paused
    return new Response(JSON.stringify({ paused: true }));
  }

  if (action === "resume") {
    session.paused = false;
    session.pauseFiredCount = 0;
    return new Response(JSON.stringify({ paused: false }));
  }

  if (action === "force_fire") {
    // Manual trigger — populate buffer first, THEN reset timing
    // (forceNextTrigger fills newTranscript from full buffer if needed)
    session.transcriber.forceNextTrigger();
    return new Response(JSON.stringify({ fired: true }));
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

// Stop endpoint
export async function DELETE(req: NextRequest) {
  const { sessionId } = await req.json();
  const session = sessions.get(sessionId);

  if (session) {
    session.transcriber.stop();
    sessions.delete(sessionId);
    return new Response(JSON.stringify({ stopped: true }));
  }

  return new Response(JSON.stringify({ error: "Session not found" }), {
    status: 404,
  });
}
