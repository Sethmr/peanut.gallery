/**
 * Linear webhook: /api/linear-webhook
 *
 * Receives issue events from Linear's webhook system and, if the issue has
 * transitioned into an "unstarted" state (i.e. the "Todo" column) OR still
 * carries the legacy `claude:go` label, fires a repository_dispatch event at
 * GitHub to kick off the `.github/workflows/claude-kickoff.yml` workflow.
 * That workflow spawns kickoff-Claude inside GitHub Actions to implement the
 * ticket and open a PR.
 *
 * Linear's native GitHub integration handles ticket status sync on PR
 * open/merge — this handler does NOT touch Linear's REST API for status.
 *
 * === Trigger semantics ===
 *
 * Primary trigger: state.type === "unstarted" (i.e. Todo column) reached
 *   either via direct create into Todo, or via move from another state.
 *   Detected by:
 *     - action === "create" AND data.state.type === "unstarted"
 *     - action === "update" AND data.state.type === "unstarted"
 *       AND updatedFrom.stateId exists (state transition happened)
 *
 * Secondary (legacy) trigger: labels contain `claude:go`. Keeps the pre-
 *   research mental model working for users who staged a label in Backlog
 *   and expect it to still fire when they flick it into Backlog with the
 *   label already attached.
 *
 * Opt-out: labels contain `claude:skip` — short-circuit, never dispatch.
 *
 * Model elevation: labels contain `needs-opus` (case-insensitive) — dispatch
 *   payload sets `model: "opus"`; otherwise `model: "sonnet"`. The workflow
 *   reads this to choose CLI args (Opus 4.7 / turns 40 vs. Sonnet 4.6 /
 *   turns 20). Opus is ~5x more expensive on output per Anthropic pricing
 *   so Sonnet is the cost-minimized default.
 *
 * Why key on state.type and not state.name:
 *   Linear's state .type is a schema-fixed enum
 *   (triage|backlog|unstarted|started|completed|canceled); state .name is
 *   workspace-configurable. Keying on .type survives renames.
 *
 * === Security ===
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
const LEGACY_TRIGGER_LABEL = "claude:go";
const SKIP_LABEL = "claude:skip";
const OPUS_LABEL = "needs-opus";

// Module-scoped rate-limit tracker. Cleared on process restart.
const lastDispatchAt = new Map<string, number>();

type LinearLabel = { name?: unknown };
type LinearIssueData = {
  id?: unknown;
  identifier?: unknown;
  title?: unknown;
  description?: unknown;
  url?: unknown;
  state?: { name?: unknown; type?: unknown };
  labels?: { nodes?: unknown };
  team?: { key?: unknown };
};
type LinearWebhookPayload = {
  action?: unknown;
  type?: unknown;
  data?: unknown;
  updatedFrom?: unknown;
};

type ParsedIssue = {
  identifier: string;
  title: string;
  description: string;
  url: string;
  teamKey: string;
  labels: string[];
  stateName: string;
  stateType: string;
};

type SkipResponse = { skipped: true; reason: string };
type DispatchResponse = { dispatched: true; identifier: string; model: "opus" | "sonnet" };

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
  const stateType =
    d.state && typeof d.state === "object" && typeof d.state.type === "string"
      ? d.state.type
      : "";
  const labels =
    d.labels && typeof d.labels === "object"
      ? toStringArray(d.labels.nodes)
      : [];
  return {
    identifier,
    title,
    description,
    url,
    teamKey,
    labels,
    stateName,
    stateType,
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * Detect whether this event represents a transition into an `unstarted`
 * (i.e. Todo) state — either direct creation in Todo or a move into Todo.
 */
function isUnstartedTransition(
  action: string,
  issue: ParsedIssue,
  updatedFrom: unknown,
): boolean {
  if (issue.stateType !== "unstarted") return false;
  if (action === "create") return true;
  if (action !== "update") return false;
  // On update, require that the state actually changed — updatedFrom.stateId
  // is present when Linear diffs a state transition. Without it, a mere edit
  // to a ticket already in Todo would keep re-firing.
  if (!updatedFrom || typeof updatedFrom !== "object") return false;
  const uf = updatedFrom as { stateId?: unknown };
  return typeof uf.stateId === "string" && uf.stateId.length > 0;
}

async function dispatchGithub(
  issue: ParsedIssue,
  model: "opus" | "sonnet",
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
    model,
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

  const labelsLower = issue.labels.map((l) => l.toLowerCase());

  // Opt-out always wins.
  if (labelsLower.includes(SKIP_LABEL)) {
    const skip: SkipResponse = {
      skipped: true,
      reason: `"${SKIP_LABEL}" label present`,
    };
    return jsonResponse(skip, 200);
  }

  const unstartedTransition = isUnstartedTransition(
    action,
    issue,
    parsed.updatedFrom,
  );
  const hasLegacyLabel = labelsLower.includes(LEGACY_TRIGGER_LABEL);

  if (!unstartedTransition && !hasLegacyLabel) {
    const skip: SkipResponse = {
      skipped: true,
      reason: "not an unstarted-state transition and no claude:go label",
    };
    return jsonResponse(skip, 200);
  }

  const model: "opus" | "sonnet" = labelsLower.includes(OPUS_LABEL)
    ? "opus"
    : "sonnet";

  const now = Date.now();
  const last = lastDispatchAt.get(issue.identifier);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    const skip: SkipResponse = { skipped: true, reason: "rate_limited" };
    return jsonResponse(skip, 200);
  }

  const result = await dispatchGithub(issue, model);
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
    model,
  };
  return jsonResponse(dispatched, 202);
}
