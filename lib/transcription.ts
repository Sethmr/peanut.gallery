/**
 * Peanut Gallery — Transcription Manager
 *
 * Handles the real-time audio pipeline:
 * YouTube URL → yt-dlp (stdout) → FFmpeg (PCM 16-bit, 16kHz, mono) → Deepgram Nova-3
 *
 * Hardened for LIVE STREAMS:
 * - yt-dlp flags tuned for live vs. recorded detection
 * - Deepgram keepalive to prevent timeout on quiet segments
 * - Auto-reconnect with exponential backoff
 * - Graceful handling of stream interruptions
 */

import { spawn, execSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import WebSocket from "ws";
import { logPipeline, logTimed } from "./debug-logger";

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

/**
 * Resolve the full path to a CLI binary.
 * Next.js server doesn't inherit the user's shell PATH,
 * so Homebrew binaries like yt-dlp and ffmpeg aren't found by default.
 */
function which(bin: string): string {
  const searchPaths = [
    `/opt/homebrew/bin/${bin}`,
    `/usr/local/bin/${bin}`,
    `/usr/bin/${bin}`,
  ];

  for (const p of searchPaths) {
    try {
      execSync(`test -x ${p}`, { stdio: "ignore" });
      return p;
    } catch {
      // not found, keep looking
    }
  }

  try {
    return execSync(`which ${bin}`).toString().trim();
  } catch {
    return bin;
  }
}

/**
 * Build common yt-dlp auth/cookie args.
 *
 * YouTube increasingly blocks audio extraction from headless servers.
 * This function adds the right flags depending on the environment:
 *
 * 1. YT_DLP_COOKIES_FILE — path to a Netscape-format cookies.txt
 *    (best for Docker / Railway — mount the file as a volume)
 * 2. YT_DLP_COOKIE_BROWSER — browser name (chrome, firefox, etc.)
 *    (only works locally where the browser is installed)
 * 3. Fallback: --extractor-args to use YouTube's web client without
 *    po_token, which works for many (not all) videos without cookies
 */
function buildYtdlpAuthArgs(): string[] {
  const args: string[] = [];

  const cookiesFile = process.env.YT_DLP_COOKIES_FILE?.trim();
  const cookieBrowser = process.env.YT_DLP_COOKIE_BROWSER?.trim();

  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
    console.log(`[PG] yt-dlp: using cookies file ${cookiesFile}`);
    logPipeline({ event: "ytdlp_cookies", level: "info", data: { source: "file", path: cookiesFile } });
  } else if (cookieBrowser) {
    args.push("--cookies-from-browser", cookieBrowser);
    console.log(`[PG] yt-dlp: using cookies from ${cookieBrowser}`);
    logPipeline({ event: "ytdlp_cookies", level: "info", data: { source: "browser", browser: cookieBrowser } });
  }

  // Player client strategy for headless servers.
  // YouTube aggressively blocks data center IPs (2025-2026 "Great Wall").
  // web_music,web has the best success rate on headless servers as of 2026.
  // mediaconnect was blocked in early 2026.
  const playerClient = process.env.YT_DLP_PLAYER_CLIENT?.trim() || "web_music,web";
  args.push(
    "--extractor-args", `youtube:player_client=${playerClient}`,
  );

  // Spoof a real browser User-Agent to reduce bot detection
  args.push(
    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );

  // Retry strategy for rate limiting
  args.push(
    "--retries", "3",
    "--extractor-retries", "3",
  );

  return args;
}

/**
 * Detect if a YouTube URL is a live stream by checking with yt-dlp.
 * Returns true for live, false for recorded, null if detection fails.
 */
