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
import { pickPersonaLLM, type LlmRoutingPick } from "@/lib/director-llm";
import { pickPersonaCerebrasV3 } from "@/lib/director-llm-v3-cerebras-v3prompt";
import { pickPersonaGroqV3 } from "@/lib/director-llm-v3-groq-v3prompt";
import {
  pickPersonaLLMv2,
  applyStickyPenalty,
  computeUnstableTailLen,
  type LlmRoutingPickV2,
} from "@/lib/director-llm-v2";
import { personas } from "@/lib/personas";
import type { Pack } from "@/lib/packs/types";
import { createSessionLogger } from "@/lib/debug-logger";
import {
  isFreeTierLimitEnabled,
  getQuotaStatus,
  recordUsage,
  quotaDeniedBody,
} from "@/lib/free-tier-limiter";
import {
  isSubscriptionEnabled,
  getSubscriptionStatus,
  recordSubscriptionUsage,
  subscriptionDeniedBody,
} from "@/lib/subscription";

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
    "Content-Type, X-Deepgram-Key, X-Anthropic-Key, X-Brave-Key, X-XAI-Key, X-Groq-Key, X-Cerebras-Key, X-OpenAI-Key, X-Search-Engine, X-Install-Id, X-Sensitivity, X-Subscription-Key",
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
   * The subscription key that opened this session, if any. Set only when
   * Peanut Gallery Plus is active AND the install is consuming hosted
   * keys via the subscription gate. BYOK sessions have `null` here and
   * don't tick subscription hours — user-paid keys mean "no subscription
   * consumption," per design.
   */
  subscriptionKey: string | null;
  /**
   * Guards against double-charging. DELETE and the client-disconnect cleanup
   * can both fire for the same session; we only want to record usage once.
   */
  charged: boolean;
  /**
   * v1.7 (SET-7): the directorInput string from the previous Director
   * tick in this session. Used to compute how many chars of the current
   * tick's input are "new" (unstable tail). `null` on the first tick —
   * nothing stable yet, so the tail comparison returns current.length
   * and the router handles the first-tick case like a silence tick
   * cousin.
   */
  previousDirectorInput: string | null;
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
  const elapsedMs = Math.max(0, Date.now() - session.startedAt);
  // One or the other — a session either burns free-tier quota
  // (install-id on file, no subscription) or subscription hours
  // (subscription key on file), never both. The session-open flow
  // guards which path was taken.
  if (session.subscriptionKey) {
    recordSubscriptionUsage(session.subscriptionKey, elapsedMs);
  } else if (session.chargeableInstallId) {
    recordUsage(session.chargeableInstallId, elapsedMs);
  }
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
  // v2.0.1: X-Brave-Key header deprecated (Brave Search removed from
  // the extension). Still honoured on the server for backward-compat
  // with older extension builds, but nothing in the PersonaEngine
  // constructor below consumes it anymore — fact-check always uses xAI.
  const headerXai = req.headers.get("X-XAI-Key");
  const headerGroq = req.headers.get("X-Groq-Key");
  const headerCerebras = req.headers.get("X-Cerebras-Key");
  // OpenAI key for semantic anti-repetition embeddings (SET-15). Only used
  // when ENABLE_SEMANTIC_ANTI_REPEAT=true. Self-hosters who don't need
  // anti-repeat can omit this entirely; the feature self-disables when the
  // key is absent (fail-open, not fail-hard).
  const headerOpenAi = req.headers.get("X-OpenAI-Key");

  // Strip everything that isn't ASCII-printable + trim whitespace. Railway
  // / Vercel env-var UIs occasionally slip invisible U+2028 LINE SEPARATOR
  // or stray whitespace into a pasted value, and anything non-latin-1 in
  // an Authorization header blows up with "Cannot convert argument to a
  // ByteString" from undici the first time the key gets used. The persona
  // path catches that as persona_error and the whole tick fails. Normalize
  // once at the boundary so no downstream caller has to care.
  const sanitizeKey = (v: string | null | undefined): string | undefined => {
    if (!v) return undefined;
    const cleaned = v.replace(/[^\x20-\x7E]/g, "").trim();
    return cleaned.length > 0 ? cleaned : undefined;
  };

  const deepgramKey = sanitizeKey(headerDeepgram) ?? sanitizeKey(process.env.DEEPGRAM_API_KEY);
  const anthropicKey = sanitizeKey(headerAnthropic) ?? sanitizeKey(process.env.ANTHROPIC_API_KEY);
  const xaiKey = sanitizeKey(headerXai) ?? sanitizeKey(process.env.XAI_API_KEY);
  const openAiKey = sanitizeKey(headerOpenAi) ?? sanitizeKey(process.env.OPENAI_API_KEY);
  // Shadow-provider keys for Smart Director v3 (SET-6). Never used for
  // user-facing persona calls — only for the parallel shadow LLM call that
  // logs agreement rate vs Haiku. Groq is deferred until Developer tier
  // reopens (SET-11); Cerebras is the working fast-provider path today.
  const groqKey = sanitizeKey(headerGroq) ?? sanitizeKey(process.env.GROQ_API_KEY);
  const cerebrasKey = sanitizeKey(headerCerebras) ?? sanitizeKey(process.env.CEREBRAS_API_KEY);

  // v2.0.1: Search-engine selection removed (Brave Search deprecated).
  // Producer fact-checks always use xAI Live Search via the xAI key.

  // v1.7: global sensitivity. Client sends "quiet" | "normal" | "rowdy" via
  // X-Sensitivity; anything else (missing, typo) defaults to "normal" —
  // preserves behavior for older extensions that don't send this header.
  // Scales cascade probability in the Director (quieter = fewer chained
  // responses; rowdier = more pile-ons). Producer fact-check mode is
  // still per-pack, not per-user — that's a character-design decision.
  const rawSensitivity = (req.headers.get("X-Sensitivity") || "").toLowerCase();
  const sensitivity: "quiet" | "normal" | "rowdy" =
    rawSensitivity === "quiet" ? "quiet" : rawSensitivity === "rowdy" ? "rowdy" : "normal";

  if (!deepgramKey) {
    return jsonResponse(
      { error: "Missing Deepgram key. Click 'API Keys' to add it." },
      400
    );
  }
  // xAI now powers Troll/Jason AND the soundfx slot in both packs, so without
  // a working xAI key half the sidebar is dark. We still allow the request to
  // proceed (force-react fallback handles per-persona upstream failures and
  // produces canned bubbles) but we surface the missing key clearly so users
  // fix it instead of staring at four empty avatars.
  if (!anthropicKey && !xaiKey) {
    return jsonResponse(
      {
        error:
          "Missing Anthropic AND xAI keys — every persona needs one of them. Click 'API Keys' to add at least one.",
      },
      400
    );
  }

  // ── Subscription + Free-tier gate (hosted-backend only) ──────────────
  //
  // Three paths converge here, selected by what the client sends:
  //
  //   1. BYOK — user attached their own keys (X-Deepgram-Key + X-Anthropic-Key
  //      + X-XAI-Key). The route uses those; no subscription consumption,
  //      no free-tier metering. This path always works, even when
  //      ENABLE_SUBSCRIPTION is off on this backend.
  //
  //   2. Peanut Gallery Plus — user attached an X-Subscription-Key header.
  //      The key is validated against `lib/subscription.ts`. If valid
  //      + under weekly cap, the session proceeds on hosted keys and
  //      usage is metered against the subscription's ledger. If invalid
  //      or over cap, 402 with a code the extension surfaces.
  //
  //   3. Hosted demo — user sent neither keys nor subscription. One-off
  //      15-minute trial gated by `lib/free-tier-limiter.ts`, keyed on
  //      X-Install-Id. Once exhausted, user must bring keys or subscribe.
  //
  // Subscription wins when present — we don't cross-charge the free
  // tier against a subscription session.
  const installId = (req.headers.get("X-Install-Id") || "").trim() || null;
  const subscriptionKeyHeader =
    (req.headers.get("X-Subscription-Key") || "").trim() || null;
  const usingAnyDemoKey =
    (!headerDeepgram && !!process.env.DEEPGRAM_API_KEY) ||
    (!headerAnthropic && !!process.env.ANTHROPIC_API_KEY) ||
    // xAI Grok powers the Troll/Jason/soundfx slots — if the user didn't bring
    // their own xAI key and the server has one, count this session as demo
    // usage for free-tier metering purposes.
    (!headerXai && !!process.env.XAI_API_KEY);
  let chargeableInstallId: string | null = null;
  let subscriptionKey: string | null = null;

  // Path 2 — subscription. Only meaningful when the user is asking to
  // use hosted keys (demo-key path). BYOK with a subscription key
  // attached is fine — we validate the key but don't charge it because
  // the session isn't burning hosted resources.
  if (subscriptionKeyHeader && usingAnyDemoKey) {
    if (!isSubscriptionEnabled()) {
      const status = getSubscriptionStatus(subscriptionKeyHeader);
      return jsonResponse(subscriptionDeniedBody(status), 503);
    }
    const status = getSubscriptionStatus(subscriptionKeyHeader);
    if (!status.valid) {
      return jsonResponse(subscriptionDeniedBody(status), 402, {
        "Retry-After": String(Math.ceil((status.resetAt - Date.now()) / 1000)),
      });
    }
    subscriptionKey = subscriptionKeyHeader;
    // Subscription path short-circuits the free-tier check — user is
    // paying for hosted access, they don't also burn trial minutes.
  } else if (isFreeTierLimitEnabled() && usingAnyDemoKey) {
    // Path 3 — free-tier trial. No subscription key on hand; we enforce
    // the one-off 15-minute allowance per install.
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
    hasXai: !!xaiKey,
    usingAnyDemoKey,
    chargeable: !!chargeableInstallId,
    rate: rateClamped,
    paceMultiplier,
    // Log both requested + resolved so we can see fallbacks in the logs
    // (e.g. someone sending "Howard" with a capital H should show
    // requestedPackId="Howard", packId="howard" — or unknown → "howard").
    requestedPackId: typeof packId === "string" ? packId : null,
    packId: resolvedPack.meta.id,
    // Shadow flag state, for filtering director_v3_shadow_compare events.
    // SET-13: v3-prompt shadows (5-slot + confidence, json_schema). The
    // v2-prompt cohort (SET-6) was retired on 2026-04-22 along with the
    // deprecated director-llm-v3-{cerebras,groq}.ts modules.
    groqShadowV3Enabled:
      process.env.ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT === "true" &&
      !!groqKey,
    cerebrasShadowV3Enabled:
      process.env.ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT === "true" &&
      !!cerebrasKey,
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
    subscriptionKey,
    charged: false,
    // v1.7 (SET-7): empty on first tick — computeUnstableTailLen reports
    // current.length back, which the prompt builder renders as the whole
    // transcript marked unstable. That's intentional: the first tick has
    // no stability anchor, so let the model be cautious.
    previousDirectorInput: null,
  };
  sessions.set(sessionId, session);

  const personaEngine = new PersonaEngine({
    anthropicKey: anthropicKey || "",
    // xAI key powers the Troll/Jason AND soundfx slots in every pack AND
    // the Producer's fact-check grounding via Grok Live Search. Empty
    // string is still accepted — the force-react fallback catches per-persona
    // upstream failures — but the sidebar will look sparse without it.
    xaiKey: xaiKey || "",
    // Pass the resolved pack (never undefined — resolvePack() guarantees a
    // valid Pack). Engine internally falls back to Howard if pack is unset,
    // so this is also the "self-documenting" seam.
    pack: resolvedPack,
    // OpenAI key for semantic anti-repetition embeddings (SET-15). Only used
    // when ENABLE_SEMANTIC_ANTI_REPEAT=true; the engine self-disables the
    // feature if the key is absent.
    openAiKey: openAiKey || "",
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
              // Engine emissions that pair "text + done" in a single callback
              // (error-path "[technical difficulties]" bubbles, and any future
              // one-shot finalizers) used to lose their text here — the client
              // only renders from buffered `persona` events, so a `persona_done`
              // with no prior content left a silent spinner. Emit the text
              // first so the client buffers it, then close with `persona_done`.
              if (response.text) {
                send("persona", { personaId: response.personaId, text: response.text });
              }
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

          // try/finally around the whole fire so that ANY throw or timeout
          // inside the engine releases the per-session `personasFiring` lock.
          // Before this, a stalled upstream (Anthropic/xAI stream going
          // quiet, search fetch hanging) would leave the lock set forever —
          // every subsequent director tick would early-return and every
          // avatar tap would queue a `forcedPersonaId` the tick never
          // processes, stranding the UI until the page was reloaded.
          try {
            await personaEngine.fireAll(transcript, streamCallback, /*isSilence*/ false, /*isForceReact*/ true);
          } catch (err) {
            log.error("force_react_error", { error: err instanceof Error ? err.message : String(err) });
          } finally {
            try {
              send("status", { status: "personas_complete", fromForceReact: true });
            } catch {
              // SSE writer may be closed — the lock release is the load-bearing part.
            }
            personasFiring = false;
          }
          return;
        }

        if (shouldFire || shouldFireSilence || forcedPersona) {
          personasFiring = true;
          // try/finally around the whole fire. If `fireSingle` or the
          // cascade loop throws — or hangs on an upstream we couldn't
          // bound from inside the engine — we MUST release this lock.
          // Otherwise every subsequent tick early-returns at the
          // `if (personasFiring) return;` guard and the session silently
          // stops reacting (director decisions and avatar taps both
          // queue state the tick never processes). This was the
          // smoking gun behind the v1.4 "baba button stops responding"
          // regression: one stalled producer LLM stream killed the
          // whole session's firing loop.
          try {
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
              // Same done+text handling as the force-react burst callback —
              // one-shot emissions (e.g. upstream-error bubbles) must land
              // their text before the done frame or the client renders
              // nothing. See the burst branch for the full rationale.
              if (response.text) {
                send("persona", { personaId: response.personaId, text: response.text });
              }
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

            const forcedResponse = await personaEngine.fireSingle(
              forcedPersona,
              transcript,
              streamCallback,
              /*isSilence*/ false,
              /*cascadeFrom*/ undefined,
              /*isForceReact*/ true
            );
            // SET-12 (approach A): feed tail of emoji-tap responses into the
            // live-callback ring buffer so v3 routing has real candidates.
            // Skip trivial/pass responses (< 20 chars) — those are fallbacks,
            // not memorable phrases worth heightening.
            if (forcedResponse.trim().length >= 20) {
              director.addLiveCallback(forcedResponse.trim().slice(-100));
            }

            // NOTE: personas_complete + lock release happen in the outer
            // `finally` now — keeping them here would duplicate the emit
            // and leave the lock re-settable if a bug snuck an early
            // return above the finally.
            return;
          }

          // ── NORMAL DIRECTOR-DRIVEN CASCADE (or silence cascade) ──
          // Ask the Director who should speak. On a silence tick the Director
          // caps the cascade length so dead air gets one crisp reaction
          // instead of a 4-way pile-on.
          //
          // v1.5 (Smart Director v2): when ENABLE_SMART_DIRECTOR=true and an
          // Anthropic key is available for this session, race a short LLM
          // routing call against a 400ms budget. If the LLM wins with a
          // valid pick, its rationale substitutes the rule-based scorer as
          // the primary pick inside `director.decide(…, { llmPick })`.
          // Cascade + cooldown + recency bookkeeping is unchanged — the LLM
          // only decides WHO leads this tick, not whether/how the cascade
          // rolls.
          const directorInput = recentTranscript || transcript.slice(-500);
          // v1.7 (SET-7): how many chars of this tick's input are NEW since
          // the previous tick. Threaded into pickPersonaLLMv2 + both v3
          // shadow providers via `unstableTailLen`. Updated at end of
          // this block so the next tick sees this tick's input as prior.
          const unstableTailLen = computeUnstableTailLen(
            directorInput,
            session.previousDirectorInput ?? ""
          );
          let llmPick: LlmRoutingPick | null = null;
          let llmPickV2: LlmRoutingPickV2 | null = null;
          let llmElapsedMs: number | null = null;
          const LLM_BUDGET_MS = 400;
          const smartOn =
            process.env.ENABLE_SMART_DIRECTOR === "true" && !!anthropicKey;
          // v1.7 experimental: v3 router (SILENT slot + tool_use + confidence
          // + callback memory). Opt-in only. When the v3 flag is set, v3 wins
          // — v2 fallback is the already-shipped code path, so we don't race
          // both Haiku calls. The Groq shadow still fires in parallel below
          // and compares against whichever of v2/v3 was the active pick.
          const smartV2On =
            process.env.ENABLE_SMART_DIRECTOR_V2 === "true" && !!anthropicKey;

          // ── Smart Director v3 fast-provider shadows (SET-13) ──
          // Fire in parallel with the Haiku primary. Deliberately NOT awaited
          // before routing — the shadow pick is logged but never fed to
          // director.decide(). A 2 s timeout bounds tail latency on the async
          // log path; sub-200 ms TTFT on both providers means the shadow
          // usually resolves before the cascade finishes.
          //
          // Two shadow providers are wired, independently flag-gated, both
          // using the v3 prompt (5-slot + confidence) with json_schema-
          // enforced structured output:
          //   - Cerebras (ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT):
          //     working today. Llama 3.1 8B, ~100–440 ms TTFT, paid self-serve.
          //   - Groq     (ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT): deferred,
          //     tracked in Linear SET-11 until Developer tier reopens. Same
          //     model as Cerebras so the eventual switch is a 1-env-flip.
          // Both flags can be on at once for a head-to-head comparison.
          //
          // Historical note: the v2-prompt cohort (SET-6 / json_object) was
          // retired 2026-04-22 along with the deprecated director-llm-v3-
          // {cerebras,groq}.ts modules — the v2 prompt's "describe the JSON
          // shape" style let Llama 8B echo `{"type":"object"}` instead of
          // actually picking a persona. Json_schema enum constraints closed
          // that class of parse failures.
          const groqShadowV3On =
            process.env.ENABLE_SMART_DIRECTOR_V3_GROQ_V3PROMPT === "true" &&
            (smartOn || smartV2On) &&
            !!groqKey;
          const groqShadowV3Start = groqShadowV3On ? Date.now() : null;
          const groqShadowV3Promise: Promise<LlmRoutingPickV2 | null> =
            groqShadowV3On
              ? pickPersonaGroqV3({
                  recentTranscript: directorInput,
                  isSilence: isSilenceTick,
                  recentFirings: director.getRecentFirings(),
                  cooldownsMs: director.getCooldownsMs(),
                  packPersonas: session.resolvedPack.personas,
                  liveCallbacks: director.getLiveCallbacks(),
                  unstableTailLen,
                  groqKey: groqKey!,
                  signal: AbortSignal.timeout(2000),
                  sessionId,
                }).catch(() => null)
              : Promise.resolve(null);

          const cerebrasShadowV3On =
            process.env.ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT === "true" &&
            (smartOn || smartV2On) &&
            !!cerebrasKey;
          const cerebrasShadowV3Start = cerebrasShadowV3On ? Date.now() : null;
          const cerebrasShadowV3Promise: Promise<LlmRoutingPickV2 | null> =
            cerebrasShadowV3On
              ? pickPersonaCerebrasV3({
                  recentTranscript: directorInput,
                  isSilence: isSilenceTick,
                  recentFirings: director.getRecentFirings(),
                  cooldownsMs: director.getCooldownsMs(),
                  packPersonas: session.resolvedPack.personas,
                  liveCallbacks: director.getLiveCallbacks(),
                  unstableTailLen,
                  cerebrasKey: cerebrasKey!,
                  signal: AbortSignal.timeout(2000),
                  sessionId,
                }).catch(() => null)
              : Promise.resolve(null);

          if (smartV2On) {
            const llmStart = Date.now();
            try {
              llmPickV2 = await pickPersonaLLMv2({
                recentTranscript: directorInput,
                isSilence: isSilenceTick,
                recentFirings: director.getRecentFirings(),
                cooldownsMs: director.getCooldownsMs(),
                packPersonas: session.resolvedPack.personas,
                liveCallbacks: director.getLiveCallbacks(),
                unstableTailLen,
                anthropicKey: anthropicKey!,
                signal: AbortSignal.timeout(LLM_BUDGET_MS),
                sessionId,
              });
            } catch {
              llmPickV2 = null;
            }
            // Apply deterministic sticky-agent penalty BEFORE argmax — the
            // v3 prompt explicitly tells the model NOT to penalize recent
            // speakers itself. We handle it here so the specialty signal
            // stays honest and the penalty is audit-able.
            if (llmPickV2) {
              const adjusted = applyStickyPenalty(
                llmPickV2.confidence,
                director.getRecentFirings()
              );
              llmPickV2 = {
                ...llmPickV2,
                confidence: adjusted.confidence,
                personaId: adjusted.argmax,
              };
            }
            llmElapsedMs = Date.now() - llmStart;
          } else if (smartOn) {
            const llmStart = Date.now();
            try {
              llmPick = await pickPersonaLLM({
                recentTranscript: directorInput,
                isSilence: isSilenceTick,
                recentFirings: director.getRecentFirings(),
                cooldownsMs: director.getCooldownsMs(),
                packPersonas: session.resolvedPack.personas,
                anthropicKey: anthropicKey!,
                signal: AbortSignal.timeout(LLM_BUDGET_MS),
                sessionId,
              });
            } catch {
              // pickPersonaLLM never throws by contract — belt-and-suspenders
              // in case a future refactor drops that invariant.
              llmPick = null;
            }
            llmElapsedMs = Date.now() - llmStart;
          }
          // v1.7: read the active pack's producer sensitivity mode.
          // Howard's Baba uses "loose" (triggers on speculation + confidence
          // cues + name-drops); TWiST's Molly uses "strict" (hard claims
          // only). Defaults to "strict" if the pack doesn't declare one.
          const producerPersona = session.resolvedPack.personas.find(
            (p) => p.id === "producer"
          );
          const producerFactCheckMode =
            producerPersona?.factCheckMode === "loose" ? "loose" : "strict";

          const decision = director.decide(
            directorInput,
            isSilenceTick,
            sessionId,
            {
              llmPick,
              llmPickV2: llmPickV2
                ? {
                    personaId: llmPickV2.personaId,
                    rationale: llmPickV2.rationale,
                    callbackUsed: llmPickV2.callbackUsed,
                  }
                : null,
              producerFactCheckMode,
              // v1.7: fallback feedback loop. Every fallback fire inside
              // firePersona increments the engine's per-persona counter;
              // every successful non-fallback fire decays by 1. Director
              // subtracts RECENT_FALLBACK_PENALTY per point so fallback-
              // happy personas fall out of rotation until they can speak
              // to real content again.
              recentFallbackCounts: personaEngine.getRecentFallbackCounts(),
              // v1.7: global sensitivity from the X-Sensitivity header.
              // Scales cascade probability so the whole panel feels
              // quieter or rowdier without retuning every persona.
              sensitivity,
            }
          );

          // SET-7: stamp this tick's input as the "previous" for the next
          // tick's unstable-tail computation. Done AFTER the decision lands
          // so any in-flight shadow calls still see the old previous when
          // they inspect session state (they don't, but safer this way).
          session.previousDirectorInput = directorInput;

          // v1.5: canary telemetry. One structured event per tick when the
          // Smart Director is on — enough to roll up agreement rate, latency
          // distribution, and how often the LLM actually overrode the rules.
          // Kept in the route (not the Director) because only the route
          // knows llmElapsedMs and whether the race happened at all.
          if (smartOn || smartV2On) {
            const llmPrimary = smartV2On
              ? llmPickV2?.personaId ?? null
              : llmPick?.personaId ?? null;
            const finalPrimary = decision.personaIds[0] ?? null;
            const rulePrimary = decision.rulePrimary ?? finalPrimary ?? null;
            // v1.5: include the LLM's one-liner on the compare event itself
            // so canary triage (sanity-reading 20 `overrode=true` rows in
            // logs/pipeline-debug.jsonl) can see *why* the LLM picked,
            // not just what. Null on ticks where the LLM lost the race
            // or returned nothing.
            const llmRationale = smartV2On
              ? llmPickV2?.rationale ?? null
              : llmPick?.rationale ?? null;
            log.info(smartV2On ? "director_v3_compare" : "director_v2_compare", {
              rulePrimary,
              llmPrimary,
              finalPrimary,
              source: decision.source ?? "rule",
              llmRationale,
              llmElapsedMs,
              llmTimedOut: llmPrimary === null && (llmElapsedMs ?? 0) >= LLM_BUDGET_MS,
              agreed: llmPrimary !== null && llmPrimary === rulePrimary,
              overrode:
                (decision.source === "llm" || decision.source === "silent-llm") &&
                llmPrimary !== null &&
                llmPrimary !== rulePrimary,
              isSilence: isSilenceTick,
              // v3-only fields (null on v2 path):
              confidence: llmPickV2?.confidence ?? null,
              callbackUsed: llmPickV2?.callbackUsed ?? null,
              silentPicked: decision.source === "silent-llm",
              // SET-7: how many chars of this tick's input were NEW since
              // the previous tick. Canary analyzer reads this to correlate
              // tail size with SILENT pick rate (validate: bigger tail →
              // higher silent rate when the tail dominates the signal).
              unstableTailLen,
              directorInputLen: directorInput.length,
            });
          }

          // SET-13: Smart Director fast-provider shadow compare.
          // Fired non-blocking — we don't await the shadow promises before
          // the cascade so fast-provider latency never adds to the routing
          // critical path. The .then() handler logs after each provider
          // resolves. The Haiku pick (v3 when the v3 flag is on; v2
          // otherwise) is captured in the closure so results land in the
          // same event. Each provider emits its own event — keeps the
          // log schema flat when only one is on, avoids confusing "fast is
          // null" ambiguity when both are on.
          //
          // Post-2026-04-22: only v3-prompt shadows remain. Event schema
          // preserves the `promptVersion` field on `fast` (always "v3" now)
          // so historical log rows from the retired v2-prompt cohort remain
          // queryable against the same shape.
          if (groqShadowV3On || cerebrasShadowV3On) {
            const capturedHaikuPick = smartV2On
              ? llmPickV2?.personaId ?? null
              : llmPick?.personaId ?? null;
            const capturedHaikuRationale = smartV2On
              ? llmPickV2?.rationale ?? null
              : llmPick?.rationale ?? null;
            const capturedHaikuElapsedMs = llmElapsedMs;
            const capturedHaikuVersion = smartV2On ? "v3" : "v2";

            const emitShadowCompare = (
              provider: "groq" | "cerebras",
              model: string,
              shadowPick: LlmRoutingPickV2 | null,
              elapsedMs: number | null
            ) => {
              log.info("director_v3_shadow_compare", {
                haiku: {
                  version: capturedHaikuVersion,
                  pick: capturedHaikuPick,
                  rationale: capturedHaikuRationale,
                  elapsedMs: capturedHaikuElapsedMs,
                },
                fast: {
                  pick: shadowPick?.personaId ?? null,
                  rationale: shadowPick?.rationale ?? null,
                  confidence: shadowPick?.confidence ?? null,
                  callbackUsed: shadowPick?.callbackUsed ?? null,
                  elapsedMs,
                  model,
                  provider,
                  promptVersion: "v3" as const,
                },
                agreed:
                  shadowPick?.personaId !== null &&
                  shadowPick?.personaId === capturedHaikuPick,
                isSilence: isSilenceTick,
              });
            };

            if (groqShadowV3On) {
              groqShadowV3Promise.then((groqV3Pick) => {
                const elapsedMs =
                  groqShadowV3Start !== null
                    ? Date.now() - groqShadowV3Start
                    : null;
                emitShadowCompare(
                  "groq",
                  "llama-3.1-8b-instant",
                  groqV3Pick,
                  elapsedMs
                );
              });
            }

            if (cerebrasShadowV3On) {
              cerebrasShadowV3Promise.then((cerebrasV3Pick) => {
                const elapsedMs =
                  cerebrasShadowV3Start !== null
                    ? Date.now() - cerebrasShadowV3Start
                    : null;
                emitShadowCompare(
                  "cerebras",
                  "llama3.1-8b",
                  cerebrasV3Pick,
                  elapsedMs
                );
              });
            }
          }

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
              // v1.5: "rule" | "llm" | "silent-llm" — which routing path
              // produced this pick. The debug panel badges the decision
              // card accordingly; "silent-llm" means pick is intentionally
              // null (v3 actively chose silence).
              source: decision.source ?? "rule",
              // v3 extras — null on v2 / rule paths. `callbackUsed` lets
              // the debug panel surface the Del-Close-style callback beat
              // when the router decides to heighten a recent phrase;
              // `confidence` exposes the verbalized probability vector so
              // Seth can eyeball whether the model was confident or close.
              callbackUsed: llmPickV2?.callbackUsed ?? null,
              confidence: llmPickV2?.confidence ?? null,
              // v1.7 quote-card groundwork: include the last ~500 chars of the
              // transcript window that informed this decision so the side
              // panel can attach it to the feed entry and use it later as
              // the "quote" half of a share card. Trimmed hard to keep SSE
              // bandwidth bounded even on long-running sessions.
              transcript: recentTranscript.slice(-500),
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

            // v1.7: hand the producer persona the Director's pre-extracted
            // top claims so Baba's fact-check anchors on exactly the
            // sentence the Director saw. The helper inside fireSingle
            // re-scans only when this is undefined (non-producer personas
            // ignore the arg). Guarantees the "animates then doesn't
            // speak" bug can't be caused by claim-extractor drift between
            // Director and persona engine.
            const producerClaims =
              personaId === "producer" &&
              decision.factHint?.topClaims &&
              decision.factHint.topClaims.length > 0
                ? decision.factHint.topClaims
                : undefined;

            const response = await personaEngine.fireSingle(
              personaId,
              transcript,
              streamCallback,
              isSilenceTick,
              cascadeFrom,
              /*isForceReact*/ false,
              producerClaims
            );

            lastResponse = response;
            lastPersonaId = personaId;
            // SET-12 (approach A): feed tail of each cascade response into the
            // live-callback ring buffer. Last 100 chars covers a punchline or
            // memorable phrase without diluting the buffer with full monologues.
            // Skip trivial responses (< 20 chars) — those are passes/fallbacks.
            if (response.trim().length >= 20) {
              director.addLiveCallback(response.trim().slice(-100));
            }
          }
          } catch (err) {
            // Any throw from fireSingle (LLM 5xx, timeout, unmapped model
            // alias, etc.) used to leak through to the setInterval async
            // callback's implicit promise rejection and silently deadlock
            // the session by leaving `personasFiring` stuck at true.
            log.error("persona_fire_error", {
              error: err instanceof Error ? err.message : String(err),
              forcedPersona: forcedPersona ?? null,
            });
          } finally {
            try {
              send("status", { status: "personas_complete" });
            } catch {
              // SSE writer may be closed — the lock release is the load-bearing part.
            }
            personasFiring = false;
          }
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
