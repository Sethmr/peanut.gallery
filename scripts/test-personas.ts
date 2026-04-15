#!/usr/bin/env tsx
/**
 * Standalone test: Fire all 4 personas against a sample transcript
 *
 * Usage:
 *   npx tsx scripts/test-personas.ts
 *   npx tsx scripts/test-personas.ts "Jason just said that Uber was founded in 2007"
 *   npx tsx scripts/test-personas.ts --fixture   # Use real TWiST episode transcript
 *
 * Requires:
 *   - GROQ_API_KEY in .env.local (required)
 *   - ANTHROPIC_API_KEY in .env.local (optional — skips Claude personas if missing)
 *   - BRAVE_SEARCH_API_KEY in .env.local (optional — skips fact-checking if missing)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PersonaEngine } from "../lib/persona-engine";
import { personas } from "../lib/personas";

const SAMPLE_TRANSCRIPT = `
Jason: Look, I'm going to say something controversial here. The Series A market is completely broken right now. You've got companies raising at 50x revenue multiples with zero path to profitability. It reminds me of 2021 all over again.

Guest: I think you're being a bit dramatic, Jason. The market has actually corrected quite a bit from the highs.

Jason: No no no, listen. I just saw a pitch deck yesterday — AI wrapper, literally just a ChatGPT wrapper with a nice UI — and they're asking for 40 million dollars at a 200 million dollar valuation. Pre-revenue! This is insanity.

Guest: Well, to be fair, the AI market is different. The TAM is enormous.

Jason: TAM! Everyone loves talking about TAM. You know what the TAM was for Pets.com? It was also "enormous." You know what Uber's TAM was when they started? Travis said it was a 4 billion dollar market. Now it's a 100 billion dollar company. TAM means nothing in the early days.

Guest: But AI is genuinely transformational. This isn't like Web3 or crypto where —

Jason: I agree it's transformational! I'm not an AI bear. We just invested in three AI companies through LAUNCH Fund 4. But there's a difference between "AI is important" and "every AI wrapper deserves a hundred million dollar valuation." That's what I'm pushing back on.
`;

import { readFileSync } from "fs";
import { join } from "path";

let transcript: string;
if (process.argv[2] === "--fixture") {
  transcript = readFileSync(
    join(__dirname, "fixtures", "twist-episode-sample.txt"),
    "utf-8"
  ).slice(0, 3000); // Use first ~3000 chars of real episode
} else {
  transcript = process.argv[2] || SAMPLE_TRANSCRIPT;
}

const groqKey = process.env.GROQ_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const braveKey = process.env.BRAVE_SEARCH_API_KEY;

if (!groqKey) {
  console.error("Missing GROQ_API_KEY in .env.local");
  process.exit(1);
}

console.log("🥜 Peanut Gallery — Persona Test");
console.log("─".repeat(60));
console.log(`📝 Transcript: ${transcript.trim().slice(0, 100)}...`);
console.log(`🔑 Groq: ✅  Anthropic: ${anthropicKey ? "✅" : "⏭️  (skipping Claude personas)"}  Brave: ${braveKey ? "✅" : "⏭️  (no fact-checking)"}`);
console.log("─".repeat(60));

const engine = new PersonaEngine({
  anthropicKey: anthropicKey || "",
  groqKey: groqKey,
  braveSearchKey: braveKey || "",
});

// Track which personas are currently streaming
const activeStreams: Record<string, string> = {};

async function run() {
  console.log("\n🎬 Firing all personas...\n");

  await engine.fireAll(transcript, (response) => {
    if (response.done) {
      // Print final response
      const persona = personas.find((p) => p.id === response.personaId);
      const text = activeStreams[response.personaId] || "";
      if (text.trim()) {
        console.log(`\n${persona?.emoji || "❓"} ${persona?.name || response.personaId}`);
        console.log(`   ${text.trim()}`);
        console.log();
      }
      delete activeStreams[response.personaId];
    } else {
      // Accumulate streaming text
      if (!activeStreams[response.personaId]) {
        activeStreams[response.personaId] = "";
      }
      activeStreams[response.personaId] += response.text;
    }
  });

  console.log("─".repeat(60));
  console.log("✅ All personas done\n");
}

run().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