async function detectLiveStream(
  ytdlpBin: string,
  url: string
): Promise<boolean | null> {
  return new Promise((resolve) => {
    const args = [
      ...buildYtdlpAuthArgs(),
      "--print",
      "is_live",
      "--no-download",
      "--no-warnings",
    ];
    args.push(url);
    const proc = spawn(ytdlpBin, args);

    let output = "";
    proc.stdout?.on("data", (d) => (output += d.toString()));
    proc.on("close", () => {
      const trimmed = output.trim().toLowerCase();
      if (trimmed === "true") resolve(true);
      else if (trimmed === "false" || trimmed === "none") resolve(false);
      else resolve(null);
    });
    proc.on("error", () => resolve(null));

    // Don't hang forever on detection
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 10_000);
  });
}

export class TranscriptionManager extends EventEmitter {
  private ytdlp: ChildProcess | null = null;
  private ffmpeg: ChildProcess | null = null;
  private dgSocket: WebSocket | null = null;
  private deepgramKey: string;
  private isRunning = false;
  private isLive = false;

  // Rolling transcript buffer (last ~15 minutes)
  private transcriptBuffer: string[] = [];
  private readonly MAX_BUFFER_LINES = 200;

  // Pipeline data-flow tracking — shows exactly where data stalls
  private ytdlpBytesReceived = 0;
  private ffmpegBytesReceived = 0;
  private deepgramMessagesReceived = 0;
  private firstTranscriptTime: number | null = null;

  // Accumulator for triggering personas
  private newTranscriptSinceLastTrigger = "";
  private lastTriggerTime = 0;
  private triggerCount = 0;
  // First trigger fires after 15s so user sees activity fast.
  // Subsequent triggers every 20-25s — the Director picks ONE persona per trigger
  // and cascades to others with decreasing probability, so shorter intervals
  // feel natural (you're getting 1-2 responses per trigger, not 4).
  private readonly FIRST_TRIGGER_MS = 15_000;
  private readonly TRIGGER_INTERVAL_MS = 22_000;

  // Deepgram keepalive for live streams (prevents timeout on quiet segments)
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  // Reconnect tracking
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor(deepgramKey: string) {
    super();
    this.deepgramKey = deepgramKey;
  }

  get transcript(): string {
    return this.transcriptBuffer.join(" ");
  }

  get newTranscript(): string {
    return this.newTranscriptSinceLastTrigger;
  }

  resetNewTranscript(): void {
    this.newTranscriptSinceLastTrigger = "";
    this.lastTriggerTime = Date.now();
    this.triggerCount++;
  }

  shouldTriggerPersonas(): boolean {
    const elapsed = Date.now() - this.lastTriggerTime;
    const interval = this.triggerCount === 0 ? this.FIRST_TRIGGER_MS : this.TRIGGER_INTERVAL_MS;
    const hasContent = this.newTranscriptSinceLastTrigger.trim().length > 30;
    return elapsed >= interval && hasContent;
  }

  /** Force-trigger personas immediately (for manual "fire" button) */
  forceTrigger(): boolean {
    if (this.newTranscriptSinceLastTrigger.trim().length > 10) {
      return true;
    }
    return this.transcriptBuffer.length > 0;
  }

  /** Force the next trigger check to fire by resetting the timer to the past */
  forceNextTrigger(): void {
    this.lastTriggerTime = 0;
    // Ensure there's enough content by using full transcript if new is empty
    if (this.newTranscriptSinceLastTrigger.trim().length < 30) {
      this.newTranscriptSinceLastTrigger = this.transcriptBuffer.slice(-10).join(" ");
    }
  }

  // ──────────────────────────────────────────────────
  // BROWSER AUDIO MODE
  //
  // Instead of yt-dlp + ffmpeg, audio comes from the user's
  // browser via Chrome extension tab capture.
  // The extension sends PCM 16-bit 16kHz mono chunks via HTTP.
  // No bot detection, no cookies, works everywhere.
  // ──────────────────────────────────────────────────

  private browserMode = false;
  private browserAudioBytesReceived = 0;

