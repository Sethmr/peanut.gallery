/**
 * SSE endpoint: /api/transcribe
 *
 * Accepts a YouTube URL, starts the transcription pipeline,
 * and streams transcript events + persona responses to the client.
 *
 * TRIGGER MODEL (Director + Cascade):
 * Instead of all 4 personas firing simultaneously every 60 seconds,
 * the Director picks ONE persona per trigger, then cascades to others
 * with decreasing probability and staggered timing. The result:
 * some moments get 1 response, some get 2-3, and occasionally all 4
 * pile on — just like the real Stern Show.
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
import { Director } from "@/lib/director";
import { personas } from "@/lib/personas";
import { createSessionLogger } from "@/lib/debug-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Session {
  transcriber: TranscriptionManager;
  paused: boolean;
  pauseFiredCount: number;
  forcedPersonaId?: string; // When set, next trigger fires this specific persona
}

// Active sessions (keyed by session ID)
const sessions = new Map<string, Session>();

export async function POST(req: NextRequest) {
  const { url: youtubeUrl, mode, isLive: clientIsLive } = await req.json();

  if (!youtubeUrl) {
    return new Response(JSON.stringify({ error: "Missing YouTube URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const browserMode = mode === "browser";

  // Read API keys from request headers (user provides their own keys)
  // Falls back to server env vars for local dev
  const deepgramKey = req.headers.get("X-Deepgram-Key") || process.env.DEEPGRAM_API_KEY;
  const anthropicKey = req.headers.get("X-Anthropic-Key") || process.env.ANTHROPIC_API_KEY;
  const groqKey = req.headers.get("X-Groq-Key") || process.env.GROQ_API_KEY;
  const braveKey = req.headers.get("X-Brave-Key") || process.env.BRAVE_SEARCH_API_KEY;

  if (!deepgramKey || !groqKey) {
    return new Response(
      JSON.stringify({ error: "Missing required API keys. Click 'API Keys' to add your Deepgram and Groq keys." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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

  const director = new Director();

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

      // ──────────────────────────────────────────────────────
      // PERSONA TRIGGER LOOP (Director + Cascade)
      //
      // Instead of firing all 4 simultaneously, the Director:
      // 1. Picks the best persona for the current content
      // 2. That persona fires and streams its response
      // 3. Cascade: with decreasing probability, other personas
      //    react to the first response, staggered by 2-4 seconds
      //
      // Result: natural conversation, not a wall of text
      // ──────────────────────────────────────────────────────
      let personasFiring = false;

      const personaInterval = setInterval(async () => {
        if (personasFiring) return; // don't overlap

        const shouldFire = transcriber.shouldTriggerPersonas();
        const justPaused = session.paused && session.pauseFiredCount === 0;
        const forcedPersona = session.forcedPersonaId;

        // Clear forced persona immediately so it doesn't re-fire
        if (forcedPersona) {
          session.forcedPersonaId = undefined;
        }

        // When paused, only allow the one-shot pause reaction (or forced persona tap)
        if ((shouldFire && !session.paused) || justPaused || forcedPersona) {
          personasFiring = true;
          const transcript = transcriber.transcript;
          const recentTranscript = transcriber.newTranscript;

          log.info("personas_trigger", {
            reason: forcedPersona ? `forced_${forcedPersona}` : justPaused ? "just_paused" : "transcript_threshold",
            transcriptLength: transcript.length,
            recentLength: recentTranscript.length,
            isPaused: session.paused,
          });

          if (!session.paused) {
            transcriber.resetNewTranscript();
          }
          if (session.paused && !forcedPersona) {
            session.pauseFiredCount++;
          }

          const streamCallback = (response: { personaId: string; text: string; done: boolean }) => {
            if (response.done) {
              send("persona_done", { personaId: response.personaId });
            } else {
              send("persona", {
                personaId: response.personaId,
                text: response.text,
              });
            }
          };

          // ── FORCED SINGLE PERSONA (emoji tap) ──
          if (forcedPersona) {
            send("status", { status: "personas_firing", personaId: forcedPersona });

            await personaEngine.fireSingle(
              forcedPersona,
              transcript,
              streamCallback,
              session.paused
            );

            send("status", { status: "personas_complete" });
            personasFiring = false;
            return;
          }

          // ── NORMAL DIRECTOR-DRIVEN CASCADE ──
          // Ask the Director who should speak
          const decision = director.decide(
            recentTranscript || transcript.slice(-500),
            session.paused
          );

          log.info("director_decision", {
            chain: decision.personaIds.join(" → "),
            reason: decision.reason,
            cascadeCount: decision.personaIds.length,
          });

          // Fire the cascade chain with staggered delays
          let lastResponse = "";
          let lastPersonaId = "";

          for (let i = 0; i < decision.personaIds.length; i++) {
            const personaId = decision.personaIds[i];
            const delay = decision.delays[i];

            // Wait for the cascade delay (first persona has 0 delay)
            if (delay > 0) {
              await new Promise((resolve) => setTimeout(resolve, delay));
            }

            // Don't fire if session was stopped or paused mid-cascade
            if (!session.transcriber || (session.paused && !justPaused)) {
              break;
            }

            send("status", { status: "personas_firing", personaId });

            // Build cascade context from previous persona's response
            const cascadeFrom = i > 0 && lastResponse
              ? (() => {
                  const p = personas.find((p) => p.id === lastPersonaId);
                  return p ? { personaId: lastPersonaId, name: p.name, emoji: p.emoji, text: lastResponse } : undefined;
                })()
              : undefined;

            const response = await personaEngine.fireSingle(
              personaId,
              transcript,
              streamCallback,
              session.paused,
              cascadeFrom
            );

            lastResponse = response;
            lastPersonaId = personaId;
          }

          send("status", { status: "personas_complete" });
          personasFiring = false;
        }
      }, 5000); // Check every 5 seconds

      // Start the pipeline
      if (browserMode) {
        // Browser mode: just connect Deepgram, audio will come via PATCH
        transcriber.startBrowser(!!clientIsLive).catch((err) => {
          send("error", { message: `Failed to start: ${err.message}` });
        });
      } else {
        // Server mode: yt-dlp + ffmpeg pipeline
        transcriber.start(youtubeUrl).catch((err) => {
          send("error", { message: `Failed to start: ${err.message}` });
        });
      }

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

// Pause / Resume / Stop / Audio chunks
export async function PATCH(req: NextRequest) {
  const { sessionId, action, personaId: targetPersonaId, audio } = await req.json();
  const session = sessions.get(sessionId);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Browser audio mode: receive PCM chunks from the client / extension
  if (action === "audio_chunk") {
    if (!audio) {
      return new Response(JSON.stringify({ error: "Missing audio data" }), { status: 400 });
    }
    const chunk = Buffer.from(audio, "base64");
    session.transcriber.feedAudio(chunk);
    return new Response(JSON.stringify({ ok: true }));
  }

  if (action === "pause") {
    session.paused = true;
    session.pauseFiredCount = 0;
    return new Response(JSON.stringify({ paused: true }));
  }

  if (action === "resume") {
    session.paused = false;
    session.pauseFiredCount = 0;
    return new Response(JSON.stringify({ paused: false }));
  }

  if (action === "force_fire") {
    session.transcriber.forceNextTrigger();
    return new Response(JSON.stringify({ fired: true }));
  }

  // Fire a SINGLE specific persona on demand (emoji tap)
  if (action === "fire_persona") {
    if (!targetPersonaId) {
      return new Response(JSON.stringify({ error: "personaId required" }), { status: 400 });
    }
    const persona = personas.find((p) => p.id === targetPersonaId);
    if (!persona) {
      return new Response(JSON.stringify({ error: "Unknown persona" }), { status: 404 });
    }
    // Queue this persona to be fired on the next interval tick
    session.forcedPersonaId = targetPersonaId;
    session.transcriber.forceNextTrigger();
    return new Response(JSON.stringify({ fired: true, personaId: targetPersonaId }));
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
