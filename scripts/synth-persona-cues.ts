/**
 * Peanut Gallery — persona cue synthesizer
 *
 * Generates 8 short (.3–.5s) WAV earcons — one per persona across the
 * Howard + TWiST packs — and writes them to
 * `extension/sounds/personas/<packId>-<personaId>.wav`.
 *
 * DESIGN CONSTRAINTS (per Seth's brief):
 * - Each cue captures the persona's essence in a SHORT earcon. These are
 *   UI sounds, not theatrical stingers — literature (Blattner earcons,
 *   Material sonification) converges on 150–500ms for "who is speaking"
 *   cues. 1s blocks cognition when personas fire every 30–60s.
 * - All cues share one final loudness ceiling: peak −14 dBFS (~0.2 linear)
 *   AND RMS-matched so no single persona pokes through. Video content sits
 *   well above that; the cue reads as a subliminal tag, not an interrupt.
 * - Deterministic synth (no sample licensing, reproducible builds, tiny
 *   footprint — each file is ~30–40 KB).
 *
 * Run: `npx tsx scripts/synth-persona-cues.ts`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SR = 44100;
const OUT_DIR = resolve(__dirname, "..", "extension", "sounds", "personas");

type Sample = number; // −1…1

// ──────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────

const silence = (secs: number): Sample[] =>
  new Array(Math.round(SR * secs)).fill(0);

function sine(freq: number, secs: number, env: (t: number) => number = () => 1): Sample[] {
  const n = Math.round(SR * secs);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * freq * t) * env(t);
  }
  return out;
}

function square(freq: number, secs: number, env: (t: number) => number = () => 1): Sample[] {
  const n = Math.round(SR * secs);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1) * env(t);
  }
  return out;
}

function triangle(freq: number, secs: number, env: (t: number) => number = () => 1): Sample[] {
  const n = Math.round(SR * secs);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const phase = (t * freq) % 1;
    const tri = 4 * Math.abs(phase - 0.5) - 1;
    out[i] = tri * env(t);
  }
  return out;
}

function noise(secs: number, env: (t: number) => number = () => 1): Sample[] {
  const n = Math.round(SR * secs);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.random() * 2 - 1) * env(t);
  }
  return out;
}

// One-pole low-pass. Quick + good enough for earcons.
function lowpass(samples: Sample[], cutoff: number): Sample[] {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const alpha = dt / (rc + dt);
  const out: Sample[] = new Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    out[i] = prev;
  }
  return out;
}

function highpass(samples: Sample[], cutoff: number): Sample[] {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const alpha = rc / (rc + dt);
  const out: Sample[] = new Array(samples.length);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < samples.length; i++) {
    const cur = alpha * (prevOut + samples[i] - prevIn);
    out[i] = cur;
    prevIn = samples[i];
    prevOut = cur;
  }
  return out;
}

// Envelopes
const decay = (tau: number) => (t: number) => Math.exp(-t / tau);
const adsr =
  (attack: number, release: number, total: number) =>
  (t: number) => {
    if (t < attack) return t / attack;
    if (t > total - release) return Math.max(0, (total - t) / release);
    return 1;
  };

// Mix same-length lists (sums, does NOT normalize).
function mix(...layers: Sample[][]): Sample[] {
  const n = Math.max(...layers.map((l) => l.length));
  const out: Sample[] = new Array(n).fill(0);
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) out[i] += layer[i];
  }
  return out;
}

function concat(...parts: Sample[][]): Sample[] {
  return ([] as Sample[]).concat(...parts);
}

function scale(samples: Sample[], g: number): Sample[] {
  return samples.map((s) => s * g);
}

// Peak-normalize to `target` (linear). Leaves silence alone.
function normalizePeak(samples: Sample[], target: number): Sample[] {
  let peak = 0;
  for (const s of samples) if (Math.abs(s) > peak) peak = Math.abs(s);
  if (peak === 0) return samples;
  return samples.map((s) => (s / peak) * target);
}

// RMS of a buffer.
function rms(samples: Sample[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

// ──────────────────────────────────────────────────────
// WAV writer — 16-bit PCM, mono
// ──────────────────────────────────────────────────────

function writeWav(path: string, samples: Sample[]) {
  const n = samples.length;
  const byteRate = SR * 2; // mono, 16-bit
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits/sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < n; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  writeFileSync(path, buf);
}

// ──────────────────────────────────────────────────────
// Persona cue designs
// Each returns ~.3–.5s of audio, peak ≈ 1.0 before final normalization.
// ──────────────────────────────────────────────────────

/**
 * MOLLY — fact-checker. Paper-tap + typewriter-ding. Precise, small,
 * journalistic. Two short transients then a bright bell overtone.
 */
