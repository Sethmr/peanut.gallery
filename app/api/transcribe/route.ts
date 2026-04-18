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
import { resolvePack } from "@/lib/packs";
import { Director } from "@/lib/director";
import { personas } from "@/lib/personas";
import type { Pack } from "@/lib/packs/types";
import { createSessionLogger } from "@/lib/debug-logger";
import {
  isFreeTierLimitEnabled,
  getQuotaStatus,
  recordUsage,
  quotaDeniedBody,
} from "@/lib/free-tier-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── CORS ──────────────────────────────────────────────────────────────
// The Chrome extension's offscreen doc calls this route from a
// chrome-extension:// origin. The custom X-*-Key headers trigger a CORS
// preflight, so we need OPTIONS + Access-Control-* headers on every
// response. X-Session-Id must be exposed so the extension can read it
// off the SSE response.
//
// X-Install-Id is the per-installation UUID the extension generates on
// first run. It's used by the free-tier limiter on the hosted backend to
// meter demo-key usage per install. Self-hosters can safely ignore it —
// the limiter is off unless ENABLE_FREE_TIER_LIMIT=true.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Deepgram-Key, X-Groq-Key, X-Anthropic-Key, X-Brave-Key, X-Install-Id",
  "Access-Control-Expose-Headers": "X-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

interface Session {
  transcriber: TranscriptionManager;
  /**
   * The pack that was resolved when the session started. Frozen for the life
   * of the session — pack swaps only take effect on the next Start Listening.
   * Used by PATCH handlers (e.g. fire_persona validation) so we never leak the
   * global Howard import into pack-specific decisions.
   */
  resolvedPack: Pack;
  forcedPersonaId?: string; // When set, next trigger fires this specific persona
  /**
   * When true, the next trigger bypasses the Director and fires ALL 4 personas
   * with a "don't pass" directive — this is what the React button sets so the
   * user always gets visible reactions for their click.
   */
  forceReactNext?: boolean;
  /**
   * Epoch-ms when this session was created. Used by the free-tier limiter to
   * charge actual elapsed time against the install's quota on session close.
   */
  startedAt: number;
  /**
   * The install-id that opened this session, if any. Set only when the
   * free-tier limiter is active AND the install is consuming demo keys. A
   * session carrying its own keys has `null` here and is never charged.
   */
  chargeableInstallId: string | null;
  /**
   * Guards against double-charging. DELETE and the client-disconnect cleanup
   * can both fire for the same session; we only want to record usage once.
   */
  charged: boolean;
}

// Active sessions (keyed by session ID)
const sessions = new Map<string, Session>();

/**
 * Charge elapsed session time against the install's free-tier quota. Safe to
 * call from any cleanup path — self-guards with `session.charged` so DELETE
 * and the req.signal.abort handler can both call it without double-counting.
 */
function chargeSessionUsage(session: Session): void {
  if (session.charged) return;
  session.charged = true;
  if (!session.chargeableInstallId) return;
  const elapsedMs = Math.max(0, Date.now() - session.startedAt);
  recordUsage(session.chargeableInstallId, elapsedMs);
}

