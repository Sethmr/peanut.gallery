/**
 * Subscription status — `GET /api/subscription/status`
 *
 * Returns the current weekly-usage + cap for a subscription key so the
 * extension can render a progress bar in the Backend & keys drawer
 * ("3.2h / 16h this week · resets Tuesday").
 *
 * Read-only. Called by the extension on session start + periodically
 * from the settings drawer. No usage is recorded by this endpoint;
 * metering happens inside `/api/transcribe` at session-close.
 *
 * Wire contract:
 *   GET /api/subscription/status
 *   Headers: X-Subscription-Key: pg-xxxx-xxxx-xxxx
 *   Response 200: SubscriptionStatus JSON
 *   Response 401: {error, code: "MISSING_KEY"}
 *
 * The response always includes `email` (so the drawer can show the
 * signup email for subscription management UX); other fields mirror
 * the `SubscriptionStatus` shape in `lib/subscription.ts`.
 */

import { getSubscriptionStatus } from "../../../../lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Subscription-Key",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const key = req.headers.get("X-Subscription-Key") || null;
  if (!key || !key.trim()) {
    return jsonResponse(
      { error: "Missing X-Subscription-Key header", code: "MISSING_KEY" },
      401
    );
  }
  const status = getSubscriptionStatus(key.trim());
  return jsonResponse(status, 200);
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