function molly(): Sample[] {
  const tap = noise(0.04, decay(0.008));
  const tapped = highpass(tap, 2000);
  const ding = sine(2200, 0.22, decay(0.08));
  const overtone = sine(4400, 0.22, decay(0.05));
  const body = mix(scale(ding, 0.6), scale(overtone, 0.25));
  return concat(tapped, silence(0.015), body);
}

/**
 * JASON — podcast mic turn-on. Low pop filter thump + a touch of air.
 * Load-bearing host energy without being mean-loud.
 */
function jason(): Sample[] {
  const thump = sine(80, 0.18, decay(0.05));
  const thump2 = sine(160, 0.18, decay(0.04));
  const air = noise(0.35, adsr(0.01, 0.2, 0.35));
  const airFiltered = scale(lowpass(air, 900), 0.15);
  return mix(scale(thump, 0.9), scale(thump2, 0.35), airFiltered);
}

/**
 * LON 🥚 — dry cinematic record-scratch tick. Short, unhurried, sardonic.
 * Descending noise sweep with a tight click.
 */
function lon(): Sample[] {
  const click = noise(0.01, decay(0.003));
  const sweep = noise(0.18, decay(0.04));
  // FM-style pitch descent via variable-cutoff lowpass, poor-man's version
  // is a downward-sweeping sine scraping against noise.
  const scrape = sine(600, 0.18, decay(0.06));
  const scrapeDesc: Sample[] = [];
  const n = Math.round(SR * 0.18);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 900 - 700 * (t / 0.18); // 900→200 Hz descent
    const env = Math.exp(-t / 0.05);
    scrapeDesc.push(Math.sin(2 * Math.PI * f * t) * env);
  }
  return concat(click, mix(scale(sweep, 0.4), scrape, scale(scrapeDesc, 0.5)));
}

/**
 * ALEX 🥔 — data comedian. Mechanical calculator key-click → bright bell.
 * Numbers in, punchline out.
 */
function alex(): Sample[] {
  const click = noise(0.025, decay(0.004));
  const clickFilt = highpass(click, 1500);
  const bell = mix(
    sine(1568, 0.24, decay(0.09)), // G6
    scale(sine(2349, 0.24, decay(0.06)), 0.4), // D7
    scale(sine(3136, 0.24, decay(0.04)), 0.2) // G7
  );
  return concat(clickFilt, silence(0.02), bell);
}

/**
 * BABA BOOEY — bullseye dart thunk. Short, satisfying, hit-the-mark.
 */
function babaBooey(): Sample[] {
  const thunk = sine(140, 0.12, decay(0.035));
  const thunk2 = triangle(280, 0.12, decay(0.03));
  const click = noise(0.008, decay(0.002));
  return concat(click, mix(scale(thunk, 0.8), scale(thunk2, 0.4)));
}

/**
 * THE TROLL — flame flick. Short filtered noise burst, a touch of heat.
 */
function troll(): Sample[] {
  const whoosh = noise(0.3, adsr(0.005, 0.15, 0.3));
  const whooshFilt = lowpass(whoosh, 1800);
  const crackle = noise(0.3, (t) => (Math.random() < 0.02 ? 1 : 0) * Math.exp(-t / 0.1));
  const crackleFilt = highpass(crackle, 3000);
  return mix(scale(whooshFilt, 0.9), scale(crackleFilt, 0.3));
}

/**
 * FRED — cartoon slide whistle. Rising-then-falling arc, classic SFX.
 */