export async function POST(req: NextRequest) {
  const { url: youtubeUrl, mode, isLive: clientIsLive, rate, packId } = await req.json();

  if (!youtubeUrl) {
    return jsonResponse({ error: "Missing YouTube URL" }, 400);
  }

  const browserMode = mode === "browser";

  // ── Response-rate dial (user-configurable pace, 1..10, default 5) ─────
  // Older clients omit `rate` entirely, so missing/invalid values fall
  // through to 5 (default cadence, multiplier 1.0, zero behavior change).
  // Formula: multiplier = 3 ^ ((5 - rate) / 5)
  //   rate=1  → 2.41× (much slower, ~36s first trigger)
  //   rate=5  → 1.00× (default — identical to pre-v1.2 cadence)
  //   rate=10 → 0.33× (fast, ~5s first trigger)
  // The exponential curve gives uniform "feels-different" steps across the
  // dial; a linear mapping would bunch all the change at one end.
  const rateParsed = Number.isFinite(rate) ? Math.round(rate) : 5;
  const rateClamped = Math.max(1, Math.min(10, rateParsed));
  const paceMultiplier = Math.pow(3, (5 - rateClamped) / 5);

  // Read API keys from request headers (user provides their own keys)
  // Falls back to server env vars for local dev / hosted demo keys.
  // Track which keys came from headers vs env so the free-tier limiter can
  // tell "user brought their own (no charge)" from "user is using demo keys".
  const headerDeepgram = req.headers.get("X-Deepgram-Key");
  const headerAnthropic = req.headers.get("X-Anthropic-Key");
  const headerGroq = req.headers.get("X-Groq-Key");
  const headerBrave = req.headers.get("X-Brave-Key");

  const deepgramKey = headerDeepgram || process.env.DEEPGRAM_API_KEY;
  const anthropicKey = headerAnthropic || process.env.ANTHROPIC_API_KEY;
  const groqKey = headerGroq || process.env.GROQ_API_KEY;
  const braveKey = headerBrave || process.env.BRAVE_SEARCH_API_KEY;

  if (!deepgramKey || !groqKey) {
    return jsonResponse(
      { error: "Missing required API keys. Click 'API Keys' to add your Deepgram and Groq keys." },
      400
    );
  }

  // ── Free-tier limiter (hosted-backend only) ──────────────────────────
  // If the operator has ENABLE_FREE_TIER_LIMIT=true and this session is
  // going to burn at least one demo key (i.e. the user didn't paste a
  // header AND the server has a fallback env var to use), we meter usage
  // per install-id. Self-hosters and BYO-keys users bypass this branch
  // entirely. We check env existence explicitly so a self-hosted server
  // that happens to lack (say) ANTHROPIC_API_KEY doesn't get falsely
  // flagged as "consuming a demo key" just because the header is absent.
  const installId = (req.headers.get("X-Install-Id") || "").trim() || null;
  const usingAnyDemoKey =
    (!headerDeepgram && !!process.env.DEEPGRAM_API_KEY) ||
    (!headerGroq && !!process.env.GROQ_API_KEY) ||
    (!headerAnthropic && !!process.env.ANTHROPIC_API_KEY);
  let chargeableInstallId: string | null = null;

  if (isFreeTierLimitEnabled() && usingAnyDemoKey) {
    if (!installId) {
      // Hosted backend with demo keys but no install-id header — refuse
      // politely so we can't be abused by anonymous scripts. Legit clients
      // (the official extension) always send one.
      return jsonResponse(
        {
          error:
            "Missing install identifier. Update to the latest Peanut Gallery extension, or add your own API keys to bypass.",
          code: "INSTALL_ID_REQUIRED",
        },
        400
      );
    }
    const quota = getQuotaStatus(installId);
    if (!quota.allowed) {
      return jsonResponse(quotaDeniedBody(quota), 402, {
        "Retry-After": String(Math.ceil((quota.resetAt - Date.now()) / 1000)),
      });
    }
    // Only charge this session if the install actually crossed into demo-key
    // territory. (usingAnyDemoKey is already true at this point.)
    chargeableInstallId = installId;
  }

  // ── Persona pack resolution (v1.3) ─────────────────────────────────────
  // resolvePack() is the SINGLE forward-compat choke point: unknown, missing,
  // null, whitespace, or malformed ids all fall back to the default pack
  // (Howard). That means:
  //   - Old client + new server  → no packId in body → Howard (identical to
  //     pre-v1.3 behavior, zero regression).
  //   - New client + old server  → server ignores the field → Howard (client
  //     UI still shows chosen names, backend speaks Howard; tolerable drift).
  //   - New client + new server  → pack flows through, engine uses its
  //     persona array, Director is unchanged (same 4 archetype slots).
  const resolvedPack = resolvePack(packId);
  const sessionId = Date.now().toString();
  const log = createSessionLogger(sessionId);
  log.info("session_create", {
    url: youtubeUrl,
    hasAnthropic: !!anthropicKey,
    hasBrave: !!braveKey,
    usingAnyDemoKey,
    chargeable: !!chargeableInstallId,
    rate: rateClamped,
    paceMultiplier,
    // Log both requested + resolved so we can see fallbacks in the logs
    // (e.g. someone sending "Howard" with a capital H should show
    // requestedPackId="Howard", packId="howard" — or unknown → "howard").
    requestedPackId: typeof packId === "string" ? packId : null,
    packId: resolvedPack.meta.id,
  });

  const transcriber = new TranscriptionManager(deepgramKey);
  transcriber.setPaceMultiplier(paceMultiplier);
  const session: Session = {
    transcriber,
    // Freeze the resolved pack on the session so PATCH handlers validate
    // fire_persona requests against THIS session's pack rather than the
    // global Howard shim. Pack swaps only take effect on the next Start.
    resolvedPack,
    startedAt: Date.now(),
    chargeableInstallId,
    charged: false,
  };
  sessions.set(sessionId, session);

  const personaEngine = new PersonaEngine({
    anthropicKey: anthropicKey || "",
    groqKey: groqKey,
    braveSearchKey: braveKey || "",
    // Pass the resolved pack (never undefined — resolvePack() guarantees a
    // valid Pack). Engine internally falls back to Howard if pack is unset,
    // so this is also the "self-documenting" seam.
    pack: resolvedPack,
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
        send("transcript", event);
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
        chargeSessionUsage(session);
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
        // SILENCE TRIGGER: transcript went quiet for >= 18s. Replaces the old
        // client-driven pause path — the user doesn't have to signal anything,
        // the server notices the dead air on its own.
        const shouldFireSilence = transcriber.shouldTriggerSilence();
        const forcedPersona = session.forcedPersonaId;
        const forceReactBurst = !!session.forceReactNext;

        // Clear forced persona immediately so it doesn't re-fire
        if (forcedPersona) {
          session.forcedPersonaId = undefined;
        }

        // ── FORCE-REACT BURST ──
        // User tapped the 🔥 React button. Skip the Director and fire all 4
        // personas in parallel with isForceReact=true so nobody passes with "-".
        // This is the ONE path in the whole engine that guarantees visible
        // reactions regardless of Director scoring.
        if (forceReactBurst) {
          session.forceReactNext = false;
          personasFiring = true;
          const transcript = transcriber.transcript;

          log.info("personas_trigger", {
            reason: "force_react_button",
            transcriptLength: transcript.length,
          });
          transcriber.resetNewTranscript();

          const streamCallback = (response: { personaId: string; text: string; done: boolean }) => {
            if (response.done) {
              send("persona_done", { personaId: response.personaId, fromForceReact: true });
            } else {
              send("persona", { personaId: response.personaId, text: response.text });
            }
          };

          // The fromForceReact=true flag on this burst's persona_done and
          // personas_complete events is what the client gates its React
          // button reset on — a tail-end Director cascade that happened to
          // finish between click and burst-start would otherwise flip the
          // button back to idle before the burst's events even arrived.
          // Per-event tagging is more accurate than a separate "started"
          // sentinel because it survives event reordering.
          send("status", { status: "personas_firing" });

          try {
            await personaEngine.fireAll(transcript, streamCallback, /*isSilence*/ false, /*isForceReact*/ true);
          } catch (err) {
            log.error("force_react_error", { error: err instanceof Error ? err.message : String(err) });
          }

          send("status", { status: "personas_complete", fromForceReact: true });
          personasFiring = false;
          return;
        }

        if (shouldFire || shouldFireSilence || forcedPersona) {
          personasFiring = true;
          const transcript = transcriber.transcript;
          const recentTranscript = transcriber.newTranscript;
          // A silence trigger is "sticky" for this one tick — we still pass
          // isSilence=true down into the engine so the prompt shifts to the
          // crickets/dead-air voice even if the cascade takes a few seconds.
          const isSilenceTick = shouldFireSilence && !forcedPersona && !shouldFire;
          const msSinceTranscript = transcriber.msSinceLastTranscript();

          log.info("personas_trigger", {
            reason: forcedPersona
              ? `forced_${forcedPersona}`
              : isSilenceTick
              ? "silence_threshold"
              : "transcript_threshold",
            transcriptLength: transcript.length,
            recentLength: recentTranscript.length,
            isSilence: isSilenceTick,
            msSinceLastTranscript: msSinceTranscript,
          });

          if (isSilenceTick) {
            // Lock out the silence path until new transcript arrives. Without
            // this, every 5s tick would re-fire a "crickets" reaction — fine
            // for one beat, miserable after three.
            transcriber.markSilenceFired();
          } else {
            transcriber.resetNewTranscript();
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
          // isForceReact=true: the user explicitly tapped THIS avatar and is
          // staring at a spinner waiting for a response. A silent "-" pass
          // here is a footgun — the spinner clears but no feed entry appears,
          // so the tap looks ignored. Force a visible response the same way
          // the 🔥 React button does. (Director-driven cascades still use
          // isForceReact=false so "-" remains available for anti-repetition.)
          if (forcedPersona) {
            send("status", { status: "personas_firing", personaId: forcedPersona });

            await personaEngine.fireSingle(
              forcedPersona,
              transcript,
              streamCallback,
              /*isSilence*/ false,
              /*cascadeFrom*/ undefined,
              /*isForceReact*/ true
            );

            send("status", { status: "personas_complete" });
            personasFiring = false;
            return;
          }

          // ── NORMAL DIRECTOR-DRIVEN CASCADE (or silence cascade) ──
          // Ask the Director who should speak. On a silence tick the Director
          // caps the cascade length so dead air gets one crisp reaction
          // instead of a 4-way pile-on.
          const decision = director.decide(
            recentTranscript || transcript.slice(-500),
            isSilenceTick,
            sessionId
          );

          // v1.2: emit the Director's decision to the side-panel debug panel
          // as an SSE event. The Director already writes a structured log
          // line with the same shape via its own logPipeline call (now
          // sessionId-tagged), so we don't re-log here — that was the
          // pre-v1.2 duplicate.
          //
          // Wrapped defensively: an aborted stream must not break the
          // cascade path below. If send() throws on a closed writer, we
          // swallow and keep going.
          try {
            send("director_decision", {
              sessionId,
              ts: new Date().toISOString(),
              pick: decision.personaIds[0] ?? null,
              score: decision.score ?? 0,
              top3: decision.top3 ?? [],
              chain: decision.personaIds,
              delays: decision.delays,
              cascadeLen: decision.personaIds.length,
              cooldownsMs: decision.cooldownsMs ?? {},
              reason: decision.reason,
              isSilence: isSilenceTick,
              isForceReact: false,
            });
          } catch {
            // SSE writer may be closed — ignore and continue the cascade.
          }

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

            // Stop if session has been torn down mid-cascade
            if (!session.transcriber) break;

            send("status", { status: "personas_firing", personaId });

            // Build cascade context from previous persona's response.
            // Look the persona up in the session's resolved pack — not the
            // global `personas` shim, which always resolves to Howard. A
            // TWiST cascade that used the shim would stamp the cascade
            // source with Baba Booey's name/emoji instead of Molly's, so
            // the next persona's prompt would reference a Howard cast
            // member who isn't in the conversation. Slot ids match across
            // packs, so .find() still works — only the name/emoji differ.
            const cascadeFrom = i > 0 && lastResponse
              ? (() => {
                  const p = session.resolvedPack.personas.find((p) => p.id === lastPersonaId);
                  return p ? { personaId: lastPersonaId, name: p.name, emoji: p.emoji, text: lastResponse } : undefined;
                })()
              : undefined;

            const response = await personaEngine.fireSingle(
              personaId,
              transcript,
              streamCallback,
              isSilenceTick,
              cascadeFrom
            );

            lastResponse = response;
            lastPersonaId = personaId;
          }

          send("status", { status: "personas_complete" });
          personasFiring = false;
        }
        // Poll cadence scales with the rate dial, but only FASTER than the
        // 5s default — we never poll SLOWER than the original because the
        // real gate on triggering is already the trigger-interval check
        // inside transcriber.shouldTriggerPersonas(). A slower poll would
        // only add latency without changing the decision.
      }, Math.max(1000, Math.min(5000, Math.round(5000 * paceMultiplier)))); // default 5s; floor 1s at rate=10

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
        chargeSessionUsage(session);
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
      ...CORS_HEADERS,
    },
  });
}

