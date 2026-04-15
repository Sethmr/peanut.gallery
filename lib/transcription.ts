/**
 * Peanut Gallery — Transcription Manager
 *
 * Handles the real-time audio pipeline:
 * YouTube URL → yt-dlp (stdout) → FFmpeg (PCM 16-bit, 16kHz, mono) → Deepgram Nova-3
 *
 * Emits transcript events that the persona engine subscribes to.
 */

import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import WebSocket from "ws";

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export class TranscriptionManager extends EventEmitter {
  private ytdlp: ChildProcess | null = null;
  private ffmpeg: ChildProcess | null = null;
  private dgSocket: WebSocket | null = null;
  private deepgramKey: string;
  private isRunning = false;

  // Rolling transcript buffer (last ~15 minutes)
  private transcriptBuffer: string[] = [];
  private readonly MAX_BUFFER_LINES = 200;

  // Accumulator for triggering personas
  private newTranscriptSinceLastTrigger = "";
  private lastTriggerTime = 0;
  private readonly TRIGGER_INTERVAL_MS = 90_000; // ~1.5 minutes

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
      // Step 1: Spawn yt-dlp to extract audio stream
      this.ytdlp = spawn("yt-dlp", [
        "-f",
        "bestaudio",
        "--no-warnings",
        "-o",
        "-", // output to stdout
        youtubeUrl,
      ]);

      // Step 2: Pipe through FFmpeg to convert to Deepgram-friendly format
      this.ffmpeg = spawn("ffmpeg", [
        "-i",
        "pipe:0", // read from stdin
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "wav",
        "pipe:1", // output to stdout
      ]);

      // Connect yt-dlp stdout → ffmpeg stdin
      this.ytdlp.stdout?.pipe(this.ffmpeg.stdin!);

      // Handle yt-dlp errors
      this.ytdlp.stderr?.on("data", (data) => {
        const msg = data.toString();
        // yt-dlp writes progress to stderr, only emit actual errors
        if (msg.includes("ERROR")) {
          this.emit("error", new Error(`yt-dlp: ${msg}`));
        }
      });

      // Step 3: Connect FFmpeg output → Deepgram WebSocket
      await this.connectDeepgram();

      // Pipe FFmpeg audio to Deepgram
      this.ffmpeg.stdout?.on("data", (chunk: Buffer) => {
        if (
          this.dgSocket &&
          this.dgSocket.readyState === WebSocket.OPEN
        ) {
          this.dgSocket.send(chunk);
        }
      });

      // Handle FFmpeg errors
      this.ffmpeg.stderr?.on("data", (data) => {
        const msg = data.toString();
        if (msg.includes("Error") || msg.includes("Invalid")) {
          this.emit("error", new Error(`ffmpeg: ${msg}`));
        }
      });

      // Handle process exits
      this.ytdlp.on("close", (code) => {
        if (code !== 0 && this.isRunning) {
          this.emit("error", new Error(`yt-dlp exited with code ${code}`));
        }
      });

      this.ffmpeg.on("close", (code) => {
        if (code !== 0 && this.isRunning) {
          this.emit("error", new Error(`ffmpeg exited with code ${code}`));
        }
      });

      this.emit("started");
    } catch (err) {
      this.stop();
      throw err;
    }
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

      this.dgSocket = new WebSocket(url.toString(), {
        headers: {
          Authorization: `Token ${this.deepgramKey}`,
        },
      });

      this.dgSocket.on("open", () => {
        this.emit("deepgram_connected");
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
        this.emit("error", new Error(`Deepgram WebSocket error: ${err.message}`));
        reject(err);
      });

      this.dgSocket.on("close", () => {
        if (this.isRunning) {
          this.emit("deepgram_disconnected");
          // Auto-reconnect after 2 seconds
          setTimeout(() => {
            if (this.isRunning) {
              this.connectDeepgram().catch((err) =>
                this.emit("error", err)
              );
            }
          }, 2000);
        }
      });
    });
  }

  stop(): void {
    this.isRunning = false;

    if (this.dgSocket) {
      try {
        // Send close message to Deepgram
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