function fred(): Sample[] {
  const dur = 0.4;
  const n = Math.round(SR * dur);
  const out: Sample[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // 600 Hz up to 2400 Hz then back down.
    const norm = t / dur;
    const pitch =
      norm < 0.55
        ? 600 + (2400 - 600) * (norm / 0.55)
        : 2400 - (2400 - 800) * ((norm - 0.55) / 0.45);
    const env = adsr(0.01, 0.05, dur)(t);
    out[i] = Math.sin(2 * Math.PI * pitch * t) * env;
  }
  return out;
}

/**
 * JACKIE — shortened rimshot. Snare-like transient + low tom "dum".
 */
function jackie(): Sample[] {
  // ba-dum-tss compressed: two thuds + a tight cymbal-like noise burst.
  const dum1 = sine(200, 0.08, decay(0.025));
  const dum2 = sine(160, 0.08, decay(0.025));
  const cymbal = noise(0.18, decay(0.05));
  const cymbalFilt = highpass(cymbal, 4500);
  return concat(
    scale(dum1, 0.7),
    silence(0.02),
    scale(dum2, 0.7),
    silence(0.02),
    scale(cymbalFilt, 0.8)
  );
}

// ──────────────────────────────────────────────────────
// Render + normalize all cues to one shared loudness target
// ──────────────────────────────────────────────────────

// Earcon loudness target. First cut targeted −14 dBFS peak + matched every
// cue to the QUIETEST cue's RMS (~−29 dBFS) — Seth reported the result was
// inaudible over video content. Revised targets:
//   • RMS ≈ −18 dBFS (standard for UI earcons / OS notification sounds)
//   • Peak ≤ −6 dBFS (gives ~12 dB of headroom; prevents clipping and
//     keeps the cue perceptibly below speech content)
// Every cue is pushed UP to the RMS target, then peak-limited. Net effect:
// all eight cues feel equally loud, audible on top of YouTube at normal
// levels, but never overpower the speaker.
const RMS_TARGET = 0.126; // ≈ −18 dBFS
const PEAK_TARGET = 0.5; // ≈ −6 dBFS

const cues: Array<{ id: string; samples: Sample[] }> = [
  { id: "morning-crew-producer", samples: babaBooey() }, // The Producer (clipboard cue)
  { id: "morning-crew-troll", samples: troll() }, // The Heckler
  { id: "morning-crew-soundfx", samples: fred() }, // The Sound Guy
  { id: "morning-crew-joker", samples: jason() }, // The Joke Writer (plays the laugh cue)
  { id: "twist-producer", samples: molly() }, // Molly
  { id: "twist-troll", samples: jackie() }, // Jason (plays the wordplay cue)
  { id: "twist-soundfx", samples: lon() }, // Lon 🥚
  { id: "twist-joker", samples: alex() }, // Alex 🥔
];

// Two-pass normalize: push every cue UP to the shared RMS target, then
// peak-limit so no transient clips. Order matters — if we peak-capped
// first we'd lose the ability to boost quiet cues.
const normalized = cues.map(({ id, samples }) => {
  const currentRms = rms(samples);
  if (currentRms === 0) return { id, samples };
  const rmsGain = RMS_TARGET / currentRms;
  const boosted = scale(samples, rmsGain);
  const peak = Math.max(...boosted.map((s) => Math.abs(s)));
  const limited = peak > PEAK_TARGET ? scale(boosted, PEAK_TARGET / peak) : boosted;
  return { id, samples: limited };
});

mkdirSync(OUT_DIR, { recursive: true });
for (const { id, samples } of normalized) {
  const path = resolve(OUT_DIR, `${id}.wav`);
  writeWav(path, samples);
  const lenMs = Math.round((samples.length / SR) * 1000);
  const peakDb = 20 * Math.log10(Math.max(...samples.map((s) => Math.abs(s))));
  const rmsDb = 20 * Math.log10(rms(samples));
  console.log(
    `✓ ${id.padEnd(20)}  ${String(lenMs).padStart(4)}ms  peak=${peakDb.toFixed(1)}dB  rms=${rmsDb.toFixed(1)}dB`
  );
}

console.log(`\n${normalized.length} cues written to ${OUT_DIR}`);