// Pause / Resume / Stop / Audio chunks
export async function PATCH(req: NextRequest) {
  const { sessionId, action, personaId: targetPersonaId, audio, forceReact } = await req.json();
  const session = sessions.get(sessionId);

  if (!session) {
    return jsonResponse({ error: "Session not found" }, 404);
  }

  // Browser audio mode: receive PCM chunks from the client / extension
  if (action === "audio_chunk") {
    if (!audio) {
      return jsonResponse({ error: "Missing audio data" }, 400);
    }
    const chunk = Buffer.from(audio, "base64");
    session.transcriber.feedAudio(chunk);
    return jsonResponse({ ok: true });
  }

  // Legacy pause/resume actions — kept as safe no-ops so any older extension
  // build still in the wild doesn't 400 when it sends them. The server now
  // detects silence from transcript flow itself; clients don't need to signal
  // anything.
  if (action === "pause" || action === "resume") {
    return jsonResponse({ ok: true, deprecated: "silence is auto-detected" });
  }

  if (action === "force_fire") {
    // forceReact=true (set by the React button in the side panel) tells the
    // trigger loop to bypass the Director for the next tick and fire all 4
    // personas with a "don't pass" directive. Plain force_fire just brings
    // the next director-driven trigger forward.
    if (forceReact) session.forceReactNext = true;
    session.transcriber.forceNextTrigger();
    return jsonResponse({ fired: true, forceReact: !!forceReact });
  }

  // Fire a SINGLE specific persona on demand (emoji tap)
  if (action === "fire_persona") {
    if (!targetPersonaId) {
      return jsonResponse({ error: "personaId required" }, 400);
    }
    // Collision guard: if a 🔥 React burst is pending or already running,
    // a solo persona tap would be clobbered by the burst branch (which clears
    // forcedPersonaId before returning). 409 tells the client to restore the
    // avatar spinner — the React burst will fire that persona anyway as part
    // of firing all four. Prevents a phantom "nothing happened to my tap"
    // state where the UI spinner sits until the 15s safety timeout.
    if (session.forceReactNext) {
      return jsonResponse(
        { error: "force-react burst pending", code: "BURST_PENDING" },
        409
      );
    }
    // Validate against THIS session's pack — not the global Howard shim.
    // Today Howard and TWiST share the same four archetype IDs so either
    // array would accept the same inputs, but a future pack that renames
    // a slot would 404 legitimate requests if we kept the global import.
    const persona = session.resolvedPack.personas.find((p) => p.id === targetPersonaId);
    if (!persona) {
      return jsonResponse({ error: "Unknown persona" }, 404);
    }
    // Queue this persona to be fired on the next interval tick
    session.forcedPersonaId = targetPersonaId;
    session.transcriber.forceNextTrigger();
    return jsonResponse({ fired: true, personaId: targetPersonaId });
  }

  return jsonResponse({ error: "Invalid action" }, 400);
}

// Stop endpoint
export async function DELETE(req: NextRequest) {
  const { sessionId } = await req.json();
  const session = sessions.get(sessionId);

  if (session) {
    session.transcriber.stop();
    // transcriber.stop() synchronously fires "stopped" which already calls
    // chargeSessionUsage — but belt-and-braces it here too in case the
    // listener was already torn down. The `charged` guard makes this a no-op
    // on the second call.
    chargeSessionUsage(session);
    sessions.delete(sessionId);
    return jsonResponse({ stopped: true });
  }

  return jsonResponse({ error: "Session not found" }, 404);
}
