/**
 * Peanut Gallery — Session Store (v2.0 session-recall groundwork)
 *
 * Persists session metadata + transcript snapshots + reactions to
 * chrome.storage.local as they happen, so the v2.0 launch feature
 * "Past sessions" (per docs/ROADMAP.md § v2.0) has the data it needs
 * when the UI lands. No UI wired here — the store is the data layer,
 * written during every session, readable from the console today via:
 *
 *   await chrome.storage.local.get(null)      // dump all
 *   await chrome.storage.local.get("sessions.index")
 *   await chrome.storage.local.get("sessions.<id>")
 *
 * Storage layout
 * ──────────────
 *   sessions.index   : string[]   // session IDs, newest first
 *   sessions.<id>    : Session    // full record (shape below)
 *
 * Session shape
 * ─────────────
 *   {
 *     id, packId, url, title,
 *     startedAt, endedAt,
 *     reactions: [{ id, personaId, role, text, timestamp,
 *                   source?, reason?, callbackUsed? }, ...],
 *     transcriptTail: string,        // last N chars, sampled
 *     transcriptUpdatedAt: number,
 *     stats: { totalDecisions, silentPicks, llmOverrides,
 *              ruleFallbacks, callbackUses,
 *              perPersonaFires } | null
 *   }
 *
 * Privacy posture
 * ───────────────
 * - Transcript is sampled (not streamed char-for-char) to keep storage
 *   bounded — a 2-hour session is ~4k chars of transcript tail, not 200k.
 * - Sessions are local-only, NEVER uploaded. Clear-all-sessions is the
 *   one-click escape hatch (exposed to the UI in v2.0).
 * - LRU eviction at MAX_SESSIONS keeps storage under Chrome's 5 MB
 *   extension-storage quota with plenty of headroom.
 *
 * Failure mode
 * ────────────
 * All storage calls are try/catch. Persistence failures degrade silently
 * (the session continues); the store is additive polish, not a
 * hard-dependency for any user-visible feature today.
 */

