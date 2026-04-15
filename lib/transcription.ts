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
 * Detect if a YouTube URL is a live stream by checking with yt-dlp.
 * Returns true for live, false for recorded, null if detection fails.
 */
async function detectLiveStream(
  ytdlpBin: string,
  url: string
): Promise<boolean | null> {
  return new Promise((resolve) => {
    const proc = spawn(ytdlpBin, [
      "--print",
      "is_live",
      "--no-download",
      "--no-warnings",
      url,
    ]);

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

  // Accumulator for triggering personas
  private newTranscriptSinceLastTrigger = "";
  private lastTriggerTime = 0;
  private readonly TRIGGER_INTERVAL_MS = 90_000; // ~1.5 minutes

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
  }

  shouldTriggerPersonas(): boolean {
    const elapsed = Date.now() - this.lastTriggerTime;
    const hasContent = this.newTranscriptSinceLastTrigger.trim().length > 50;
    return elapsed >= this.TRIGGER_INTERVAL_MS && hasContent;
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

      // Detect if this is a live stream
      this.emit("status_detail", "Checking if stream is live...");
      const liveResult = await detectLiveStream(ytdlpBin, youtubeUrl);
      this.isLive = liveResult === true;
      this.emit("status_detail", this.isLive ? "Live stream detected" : "Recorded video detected");

      // ────────────────────────────────────────────────
      // Step 1: yt-dlp — flags differ for live vs recorded
      // ────────────────────────────────────────────────
      const ytdlpArgs: string[] = [];

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

      // ────────────────────────────────────────────────
      // Step 2: FFmpeg — convert to Deepgram format
      // ────────────────────────────────────────────────
      const ffmpegArgs = [
        "-i", "pipe:0",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        // For live streams: reduce buffering for lower latency
        ...(this.isLive ? ["-fflags", "+nobuffer+flush_packets", "-flags", "+low_delay"] : []),
        "pipe:1",
      ];

      this.ffmpeg = spawn(ffmpegBin, ffmpegArgs);

      // Connect yt-dlp stdout → ffmpeg stdin
      this.ytdlp.stdout?.pipe(this.ffmpeg.stdin!);

      // Handle yt-dlp stderr (progress + errors)
      let ytdlpStderrBuffer = "";
      this.ytdlp.stderr?.on("data", (data) => {
        ytdlpStderrBuffer += data.toString();
        // Only emit real errors, not progress lines
        if (ytdlpStderrBuffer.includes("ERROR")) {
          this.emit("error", new Error(`yt-dlp: ${ytdlpStderrBuffer.trim()}`));
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

      // Pipe FFmpeg audio to Deepgram
      this.ffmpeg.stdout?.on("data", (chunk: Buffer) => {
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
        if (code !== 0 && this.isRunning) {
          if (this.isLive) {
            // Live streams can drop and come back — retry
            this.emit("error", new Error(`yt-dlp exited (code ${code}). Live stream may have ended or buffered. Retrying...`));
            this.restartAudioPipeline(youtubeUrl, ytdlpBin, ffmpegBin);
          } else {
            this.emit("error", new Error(`yt-dlp exited with code ${code}`));
          }
        }
      });

      this.ffmpeg.on("close", (code) => {
        if (code !== 0 && code !== null && this.isRunning) {
          this.emit("error", new Error(`ffmpeg exited with code ${code}`));
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

      this.ytdlp = spawn(ytdlpBin, [
        "-f", "bestaudio/best",
        "--no-part",
        "--no-warnings",
        "--live-from-start", "no",
        "--downloader", "ffmpeg",
        "--hls-use-mpegts",
        "-o", "-",
        url,
      ]);

      this.ffmpeg = spawn(ffmpegBin, [
        "-i", "pipe:0",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
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
        this.emit("deepgram_connected");

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

          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (alt && alt.transcript) {
              const isFinal = data.is_final === true;
              const text = alt.transcript;

              const event: TranscriptEvent = {
                text,
                isFinal,
                timestamp: Date.now(),
              };

              this.emit("transcript", event);

              if (isFinal) {
                this.transcriptBuffer.push(text);
                this.newTranscriptSinceLastTrigger += " " + text;

                // Keep buffer at max size
                while (this.transcriptBuffer.length > this.MAX_BUFFER_LINES) {
                  this.transcriptBuffer.shift();
                }
              }
            }
          }
        } catch {
          // Ignore parse errors on non-JSON messages
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