  /** Start in browser audio mode — just connect Deepgram, no yt-dlp/ffmpeg */
  async startBrowser(isLive = false): Promise<void> {
    if (this.isRunning) {
      throw new Error("Transcription already running");
    }
    this.isRunning = true;
    this.browserMode = true;
    this.isLive = isLive;
    this.lastTriggerTime = Date.now();

    console.log("[PG] Starting in BROWSER AUDIO mode — no yt-dlp/ffmpeg");
    logPipeline({ event: "pipeline_start_browser", level: "info", data: { isLive } });

    this.emit("status_detail", "Connecting to Deepgram...");
    await this.connectDeepgram();

    this.emit("started");
    this.emit("live_status", isLive);
    this.emit("status_detail", "Ready — waiting for browser audio...");
  }

  /** Feed raw PCM audio from the browser (16-bit, 16kHz, mono) */
  feedAudio(chunk: Buffer): void {
    if (!this.isRunning || !this.dgSocket) return;

    const wasZero = this.browserAudioBytesReceived === 0;
    this.browserAudioBytesReceived += chunk.length;

    if (wasZero) {
      console.log(`[PG] Browser audio: first chunk received (${chunk.length} bytes)`);
      logPipeline({ event: "browser_audio_first_bytes", level: "info", data: { bytes: chunk.length } });
      this.emit("status_detail", "Browser audio streaming — sending to Deepgram...");
    }

    if (this.dgSocket.readyState === WebSocket.OPEN) {
      this.dgSocket.send(chunk);
    }
  }

  get isBrowserMode(): boolean {
    return this.browserMode;
  }

