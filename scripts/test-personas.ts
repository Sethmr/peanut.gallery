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
 *   - XAI_API_KEY in .env.local (required — powers Troll/Jason + soundfx slot)
 *   - ANTHROPIC_API_KEY in .env.local (required — powers Producer + Joker slots)
 *   - BRAVE_SEARCH_API_KEY in .env.local (optional — needed only if you set
 *     SEARCH_ENGINE=brave; with SEARCH_ENGINE=xai the Producer uses Grok
 *     Live Search and you don't need a Brave key)
 *   - SEARCH_ENGINE=brave|xai (optional; defaults to brave to match the
 *     engine's pre-v1.4 behavior)
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

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const braveKey = process.env.BRAVE_SEARCH_API_KEY;
const xaiKey = process.env.XAI_API_KEY;
const rawEngine = (process.env.SEARCH_ENGINE || "").toLowerCase();
const searchEngine: "brave" | "xai" = rawEngine === "xai" ? "xai" : "brave";

if (!anthropicKey && !xaiKey) {
  console.error("Missing ANTHROPIC_API_KEY and XAI_API_KEY — need at least one.");
  process.exit(1);
}

console.log("🥜 Peanut Gallery — Persona Test");
console.log("─".repeat(60));
console.log(`📝 Transcript: ${transcript.trim().slice(0, 100)}...`);
console.log(
  `🔑 Anthropic: ${anthropicKey ? "✅" : "⏭️  (producer/joker will fallback)"}  xAI: ${xaiKey ? "✅" : "⏭️  (troll/soundfx will fallback)"}  Brave: ${braveKey ? "✅" : "⏭️  (no Brave fact-checking)"}  Search: ${searchEngine}`
);
console.log("─".repeat(60));

const engine = new PersonaEngine({
  anthropicKey: anthropicKey || "",
  braveSearchKey: braveKey || "",
  xaiKey: xaiKey || "",
  searchEngine,
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

// ─── SEMANTIC ANTI-REPETITION SHADOW TEST ────────────────────────────────────
//
// Usage:
//   ENABLE_SEMANTIC_ANTI_REPEAT=true OPENAI_API_KEY=sk-... \
//     npx tsx scripts/test-personas.ts --semantic-test
//
// Fires the Troll persona 4× against the same transcript. With a well-tuned
// threshold (τ=0.82), consecutive nearly-identical takes should trigger
// persona_reroll_ok / persona_reroll_exhausted log lines in
// logs/pipeline-debug.jsonl. This shadow run validates the telemetry fires
// without needing a live session.
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--semantic-test")) {
  (async () => {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error("❌ --semantic-test requires OPENAI_API_KEY");
      process.exit(1);
    }
    if (process.env.ENABLE_SEMANTIC_ANTI_REPEAT !== "true") {
      console.warn(
        "⚠️  ENABLE_SEMANTIC_ANTI_REPEAT is not set to true — semantic check will be skipped.\n" +
          "   Set it to observe reroll telemetry: ENABLE_SEMANTIC_ANTI_REPEAT=true"
      );
    }

    console.log("\n🔬 Semantic anti-repetition shadow test");
    console.log("─".repeat(60));
    console.log("Firing Troll 4× against the same transcript.");
    console.log(
      "Watch logs/pipeline-debug.jsonl for persona_reroll_ok / persona_reroll_exhausted.\n"
    );

    const semanticEngine = new PersonaEngine({
      anthropicKey: anthropicKey || "",
      braveSearchKey: braveKey || "",
      xaiKey: xaiKey || "",
      searchEngine,
      openaiKey,
    });

    const REPEAT_TRANSCRIPT = `
Jason Calacanis: I'll say it again — AI wrappers are getting funded at insane valuations.
The Series A market is completely broken. Zero path to profitability, 50x revenue multiples.
It reminds me of 2021. This is absolute madness.
`.trim();

    for (let round = 1; round <= 4; round++) {
      console.log(`\nRound ${round}/4:`);
      let response = "";
      await semanticEngine.fireSingle("troll", REPEAT_TRANSCRIPT, (r) => {
        if (!r.done) response += r.text;
        if (r.done && response.trim()) {
          const trollPersona = personas.find((p) => p.id === "troll");
          console.log(`  ${trollPersona?.emoji ?? "🧌"} Troll: ${response.trim()}`);
        }
      });
    }

    console.log(
      "\n✅ Shadow run done. Check logs/pipeline-debug.jsonl for semantic telemetry.\n"
    );
  })().catch((err) => {
    console.error(`\n❌ Semantic test error: ${err.message}`);
    process.exit(1);
  });
}
