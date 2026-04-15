/**
 * Peanut Gallery — Debug Logger
 *
 * Writes structured JSONL events to logs/pipeline-debug.jsonl.
 * Designed for AI consumption: each line is a self-contained JSON object
 * with enough context to diagnose issues without reading code.
 *
 * Enable with: DEBUG_PIPELINE=true npm run dev
 * Read with:   tail -50 logs/pipeline-debug.jsonl | jq .
 *
 * The log file is append-only and gitignored. It grows during development
 * and can be fed to an AI assistant for root-cause analysis.
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "pipeline-debug.jsonl");
const ENABLED = process.env.DEBUG_PIPELINE === "true";

// Ensure log directory exists on first use
let dirCreated = false;
function ensureDir(): void {
  if (dirCreated) return;
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    dirCreated = true;
  } catch {
    // Can't create log dir — disable logging silently
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface PipelineEvent {
  /** Event name (e.g., "ytdlp_spawn", "deepgram_message", "persona_fire") */
  event: string;
  /** Log level */
  level: LogLevel;
  /** Session ID for end-to-end tracing */
  sessionId?: string;
  /** Persona ID if event is persona-specific */
  personaId?: string;
  /** Arbitrary structured data */
  data?: Record<string, unknown>;
  /** Duration in ms for timed operations */
  durationMs?: number;
}

/**
 * Log a structured event to the pipeline debug file.
 * No-op if DEBUG_PIPELINE is not set to "true".
 * Never throws — logging failures must not break the pipeline.
 */
export function logPipeline(event: PipelineEvent): void {
  // Always log errors to console regardless of DEBUG_PIPELINE
  if (event.level === "error") {
    console.error(
      `[PG:${event.event}]`,
      event.data?.message || event.data?.error || "",
      event.sessionId ? `(session: ${event.sessionId})` : ""
    );
  }

  if (!ENABLED) return;

  try {
    ensureDir();

    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Never let logging break the app
  }
}

/**
 * Convenience: log with timing. Returns a function to call when done.
 *
 * Usage:
 *   const done = logTimed("deepgram_connect", "info", { sessionId });
 *   await connectDeepgram();
 *   done({ connected: true });
 */
export function logTimed(
  event: string,
  level: LogLevel,
  initial?: Partial<PipelineEvent>
): (data?: Record<string, unknown>) => void {
  const start = Date.now();

  logPipeline({
    event: `${event}_start`,
    level,
    ...initial,
  });

  return (data?: Record<string, unknown>) => {
    logPipeline({
      event: `${event}_done`,
      level,
      ...initial,
      durationMs: Date.now() - start,
      data,
    });
  };
}

/**
 * Create a session-scoped logger for convenience.
 * Every call automatically includes the sessionId.
 */
export function createSessionLogger(sessionId: string) {
  return {
    debug: (event: string, data?: Record<string, unknown>) =>
      logPipeline({ event, level: "debug", sessionId, data }),
    info: (event: string, data?: Record<string, unknown>) =>
      logPipeline({ event, level: "info", sessionId, data }),
    warn: (event: string, data?: Record<string, unknown>) =>
      logPipeline({ event, level: "warn", sessionId, data }),
    error: (event: string, data?: Record<string, unknown>) =>
      logPipeline({ event, level: "error", sessionId, data }),
    timed: (event: string, level: LogLevel = "info") =>
      logTimed(event, level, { sessionId }),
  };
}
