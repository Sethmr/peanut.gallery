"use client";

import { useRef, useCallback } from "react";

/**
 * AudioCapture — captures tab audio via getDisplayMedia,
 * downsamples to 16kHz mono PCM (16-bit), and streams
 * chunks to the server via HTTP POST.
 *
 * This bypasses YouTube's bot detection entirely because
 * the audio comes from the user's browser, not a server.
 */

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_INTERVAL_MS = 250; // Send audio every 250ms

interface AudioCaptureHandle {
  start: () => Promise<void>;
  stop: () => void;
  suspend: () => void;
  resume: () => void;
}

export function useAudioCapture(
  sessionIdRef: React.RefObject<string | null>,
  apiKeys: { deepgram: string; anthropic: string; groq: string; brave: string },
  onError: (error: string) => void,
  onStatusDetail: (message: string) => void
): AudioCaptureHandle {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunkBufferRef = useRef<Float32Array[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const sendChunks = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || chunkBufferRef.current.length === 0) return;

    // Merge all buffered chunks into one
    const totalLength = chunkBufferRef.current.reduce((sum, c) => sum + c.length, 0);
    if (totalLength === 0) return;

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunkBufferRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    chunkBufferRef.current = [];

    // Downsample to 16kHz
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const sourceSampleRate = audioContext.sampleRate;
    const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
    const outputLength = Math.floor(merged.length / ratio);
    const downsampled = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      downsampled[i] = merged[srcIndex];
    }

    // Convert Float32 [-1, 1] to Int16 PCM
    const pcm = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
      const s = Math.max(-1, Math.min(1, downsampled[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Base64 encode
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Send to server
    try {
      await fetch("/api/transcribe", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Deepgram-Key": apiKeys.deepgram,
        },
        body: JSON.stringify({
          sessionId: sid,
          action: "audio_chunk",
          audio: base64,
        }),
      });
    } catch {
      // Silently ignore send failures — transient network blips
    }
  }, [sessionIdRef, apiKeys]);

  const start = useCallback(async () => {
    if (activeRef.current) return;

    try {
      onStatusDetail("Requesting tab audio access...");

      // Request tab audio capture via getDisplayMedia.
      // video:true is required by the spec — we discard the video track immediately.
      // preferCurrentTab auto-selects this tab so the user just clicks "Share".
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
        audio: true,
        video: true,
        selfBrowserSurface: "include",
        preferCurrentTab: true,
      });

      // Note: do NOT stop video tracks here. Stopping them kills the entire
      // getDisplayMedia session in Chrome, which also ends audio capture.
      // The video tracks consume negligible resources when not rendered.

      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        onError("No audio track. Enable Screen & System Audio Recording for your browser in System Settings → Privacy & Security.");
        return;
      }

      streamRef.current = mediaStream;
      activeRef.current = true;

      onStatusDetail("Tab audio captured — processing...");

      // Create AudioContext to process the audio
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStream);

      // ScriptProcessorNode to capture raw audio samples
      // Buffer size 4096 at 48kHz ≈ 85ms per callback — well within our 250ms send interval
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!activeRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy the samples (the buffer is reused by the browser)
        chunkBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Start sending chunks at regular intervals
      intervalRef.current = setInterval(sendChunks, CHUNK_INTERVAL_MS);

      onStatusDetail("Audio streaming to Deepgram...");

      // Handle track ending (user clicks "Stop sharing")
      audioTracks[0].onended = () => {
        onStatusDetail("Tab audio sharing stopped by user");
        stop();
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError("Audio permission denied. Enable Screen & System Audio Recording for your browser in System Settings → Privacy & Security, then try again.");
      } else {
        onError(`Audio capture failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      // Re-throw so callers know audio capture failed and can abort the pipeline
      throw err;
    }
  }, [onError, onStatusDetail, sendChunks]);

  const stop = useCallback(() => {
    activeRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Send any remaining buffered audio
    sendChunks();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [sendChunks]);

  const suspend = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "running") {
      audioContextRef.current.suspend().catch(() => {});
    }
  }, []);

  const resume = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  return { start, stop, suspend, resume };
}
