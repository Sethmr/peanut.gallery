/**
 * Feedback ingest — `/api/feedback`
 *
 * Receives per-response feedback signals from the side-panel feed menu
 * (upvote / downvote / clear_vote / pin / unpin / quote_card) and emits
 * a structured `persona_feedback` event to `logs/pipeline-debug.jsonl`.
 *
 * The downstream uses:
 *
 * 1. **Smart-highlight picker** ([`SET-24`](https://linear.app/seth-dev/issue/SET-24))
 *    reads per-session votes directly from `chrome.storage.local` — it
 *    doesn't need this endpoint. Including here is defensible because
 *    the server-side signal lets the smart picker fall back to a
 *    hosted model without re-posting the browser's local state on
 *    every call.
 *
 * 2. **Model tuning feedback loop.** Votes on specific persona lines
 *    are the cheapest ground truth we can collect for "did the right
 *    persona fire?" and "did the persona land?" Accumulating these
 *    over weeks gives the v1.8.x persona-refinement sprint real
 *    signal to tune against, and a latent training set for any
 *    future routing / reranker work. See
 *    [`PERSONA-REFINEMENT-PLAN.md`](../../../docs/PERSONA-REFINEMENT-PLAN.md).
 *
 * 3. **Future: aggregation + dashboards.** Out of scope for this
 *    endpoint — it's the write-path only. Read-path / aggregation
 *    queries go in a separate module when we need them.
 *
 * Privacy posture ([design principle #5](../../../docs/DESIGN-PRINCIPLES.md)):
 * - `installId` scopes events without an account system; the hosted
 *   backend already uses this header for demo-tier rate-limiting.
 * - `responseText` + `transcriptTail` are the content the user is
 *   reacting to. Those strings are already produced + displayed
 *   client-side, so sending them back doesn't leak anything new.
 * - No keys, no PII. Self-hosters who set `DISABLE_FEEDBACK_LOGGING`
 *   can opt out entirely.
 *
 * Wire contract (request):
 * ```json
 * POST /api/feedback
 * {
 *   "sessionId": "abc123",           // session this feedback belongs to
 *   "entryId":   "producer-7",       // client-assigned feed entry id
 *   "action":    "upvote" | "downvote" | "clear_vote" | "pin" | "unpin" | "quote_card",
 *   "personaId": "producer",         // producer | troll | soundfx | joker
 *   "packId":    "howard",           // howard | twist | ...
 *   "responseText": "Heads up — …",  // what the persona said
 *   "transcriptTail": "...",         // last ~500 chars of transcript
 *                                    // that informed the fire (optional)
 *   "timestamp": 1719320445000       // ms epoch (optional; server time
 *                                    // used if absent)
 * }
 *
 * Response:
 *   204 No Content on success.
 *   400 on malformed body.
 *   503 when DISABLE_FEEDBACK_LOGGING is set (self-host opt-out).
 * ```
 */

import { logPipeline } from "../../../lib/debug-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared CORS shape with /api/transcribe so one Origin rule covers both
// endpoints. X-Install-Id is the only custom header this route reads;
// the rest are listed so a POST here from the same extension build
// doesn't get preflight-rejected on key headers it doesn't consume.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Install-Id",
  "Access-Control-Max-Age": "86400",
};

const VALID_ACTIONS = new Set([
  "upvote",
  "downvote",
  "clear_vote",
  "pin",
  "unpin",
  "quote_card",
]);

const VALID_PERSONA_IDS = new Set(["producer", "troll", "soundfx", "joker"]);

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  // Self-hoster opt-out — if the operator doesn't want to log user
  // feedback (e.g. privacy-absolutist deployment), setting this env
  // var makes the endpoint a no-op 503 without touching the log.
  if (process.env.DISABLE_FEEDBACK_LOGGING === "true") {
    return new Response(
      JSON.stringify({ error: "Feedback logging disabled on this server" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // Field validation — reject unrecognized actions / persona ids so
  // typos can't silently pollute the log. Everything else is
  // best-effort: a missing field becomes `null` in the event; we
  // don't reject a partial payload because the read-path uses
  // whatever is there.
  const action = typeof body.action === "string" ? body.action : null;
  if (!action || !VALID_ACTIONS.has(action)) {
    return jsonError(
      `Invalid or missing "action" (want: ${[...VALID_ACTIONS].join(" | ")})`,
      400
    );
  }

  const personaId =
    typeof body.personaId === "string" ? body.personaId : null;
  if (personaId && !VALID_PERSONA_IDS.has(personaId)) {
    return jsonError(
      `Invalid "personaId" (want: ${[...VALID_PERSONA_IDS].join(" | ")})`,
      400
    );
  }

  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId : undefined;
  const entryId = typeof body.entryId === "string" ? body.entryId : null;
  const packId = typeof body.packId === "string" ? body.packId : null;
  const responseText =
    typeof body.responseText === "string" ? body.responseText : null;
  const transcriptTail =
    typeof body.transcriptTail === "string" ? body.transcriptTail : null;
  const clientTimestamp =
    typeof body.timestamp === "number" ? body.timestamp : null;

  // Install-id identifies the installation without an account system.
  // Optional today — we don't reject a missing header — but future
  // per-installation clustering (v1.9.x subscription tier progress
  // tracking, v1.8 persona-refinement segmentation) assumes it.
  const installId = req.headers.get("X-Install-Id") || null;

  logPipeline({
    event: "persona_feedback",
    level: "info",
    sessionId,
    personaId: personaId ?? undefined,
    data: {
      action,
      entryId,
      packId,
      responseText,
      transcriptTail,
      clientTimestamp,
      installId,
    },
  });

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
