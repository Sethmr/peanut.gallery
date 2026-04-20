/**
 * Linear webhook: /api/linear-webhook
 *
 * Receives issue events from Linear's webhook system and, if the issue is
 * labeled with `claude:go` (configurable via LINEAR_TRIGGER_LABEL), fires a
 * repository_dispatch event at GitHub to kick off the
 * `.github/workflows/claude-kickoff.yml` workflow. That workflow spawns
 * kickoff-Claude inside GitHub Actions to implement the ticket and open a PR.
 *
 * Linear's native GitHub integration handles ticket status sync on PR
 * open/merge — this handler does NOT touch Linear's REST API for status.
 *
 * Security:
 *   - `Linear-Signature` HMAC-SHA256 verification (constant-time comparison)
 *     against process.env.LINEAR_WEBHOOK_SECRET. Missing secret = 401.
 *   - 50 KB body size cap (DoS guard).
 *   - Raw body text is NEVER logged (contains Linear issue content).
 *   - Non-trigger events return 200 with `{skipped, reason}` — Linear retries
 *     4xx responses, so we deliberately return 200 for everything we don't
 *     want re-delivered.
 *
 * Rate-limit: module-scoped Map keyed on issue identifier (e.g. "LIN-123").
 * A given issue can fire at most once per 30 seconds. The map clears on
 * process restart — acceptable, since the double-fire window is small and
 * the workflow itself has `concurrency: cancel-in-progress`.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 50_000;
const RATE_LIMIT_MS = 30_000;
const DEFAULT_TRIGGER_LABEL = "claude:go";
const DONE_LABEL = "claude:done";

// Module-scoped rate-limit tracker. Cleared on process restart.
const lastDispatchAt = new Map<string, number>();

type LinearLabel = { name?: unknown };
type LinearIssueData = {
  id?: unknown;
  identifier?: unknown;
  title?: unknown;
  description?: unknown;
  url?: unknown;
  state?: { name?: unknown };
  labels?: { nodes?: unknown };
  team?: { key?: unknown };
};
type LinearWebhookPayload = {
  action?: unknown;
  type?: unknown;
  data?: unknown;
};

type ParsedIssue = {
  identifier: string;
  title: string;
  description: string;
  url: string;
  teamKey: string;
  labels: string[];
  stateName: string;
};

type SkipResponse = { skipped: true; reason: string };
type DispatchResponse = { dispatched: true; identifier: string };

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  // Accept either raw hex or "sha256=<hex>" just in case Linear ever adds
  // a scheme prefix (it currently doesn't, but this costs nothing).
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

function toStringArray(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) return [];
  const out: string[] = [];
  for (const node of nodes) {
    if (node && typeof node === "object") {
      const name = (node as LinearLabel).name;
      if (typeof name === "string" && name.length > 0) {
        out.push(name);
      }
    }
  }
  return out;
}

function narrowIssue(data: unknown): ParsedIssue | null {
  if (!data || typeof data !== "object") return null;
  const d = data as LinearIssueData;
  const identifier = typeof d.identifier === "string" ? d.identifier : null;
  const title = typeof d.title === "string" ? d.title : null;
  if (!identifier || !title) return null;
  const description = typeof d.description === "string" ? d.description : "";
  const url = typeof d.url === "string" ? d.url : "";
  const teamKey =
    d.team && typeof d.team === "object" && typeof d.team.key === "string"
      ? d.team.key
      : "";
  const stateName =
    d.state && typeof d.state === "object" && typeof d.state.name === "string"
      ? d.state.name
      : "";
  const labels =
    d.labels && typeof d.labels === "object"
      ? toStringArray(d.labels.nodes)
      : [];
  return { identifier, title, description, url, teamKey, labels, stateName };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

async function dispatchGithub(
  issue: ParsedIssue,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { ok: false, status: 0, body: "GITHUB_DISPATCH_TOKEN not set" };
  }

  const client_payload = {
    identifier: issue.identifier,
    title: truncate(issue.title, 200),
    description: truncate(issue.description, 8000),
    url: issue.url,
    teamKey: issue.teamKey,
    labels: issue.labels.slice(0, 20),
  };

  const res = await fetch(
    "https://api.github.com/repos/Sethmr/peanut.gallery/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "peanut-gallery-linear-webhook",
      },
      body: JSON.stringify({
        event_type: "linear-kickoff",
        client_payload,
      }),
    },
  );

  if (res.status === 204) {
    return { ok: true };
  }

  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "<failed to read response body>";
  }
  return { ok: false, status: res.status, body };
}

export async function GET(): Promise<Response> {
  return jsonResponse(
    { ok: true, hint: "POST Linear issue webhooks here" },
    200,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  // Read raw body as text first so HMAC matches byte-for-byte.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[linear-webhook] failed to read body", err);
    return jsonResponse({ error: "invalid body" }, 400);
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload too large" }, 413);
  }

  const signature = req.headers.get("linear-signature");
  if (!verifySignature(rawBody, signature)) {
    return jsonResponse({ error: "invalid signature" }, 401);
  }

  let parsed: LinearWebhookPayload;
  try {
    parsed = JSON.parse(rawBody) as LinearWebhookPayload;
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";
  const action = typeof parsed.action === "string" ? parsed.action : "";

  if (type !== "Issue") {
    const skip: SkipResponse = {
      skipped: true,
      reason: `ignored event type: ${type || "<missing>"}`,
    };
    return jsonResponse(skip, 200);
  }

  const issue = narrowIssue(parsed.data);
  if (!issue) {
    const skip: SkipResponse = {
      skipped: true,
      reason: "missing required issue fields (identifier/title)",
    };
    return jsonResponse(skip, 200);
  }

  if (action !== "create" && action !== "update") {
    const skip: SkipResponse = {
      skipped: true,
      reason: `ignored action: ${action || "<missing>"}`,
    };
    return jsonResponse(skip, 200);
  }

  const triggerLabel = (
    process.env.LINEAR_TRIGGER_LABEL || DEFAULT_TRIGGER_LABEL
  ).toLowerCase();
  const labelsLower = issue.labels.map((l) => l.toLowerCase());

  if (!labelsLower.includes(triggerLabel)) {
    const skip: SkipResponse = {
      skipped: true,
      reason: `trigger label "${triggerLabel}" not present`,
    };
    return jsonResponse(skip, 200);
  }

  if (labelsLower.includes(DONE_LABEL)) {
    const skip: SkipResponse = {
      skipped: true,
      reason: `"${DONE_LABEL}" label present — not re-triggering`,
    };
    return jsonResponse(skip, 200);
  }

  const now = Date.now();
  const last = lastDispatchAt.get(issue.identifier);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    const skip: SkipResponse = { skipped: true, reason: "rate_limited" };
    return jsonResponse(skip, 200);
  }

  const result = await dispatchGithub(issue);
  if (!result.ok) {
    console.error(
      `[linear-webhook] github dispatch failed for ${issue.identifier}`,
      { status: result.status, bodyPreview: result.body.slice(0, 500) },
    );
    return jsonResponse(
      { error: "github dispatch failed", githubStatus: result.status },
      500,
    );
  }

  lastDispatchAt.set(issue.identifier, now);
  const dispatched: DispatchResponse = {
    dispatched: true,
    identifier: issue.identifier,
  };
  return jsonResponse(dispatched, 202);
}
