#!/usr/bin/env tsx
/**
 * Standalone test: YouTube → yt-dlp → FFmpeg → Deepgram → Terminal
 *
 * Usage:
 *   npx tsx scripts/test-transcription.ts "https://youtube.com/watch?v=EPISODE_ID"
 *
 * Requires:
 *   - yt-dlp installed (brew install yt-dlp)
 *   - ffmpeg installed (brew install ffmpeg)
 *   - DEEPGRAM_API_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { TranscriptionManager } from "../lib/transcription";

const url = process.argv[2];

if (!url) {
  console.error("Usage: npx tsx scripts/test-transcription.ts <YOUTUBE_URL>");
  process.exit(1);
}

const key = process.env.DEEPGRAM_API_KEY;
if (!key) {
  console.error("Missing DEEPGRAM_API_KEY in .env.local");
  process.exit(1);
}

console.log("🥜 Peanut Gallery — Transcription Test");
console.log(`📺 URL: ${url}`);
console.log("─".repeat(60));

const transcriber = new TranscriptionManager(key);

transcriber.on("started", () => {
  console.log("✅ Pipeline started — yt-dlp → FFmpeg → Deepgram");
});

transcriber.on("deepgram_connected", () => {
  console.log("✅ Deepgram WebSocket connected");
  console.log("🎙  Listening for transcript...\n");
});

transcriber.on("transcript", (event) => {
  if (event.isFinal) {
    console.log(`[FINAL] ${event.text}`);
  } else {
    process.stdout.write(`\r[interim] ${event.text}                    `);
  }
});

transcriber.on("error", (err) => {
  console.error(`\n❌ Error: ${err.message}`);
});

transcriber.on("stopped", () => {
  console.log("\n⏹  Transcription stopped");
  process.exit(0);
});

// Handle Ctrl+C
process.on("SIGINT", () => {
  console.log("\n\n🛑 Stopping...");
  transcriber.stop();
});

// Start
transcriber.start(url).catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