(function (global) {
  "use strict";

  const IDX_KEY = "sessions.index";
  const MAX_SESSIONS = 50;
  const MAX_REACTIONS_PER_SESSION = 500;
  const TRANSCRIPT_TAIL_CHARS = 4000;
  // Debounce transcript snapshots so we don't write on every partial chunk.
  // 15s cadence gives a session's worth of samples without thrashing storage.
  const TRANSCRIPT_SAMPLE_MS = 15000;

  // Per-session last-sample timestamp so updateTranscript() debounces cheaply.
  const lastTranscriptWrite = new Map();

  /** Storage helper: safe-get a single key, returns undefined on any error. */
  async function storageGet(key) {
    try {
      const obj = await chrome.storage.local.get(key);
      return obj?.[key];
    } catch (err) {
      // Storage evicted or quota exceeded — treat as cold cache.
      console.warn("[session-store] storage.get failed:", err?.message ?? err);
      return undefined;
    }
  }

  async function storageSet(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (err) {
      console.warn("[session-store] storage.set failed:", err?.message ?? err);
      return false;
    }
  }

  async function storageRemove(keys) {
    try {
      await chrome.storage.local.remove(keys);
      return true;
    } catch (err) {
      console.warn("[session-store] storage.remove failed:", err?.message ?? err);
      return false;
    }
  }

  /**
   * Read the session-id index. Always returns an array; never throws.
   * Newest-first convention so listSessions() can paginate without
   * sorting.
   */
  async function readIndex() {
    const raw = await storageGet(IDX_KEY);
    return Array.isArray(raw) ? raw : [];
  }

  async function writeIndex(ids) {
    return storageSet(IDX_KEY, ids);
  }

  /**
   * Prepend a session id to the index and evict the oldest if we're
   * over MAX_SESSIONS. Returns the evicted ids so callers can drop the
   * per-session records too.
   */
  async function addToIndex(sessionId) {
    const idx = await readIndex();
    // Dedupe: if this session id already exists (shouldn't normally), move
    // it to the front rather than double-registering.
    const dedup = idx.filter((id) => id !== sessionId);
    dedup.unshift(sessionId);
    const evicted = dedup.splice(MAX_SESSIONS);
    await writeIndex(dedup);
    if (evicted.length > 0) {
      await storageRemove(evicted.map((id) => `sessions.${id}`));
    }
    return evicted;
  }

  async function loadSession(sessionId) {
    return storageGet(`sessions.${sessionId}`);
  }

  async function saveSession(session) {
    if (!session?.id) return false;
    return storageSet(`sessions.${session.id}`, session);
  }

  /**
   * Kick off a new session record. Idempotent — a retry on the same
   * sessionId overwrites the existing record (treats the latest start
   * as canonical).
   */
  async function createSession({ sessionId, packId, url, title, startedAt }) {
    if (!sessionId) return null;
    const record = {
      id: sessionId,
      packId: packId ?? null,
      url: url ?? "",
      title: title ?? "",
      startedAt: startedAt ?? Date.now(),
      endedAt: null,
      reactions: [],
      transcriptTail: "",
      transcriptUpdatedAt: null,
      stats: null,
      schemaVersion: 1,
    };
    await saveSession(record);
    await addToIndex(sessionId);
    return record;
  }

  /**
   * Append a reaction to the session. Trims to MAX_REACTIONS_PER_SESSION
   * (oldest-first eviction) so a runaway 4-hour session doesn't bloat
   * a single record. A session that hits the cap is rare in practice —
   * each reaction is ~200 bytes, so 500 reactions = ~100 KB per session.
   */
  async function appendReaction(sessionId, reaction) {
    if (!sessionId || !reaction) return false;
    const session = await loadSession(sessionId);
    if (!session) return false;
    const reactions = Array.isArray(session.reactions) ? session.reactions : [];
    reactions.push({
      id: reaction.id ?? null,
      personaId: reaction.personaId ?? null,
      role: reaction.role ?? null,
      text: reaction.text ?? "",
      timestamp: reaction.timestamp ?? Date.now(),
      source: reaction.source ?? null,
      reason: reaction.reason ?? null,
      callbackUsed: reaction.callbackUsed ?? null,
    });
    while (reactions.length > MAX_REACTIONS_PER_SESSION) reactions.shift();
    session.reactions = reactions;
    return saveSession(session);
  }

  /**
   * Update the transcript snapshot. Debounced to at most one write per
   * TRANSCRIPT_SAMPLE_MS to keep storage writes bounded on long sessions.
   */
  async function updateTranscript(sessionId, text, opts = {}) {
    if (!sessionId) return false;
    const now = Date.now();
    const last = lastTranscriptWrite.get(sessionId) ?? 0;
    if (!opts.force && now - last < TRANSCRIPT_SAMPLE_MS) return false;
    const session = await loadSession(sessionId);
    if (!session) return false;
    session.transcriptTail =
      typeof text === "string" ? text.slice(-TRANSCRIPT_TAIL_CHARS) : "";
    session.transcriptUpdatedAt = now;
    lastTranscriptWrite.set(sessionId, now);
    return saveSession(session);
  }

  async function endSession(sessionId, stats) {
    if (!sessionId) return false;
    const session = await loadSession(sessionId);
    if (!session) return false;
    session.endedAt = Date.now();
    if (stats && typeof stats === "object") {
      session.stats = { ...stats };
    }
    lastTranscriptWrite.delete(sessionId);
    return saveSession(session);
  }

  async function listSessions() {
    const idx = await readIndex();
    const records = await Promise.all(idx.map((id) => loadSession(id)));
    return records.filter(Boolean);
  }

  async function getSession(sessionId) {
    return loadSession(sessionId);
  }

  /**
   * Wipe every session record + the index. One-click privacy escape hatch
   * for the v2.0 Settings → Critics → "Clear all past sessions" row.
   * Called from the console today — UI lands with v2.0.
   */
  async function clearAllSessions() {
    const idx = await readIndex();
    if (idx.length === 0) {
      await writeIndex([]);
      return 0;
    }
    await storageRemove(idx.map((id) => `sessions.${id}`));
    await writeIndex([]);
    return idx.length;
  }

  global.PGSessionStore = {
    createSession,
    appendReaction,
    updateTranscript,
    endSession,
    listSessions,
    getSession,
    clearAllSessions,
    // Constants exposed for the eventual UI to inspect.
    MAX_SESSIONS,
    MAX_REACTIONS_PER_SESSION,
    TRANSCRIPT_TAIL_CHARS,
  };
})(typeof self !== "undefined" ? self : window);
