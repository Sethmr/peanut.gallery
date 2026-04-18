/**
 * Peanut Gallery — Shared persona types + context builder
 *
 * Before v1.3.0 this file owned BOTH the 4 persona system prompts AND the
 * pack-agnostic `buildPersonaContext` helper. In v1.3.0 the system-prompt
 * content moved into `lib/packs/howard/personas.ts` so we can ship multiple
 * packs (Howard, TWiST, future lineups) without forking the Director or UI.
 *
 * This file now owns:
 *   - The pack-agnostic `Persona` interface (every pack conforms to it)
 *   - `ConversationEntry` + `OtherPersonaResponse` — wire-shape types used by
 *     the PersonaEngine when it builds the cross-persona self-check log
 *   - `buildPersonaContext` — the context assembler that turns a (persona,
 *     transcript, history) tuple into the actual LLM prompt
 *
 * And re-exports `howardPersonas` as the bare `personas` array, so legacy
 * call sites (`import { personas } from "@/lib/personas"`) keep working
 * exactly like they did in v1.2.x. New call sites should prefer
 * `resolvePack(packId).personas` via `lib/packs`.
 */

export interface Persona {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  model: "groq-llama-70b" | "groq-llama-8b" | "claude-haiku";
  systemPrompt: string;
}

export interface OtherPersonaResponse {
  name: string;
  emoji: string;
  text: string;
}

/** A single entry in the shared conversation log — who said what, in order. */
export interface ConversationEntry {
  personaName: string; // "Baba Booey", "The Troll", etc. — or "" for transcript
  personaEmoji: string; // emoji or "" for transcript
  text: string;
  /** Seconds ago, roughly. Purely for the model's sense of time. */
  secondsAgo?: number;
}

/**
 * Back-compat shim: `personas` is the Howard pack's persona array. Existing
 * imports of `{ personas }` from this module continue to resolve to the same
 * 4-persona array they did in v1.2.x, so v1.3's pack refactor stays invisible
 * to any call site that doesn't care about pack selection.
 *
 * New code should prefer `resolvePack(packId).personas` from `lib/packs`.
 */
export { howardPersonas as personas } from "./packs/howard/personas";