  async start(youtubeUrl: string): Promise<void> {
    if (this.isRunning) {
      throw new Error("Transcription already running");
    }
    this.isRunning = true;
    this.lastTriggerTime = Date.now();

    try {
      const ytdlpBin = which("yt-dlp");
      const ffmpegBin = which("ffmpeg");

      console.log(`[PG] Pipeline starting — yt-dlp: ${ytdlpBin}, ffmpeg: ${ffmpegBin}`);
      console.log(`[PG] URL: ${youtubeUrl}`);
      logPipeline({ event: "pipeline_start", level: "info", data: { url: youtubeUrl, ytdlpBin, ffmpegBin } });

      // Detect if this is a live stream
      this.emit("status_detail", "Checking if stream is live...");
      const doneLiveDetect = logTimed("live_detection", "info");
      const liveResult = await detectLiveStream(ytdlpBin, youtubeUrl);
      this.isLive = liveResult === true;
      doneLiveDetect({ isLive: this.isLive, rawResult: String(liveResult) });
      this.emit("status_detail", this.isLive ? "Live stream detected" : "Recorded video detected");

      // ────────────────────────────────────────────────
      // Step 1: yt-dlp — flags differ for live vs recorded
      // ────────────────────────────────────────────────
      const ytdlpArgs: string[] = [
        ...buildYtdlpAuthArgs(),
      ];

      if (this.isLive) {
        ytdlpArgs.push(
          "-f", "bestaudio/best",     // live streams may not have separate audio tracks
          "--no-part",                 // don't write .part files (we're piping)
          "--no-warnings",
          "--live-from-start", "no",   // join at the live edge, don't replay
          "--downloader", "ffmpeg",    // use ffmpeg downloader for HLS live streams
          "--hls-use-mpegts",          // use MPEG-TS for HLS (better for piping live)
          "-o", "-",
          youtubeUrl
        );
      } else {
        ytdlpArgs.push(
          "-f", "bestaudio",
          "--no-warnings",
          "-o", "-",
          youtubeUrl
        );
      }

      this.ytdlp = spawn(ytdlpBin, ytdlpArgs);

      logPipeline({ event: "ytdlp_spawn", level: "info", data: { args: ytdlpArgs.filter(a => !a.startsWith("http")), isLive: this.isLive } });

      // ────────────────────────────────────────────────
      // Step 2: FFmpeg — convert to Deepgram format
      // ────────────────────────────────────────────────
      const ffmpegArgs = [
        "-i", "pipe:0",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-f", "s16le",   // Raw PCM — no WAV header. Deepgram expects linear16.
        // For live streams: reduce buffering for lower latency
        ...(this.isLive ? ["-fflags", "+nobuffer+flush_packets", "-flags", "+low_delay"] : []),
        "pipe:1",
      ];

      this.ffmpeg = spawn(ffmpegBin, ffmpegArgs);

      // Track yt-dlp stdout before piping to ffmpeg
      this.ytdlp.stdout?.on("data", (chunk: Buffer) => {
        const wasZero = this.ytdlpBytesReceived === 0;
        this.ytdlpBytesReceived += chunk.length;
        if (wasZero) {
          console.log(`[PG] yt-dlp: first audio bytes received (${chunk.length} bytes)`);
          logPipeline({ event: "ytdlp_first_bytes", level: "info", data: { bytes: chunk.length } });
          this.emit("status_detail", "Audio stream connected — extracting audio...");
        }
      });

      // Connect yt-dlp stdout → ffmpeg stdin
      this.ytdlp.stdout?.pipe(this.ffmpeg.stdin!);

      // Handle yt-dlp stderr (progress + errors)
      let ytdlpStderrBuffer = "";
      this.ytdlp.stderr?.on("data", (data) => {
        const msg = data.toString();
        ytdlpStderrBuffer += msg;

        // Log all stderr for diagnostics (trimmed)
        logPipeline({ event: "ytdlp_stderr", level: "debug", data: { text: msg.trim().slice(0, 200) } });

        // Catch errors — yt-dlp uses "ERROR:" prefix, but also check for common failure patterns
        if (
          ytdlpStderrBuffer.includes("ERROR") ||
          ytdlpStderrBuffer.includes("unable to download") ||
          ytdlpStderrBuffer.includes("is not a valid URL") ||
          ytdlpStderrBuffer.includes("Video unavailable")
        ) {
          const errorLine = ytdlpStderrBuffer.trim().split("\n").pop() || ytdlpStderrBuffer.trim();
          console.error(`[PG] yt-dlp error: ${errorLine}`);
          this.emit("error", new Error(`yt-dlp: ${errorLine}`));
          ytdlpStderrBuffer = "";
        }
        // Flush buffer periodically to avoid memory buildup
        if (ytdlpStderrBuffer.length > 5000) {
          ytdlpStderrBuffer = ytdlpStderrBuffer.slice(-1000);
        }
      });

      // ────────────────────────────────────────────────
      // Step 3: Deepgram WebSocket
      // ────────────────────────────────────────────────
      await this.connectDeepgram();

      // Pipe FFmpeg audio to Deepgram (with data-flow tracking)
      this.ffmpeg.stdout?.on("data", (chunk: Buffer) => {
        const wasZero = this.ffmpegBytesReceived === 0;
        this.ffmpegBytesReceived += chunk.length;
        if (wasZero) {
          console.log(`[PG] ffmpeg: first PCM output received (${chunk.length} bytes)`);
          logPipeline({ event: "ffmpeg_first_bytes", level: "info", data: { bytes: chunk.length } });
          this.emit("status_detail", "Audio converting — sending to Deepgram...");
        }
        if (this.dgSocket && this.dgSocket.readyState === WebSocket.OPEN) {
          this.dgSocket.send(chunk);
        }
      });

      // Handle FFmpeg stderr (suppress normal output, catch real errors)
      this.ffmpeg.stderr?.on("data", (data) => {
        const msg = data.toString();
        // FFmpeg writes a LOT to stderr normally. Only catch fatal errors.
        if (
          msg.includes("Error") &&
          !msg.includes("Error while decoding") && // transient decode errors are ok
          !msg.includes("error hiding")
        ) {
          this.emit("error", new Error(`ffmpeg: ${msg.trim()}`));
        }
      });

      // Handle process exits with live-aware restart logic
      this.ytdlp.on("close", (code) => {
        console.log(`[PG] yt-dlp exited with code ${code} (sent ${this.ytdlpBytesReceived} bytes)`);
        logPipeline({ event: "ytdlp_exit", level: code === 0 ? "info" : "warn", data: { code, bytesProduced: this.ytdlpBytesReceived } });
        if (code !== 0 && this.isRunning) {
          if (this.isLive) {
            // Live streams can drop and come back — retry
            this.emit("error", new Error(`yt-dlp exited (code ${code}). Live stream may have ended or buffered. Retrying...`));
            this.restartAudioPipeline(youtubeUrl, ytdlpBin, ffmpegBin);
          } else if (this.ytdlpBytesReceived === 0) {
            // yt-dlp failed to extract any audio — likely bot detection
            this.emit("error", new Error(
              "YouTube blocked audio extraction (bot detection on this server's IP). " +
              "Fix: add a cookies.txt file via the YT_DLP_COOKIES_FILE env var."
            ));
          } else {
            this.emit("error", new Error(`yt-dlp exited with code ${code}`));
          }
        }
      });

      this.ffmpeg.on("close", (code) => {
        console.log(`[PG] ffmpeg exited with code ${code} (produced ${this.ffmpegBytesReceived} bytes PCM)`);
        logPipeline({ event: "ffmpeg_exit", level: code === 0 || code === null ? "info" : "warn", data: { code, bytesProduced: this.ffmpegBytesReceived } });
        if (code !== 0 && code !== null && this.isRunning) {
          // If ffmpeg failed because yt-dlp gave it nothing, surface the REAL error
          if (this.ytdlpBytesReceived === 0) {
            this.emit("error", new Error(
              "YouTube blocked the audio download (bot detection). " +
              "This is a known issue with data center servers. " +
              "To fix: set YT_DLP_COOKIES_FILE env var with a cookies.txt from a logged-in browser session. " +
              "See the GitHub README for setup instructions."
            ));
          } else {
            this.emit("error", new Error(`ffmpeg exited with code ${code}`));
          }
        }
      });

      this.emit("started");
      this.emit("live_status", this.isLive);
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  /**
   * Restart the audio pipeline (yt-dlp + ffmpeg) without touching Deepgram.
   * Used when a live stream buffers or temporarily drops.
   */
  private restartAudioPipeline(
    url: string,
    ytdlpBin: string,
    ffmpegBin: string
  ): void {
    if (!this.isRunning) return;

    // Kill existing processes
    this.ytdlp?.kill("SIGTERM");
    this.ffmpeg?.kill("SIGTERM");

    // Wait a beat, then restart
    setTimeout(() => {
      if (!this.isRunning) return;

      this.emit("status_detail", "Reconnecting to live stream...");

      const reconnectArgs: string[] = [
        ...buildYtdlpAuthArgs(),
      ];
      reconnectArgs.push(
        "-f", "bestaudio/best",
        "--no-part",
        "--no-warnings",
        "--live-from-start", "no",
        "--downloader", "ffmpeg",
        "--hls-use-mpegts",
        "-o", "-",
        url,
      );

      this.ytdlp = spawn(ytdlpBin, reconnectArgs);

      this.ffmpeg = spawn(ffmpegBin, [
        "-i", "pipe:0",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-f", "s16le",   // Raw PCM — no WAV header
        "-fflags", "+nobuffer+flush_packets",
        "-flags", "+low_delay",
        "pipe:1",
      ]);

      this.ytdlp.stdout?.pipe(this.ffmpeg.stdin!);

      this.ffmpeg.stdout?.on("data", (chunk: Buffer) => {
        if (this.dgSocket && this.dgSocket.readyState === WebSocket.OPEN) {
          this.dgSocket.send(chunk);
        }
      });

      this.ytdlp.on("close", (code) => {
        if (code !== 0 && this.isRunning && this.isLive) {
          this.emit("error", new Error("Live stream dropped again. Retrying..."));
          this.restartAudioPipeline(url, ytdlpBin, ffmpegBin);
        }
      });
    }, 3000);
  }

  private connectDeepgram(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL("wss://api.deepgram.com/v1/listen");
      url.searchParams.set("model", "nova-3");
      url.searchParams.set("punctuate", "true");
      url.searchParams.set("interim_results", "true");
      url.searchParams.set("utterance_end_ms", "1500");
      url.searchParams.set("vad_events", "true");
      url.searchParams.set("smart_format", "true");
      url.searchParams.set("encoding", "linear16");
      url.searchParams.set("sample_rate", "16000");
      url.searchParams.set("channels", "1");

      // Live-specific: enable diarization so we know who's talking
      if (this.isLive) {
        url.searchParams.set("diarize", "true");
      }

      this.dgSocket = new WebSocket(url.toString(), {
        headers: {
          Authorization: `Token ${this.deepgramKey}`,
        },
      });

      this.dgSocket.on("open", () => {
        this.reconnectAttempts = 0;
        console.log("[PG] Deepgram: WebSocket connected");
        logPipeline({ event: "deepgram_connected", level: "info" });
        this.emit("deepgram_connected");

        // Pipeline stall detector — warn if no transcript after 15 seconds
        setTimeout(() => {
          if (!this.firstTranscriptTime && this.isRunning) {
            const diag = {
              browserMode: this.browserMode,
              browserAudioBytes: this.browserAudioBytesReceived,
              ytdlpBytes: this.ytdlpBytesReceived,
              ffmpegBytes: this.ffmpegBytesReceived,
              deepgramMessages: this.deepgramMessagesReceived,
            };
            console.warn("[PG] STALL DETECTED — No transcript after 15s.", diag);
            logPipeline({ event: "pipeline_stall", level: "warn", data: diag });

            // Surface a diagnostic message to the UI
            if (this.browserMode) {
              // Browser audio mode — different diagnostics
              if (diag.browserAudioBytes === 0) {
                this.emit("status_detail", "⚠ No audio received from browser yet — make sure the video is playing");
                this.emit("error", new Error("No audio received from your browser. Make sure the YouTube video is playing and the Peanut Gallery extension is active."));
              } else if (diag.deepgramMessages === 0) {
                this.emit("status_detail", "⚠ Deepgram hasn't responded — check API key or network");
                this.emit("error", new Error("Deepgram is not responding. Check your API key and network connection."));
              } else {
                this.emit("status_detail", "⚠ Audio is flowing but no transcript yet — Deepgram may need more audio");
              }
            } else {
              // Server-side yt-dlp mode
              if (diag.ytdlpBytes === 0) {
                const hasCookies = !!(process.env.YT_DLP_COOKIE_BROWSER?.trim() || process.env.YT_DLP_COOKIES_FILE?.trim());
                const cookieHint = hasCookies
                  ? " Cookies are configured but extraction still failed — try updating yt-dlp or using a different video."
                  : " This video may require authentication. Try a different YouTube URL, or set YT_DLP_COOKIES_FILE to a cookies.txt path.";
                this.emit("status_detail", "⚠ yt-dlp hasn't produced any audio yet — check the YouTube URL");
                this.emit("error", new Error(`yt-dlp is not producing audio.${cookieHint}`));
              } else if (diag.ffmpegBytes === 0) {
                this.emit("status_detail", "⚠ ffmpeg hasn't produced any output — audio conversion may have failed");
                this.emit("error", new Error("ffmpeg is not producing PCM output. Audio format may be unsupported."));
              } else if (diag.deepgramMessages === 0) {
                this.emit("status_detail", "⚠ Deepgram hasn't responded — check API key or network");
                this.emit("error", new Error("Deepgram is not responding. Check your API key and network connection."));
              } else {
                this.emit("status_detail", "⚠ Audio is flowing but no transcript yet — Deepgram may need more audio");
              }
            }
          }
        }, 15_000);

        // Keepalive: send empty frames every 8s to prevent Deepgram timeout
        // Critical for live streams with quiet moments (ad breaks, pauses)
        this.keepaliveInterval = setInterval(() => {
          if (this.dgSocket && this.dgSocket.readyState === WebSocket.OPEN) {
            this.dgSocket.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 8000);

        resolve();
      });

      this.dgSocket.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          this.deepgramMessagesReceived++;

          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (alt && alt.transcript) {
              const isFinal = data.is_final === true;
              const text = alt.transcript;

              // Track first transcript for diagnostics
              if (!this.firstTranscriptTime) {
                this.firstTranscriptTime = Date.now();
                console.log(`[PG] Deepgram: first transcript received — "${text.slice(0, 60)}..."`);
                logPipeline({ event: "deepgram_first_transcript", level: "info", data: { text: text.slice(0, 100), isFinal } });
                this.emit("status_detail", "Transcript flowing!");
              }

              const event: TranscriptEvent = {
                text,
                isFinal,
                timestamp: Date.now(),
              };

              this.emit("transcript", event);

              if (isFinal) {
                this.transcriptBuffer.push(text);
                this.newTranscriptSinceLastTrigger += " " + text;

                logPipeline({
                  event: "transcript_final",
                  level: "debug",
                  data: {
                    textLength: text.length,
                    bufferSize: this.transcriptBuffer.length,
                    newTranscriptLength: this.newTranscriptSinceLastTrigger.length,
                    preview: text.slice(0, 80),
                  },
                });

                // Keep buffer at max size
                while (this.transcriptBuffer.length > this.MAX_BUFFER_LINES) {
                  this.transcriptBuffer.shift();
                }
              }
            }
          } else if (data.type === "Error" || data.error) {
            // Surface Deepgram errors (e.g., invalid encoding, auth failures)
            const msg = data.message || data.error || JSON.stringify(data);
            logPipeline({ event: "deepgram_error", level: "error", data: { message: msg, raw: JSON.stringify(data).slice(0, 500) } });
            this.emit("error", new Error(`Deepgram: ${msg}`));
          } else if (data.type === "Metadata") {
            logPipeline({ event: "deepgram_metadata", level: "debug", data: { raw: JSON.stringify(data).slice(0, 300) } });
          }
        } catch {
          // Non-JSON messages (binary keepalive responses, etc.)
        }
      });

      this.dgSocket.on("error", (err) => {
        this.emit(
          "error",
          new Error(`Deepgram WebSocket error: ${err.message}`)
        );
        reject(err);
      });

      this.dgSocket.on("close", (code, reason) => {
        // Clear keepalive
        if (this.keepaliveInterval) {
          clearInterval(this.keepaliveInterval);
          this.keepaliveInterval = null;
        }

        if (this.isRunning) {
          this.emit("deepgram_disconnected");

          // Exponential backoff reconnect
          if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              2000 * Math.pow(2, this.reconnectAttempts),
              30000
            );
            this.reconnectAttempts++;
            this.emit(
              "status_detail",
              `Deepgram disconnected (code ${code}). Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
            );

            setTimeout(() => {
              if (this.isRunning) {
                this.connectDeepgram().catch((err) =>
                  this.emit("error", err)
                );
              }
            }, delay);
          } else {
            this.emit(
              "error",
              new Error(
                `Deepgram disconnected after ${this.MAX_RECONNECT_ATTEMPTS} reconnect attempts. Reason: ${reason || code}`
              )
            );
          }
        }
      });
    });
  }

  stop(): void {
    this.isRunning = false;

    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }

    if (this.dgSocket) {
      try {
        this.dgSocket.send(JSON.stringify({ type: "CloseStream" }));
        this.dgSocket.close();
      } catch {
        // Ignore close errors
      }
      this.dgSocket = null;
    }

    if (this.ffmpeg) {
      this.ffmpeg.kill("SIGTERM");
      this.ffmpeg = null;
    }

    if (this.ytdlp) {
      this.ytdlp.kill("SIGTERM");
      this.ytdlp = null;
    }

    this.emit("stopped");
  }
}