export function buildPersonaContext(
  persona: Persona,
  transcript: string,
  previousResponses: string[] = [],
  searchResults?: string,
  otherPersonas?: OtherPersonaResponse[],
  isSilence?: boolean,
  /**
   * Full interleaved conversation log (most recent last) — shows the flow of
   * what the video said + what every persona has said, in chronological order.
   * This is the primary anti-repetition tool: the model sees the live
   * transcript and every persona's recent lines, so it can build on the
   * discussion instead of restating what's already been said.
   */
  conversationLog?: ConversationEntry[],
  /**
   * True when the user hit the React button manually. Personas should NOT pass
   * with "-" in this case — the user explicitly asked for a reaction, so we
   * force a meaningful in-character response even if the transcript is quiet.
   */
  isForceReact?: boolean
): string {
  let context = `${persona.systemPrompt}\n\n`;

  // ── PRIMARY SIGNAL: THE LIVE TRANSCRIPT ──
  // The transcript is the main thing the persona is reacting to. Put it first
  // and most prominent so the model anchors here, not to stale sidebar chatter.
  context += `--- LIVE TRANSCRIPT (what the video is saying right now) ---\n${transcript}\n\n`;

  // ── ONE SHORT RULE ABOUT RE-QUOTING SPECIFICS ──
  // This is the fix for personas that re-quoted "$2.4 million house" across 8
  // straight turns. Kept deliberately short so it doesn't dominate the prompt
  // or override a persona's voice — some chats land fine riffing on each other.
  context += `--- DON'T RE-QUOTE SPECIFICS ---\n`;
  context += `Once a subject has been named in the sidebar (e.g. "$2.4M house", "Series B round"), refer to it briefly — "the house", "that round". Don't re-quote the full literal across multiple turns. That's the main thing to avoid.\n`;
  context += `Your character tics and verbal fingerprints (Baba's "Technically…", Jackie's hyena laugh, Fred's [sound cues], etc.) are CHARACTER, not repetition — keep them.\n\n`;

  // ── THIN SELF-CHECK LOG ──
  // Show only the persona's own last 2 lines + the other personas' single
  // most recent line each. That's enough to avoid literal duplication without
  // anchoring the model to old chatter.
  const myRecentLines: string[] = [];
  const otherRecentSummary: Array<{ emoji: string; name: string; text: string }> = [];
  if (conversationLog && conversationLog.length > 0) {
    // Walk backwards, collect my last ~2 lines
    for (let i = conversationLog.length - 1; i >= 0 && myRecentLines.length < 2; i--) {
      const entry = conversationLog[i];
      if (entry.personaName === persona.name) myRecentLines.push(entry.text);
    }
  }
  if (otherPersonas && otherPersonas.length > 0) {
    for (const op of otherPersonas) {
      otherRecentSummary.push({ emoji: op.emoji, name: op.name, text: op.text });
    }
  } else if (previousResponses.length > 0 && myRecentLines.length === 0) {
    // Legacy fallback: no conversationLog provided, surface per-persona history
    myRecentLines.push(...previousResponses.slice(-2).reverse());
  }

  if (myRecentLines.length > 0 || otherRecentSummary.length > 0) {
    context += `--- RECENT SIDEBAR LINES (so you don't repeat word-for-word) ---\n`;
    if (myRecentLines.length > 0) {
      context += `YOU just said:\n`;
      // Oldest-first for readability
      myRecentLines
        .slice()
        .reverse()
        .forEach((line, i) => {
          context += `  ${i + 1}. ${line}\n`;
        });
    }
    if (otherRecentSummary.length > 0) {
      context += `Others' most recent line (one each):\n`;
      otherRecentSummary.forEach((op) => {
        context += `  ${op.emoji} ${op.name}: ${op.text}\n`;
      });
    }
    context += `If what you're about to say is a near-duplicate of any of the above, pick a different angle or output a single "-" to pass.\n\n`;
  }

  if (searchResults && persona.id === "producer") {
    context += `--- SEARCH RESULTS (use for fact-checking) ---\n${searchResults}\n\n`;
    context += `If you already fact-checked this claim in your recent lines, either add a NEW angle or pass with "-".\n\n`;
  }

  // Silence behavior: the transcript has gone quiet — dead air, an ad break,
  // the speaker lost their thread. Personas react to the quiet, NOT to any
  // viewer action. The viewer didn't pause; the show itself just went still.
  if (isSilence) {
    context += `--- IT JUST GOT QUIET ON THE SHOW ---\n`;
    context += `No one's said anything for a bit. This is dead air / crickets / awkward silence on the show itself — it is NOT because the viewer did anything. React to the quiet, IN CHARACTER:\n`;
    context += `- Baba Booey: fills dead air with a loose fact or "while we've got a second, I wanted to mention…"\n`;
    context += `- The Troll: "Crickets. Gorgeous." or "Did we lose the signal or did the take just die on air?"\n`;
    context += `- Fred: [crickets] or [elevator music] or a dry "...uh."\n`;
    context += `- Jackie: "Nobody's laughing because I haven't gone yet." — a joke about the quiet.\n\n`;
    context += `HARD RULE — language to use and avoid:\n`;
    context += `- USE: "crickets", "dead air", "the silence", "how quiet it got", "nobody's talking"\n`;
    context += `- DO NOT USE: "pause", "paused", "pausing", "on hold", "hit pause" — the viewer did not pause anything.\n\n`;
    context += `React to the silence. Stay in character. One sentence max.`;
  } else if (isForceReact) {
    context += `--- ⚡ USER JUST HIT THE REACT BUTTON ⚡ ---\n`;
    context += `The viewer explicitly asked for a reaction right now. This means:\n`;
    context += `- DO NOT output "-" to pass. You MUST respond in character.\n`;
    context += `- If the transcript is thin, react to the vibe, a recent specific, or riff off a co-host's last line — whatever's true to your character.\n`;
    context += `- Stay in voice. MAX 1-2 sentences. Punchy, not rambly.\n`;
    context += `- No meta-commentary about being asked to react. Just react.\n\n`;
    context += `Now react. Stay in character. MAX 1-2 sentences. React to the transcript, a co-host, or the moment — whatever lands.`;
  } else {
    context += `Now react. Stay in character. MAX 1-2 sentences. React mostly to the transcript above — that's where the show is right now. Riffing on another persona is fine when it's natural, as long as you're not re-quoting the same specifics from earlier turns. If you'd just be repeating a recent sidebar line word-for-word, output a single "-" and pass.`;
  }

  return context;
}
