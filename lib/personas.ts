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
  /**
   * Internal provider/model alias — maps to the real API model string inside
   * the engine. Not the raw vendor identifier, because the engine needs a
   * stable routing key (e.g. "claude-haiku" → "claude-haiku-4-5-20251001";
   * "xai-grok-4-fast" → "grok-4-1-fast-non-reasoning"). Adding a new provider
   * means adding an alias here AND a branch in `firePersona`.
   *
   * Groq was in this union pre-v1.4 (`groq-llama-70b`, `groq-llama-8b`) but
   * was removed when every persona moved to Claude Haiku or xAI Grok. If we
   * ever re-add it, revive the aliases here AND the branch in `firePersona`
   * AND the `groq-sdk` dep in package.json.
   */
  model: "claude-haiku" | "xai-grok-4-fast";
  systemPrompt: string;
  /**
   * One-sentence routing hint for the Smart Director v2 (v1.5+). Tells the
   * routing LLM what THIS pack's voice at THIS slot actually does — useful
   * for disambiguating same-slot personas across packs (e.g. Howard's
   * joker is a rapid-fire one-liner machine; TWiST's joker is a data
   * comedian). The routing LLM sees id + name + role + directorHint for
   * every persona in the active pack, every tick.
   *
   * Keep it terse — 1-2 sentences, ~15 tokens. The full systemPrompt is
   * NOT passed to the router; that's too expensive and not the point. The
   * hint is the compressed "when to pick this voice" heuristic.
   *
   * Optional: packs that predate v1.5 will still route correctly without
   * it (the router falls back to role alone). Add hints when a pack has
   * distinctively-voiced personas whose specialty doesn't land cleanly
   * from the role string alone.
   */
  directorHint?: string;
  /**
   * v1.7: Fact-check sensitivity mode. Only meaningful on the `producer`
   * slot; other slots ignore it. Declared per-pack so different producers
   * can have different personalities:
   *
   * - `"loose"` — Howard's Baba Booey default. Triggers on speculation,
   *   predictions, "everyone knows" claims, name-drops, and soft
   *   confidence cues. Character IS over-correction; wrong fact-checks
   *   are fine as long as the speaking animation always lands with
   *   content.
   * - `"strict"` — TWiST's Molly Wood default. Veteran journalist: only
   *   triggers on hard, sourceable claims (numbers, dates, attributions,
   *   corporate actions). Stays quiet on soft content.
   *
   * Defaults to `"strict"` when omitted — back-compat for pre-v1.7 packs
   * and non-producer personas (where the field has no effect).
   */
  factCheckMode?: "strict" | "loose";
  /**
   * v1.8 (persona-refinement push): producer sub-archetype. Only
   * meaningful when `id === "producer"`; other slots ignore it.
   *
   * - `"fact-checker"` (default when omitted) — classical tier-tagged
   *   correction framing. The producer outputs one of
   *   `[FACT CHECK] / [CONTEXT] / [HEADS UP] / [CALLBACK]` (or `-`) per
   *   fire, and `buildPersonaContext` injects the `EVIDENCE: GREEN /
   *   THIN / NONE` gate so the model calibrates tier against search
   *   evidence. This is the pre-v1.8 Molly + pre-v1.8 Baba lane.
   *
   * - `"heckler"` — Baba Booey v1.8 trolly-heckler kernel. No tier
   *   tags; the producer delivers 1-2 sentence exasperated heckles at
   *   transcript content. `buildPersonaContext` skips the evidence-
   *   gate injection (it would contradict the kernel) and reframes the
   *   search-results header as raw "background facts" the heckler can
   *   pull chart-positions / pop-culture corrections from.
   *
   * - `"journalist"` — Molly Wood v1.8 NPR-reporter kernel. Still
   *   fact-checks — but conversationally, with inline source anchors
   *   (*"Heatmap's reporting has them ducking Scope 3..."*) rather
   *   than tier-tagged output. `buildPersonaContext` skips the
   *   evidence gate (tier tags would contradict her kernel) and
   *   reframes the search-results header as "REPORTING ANCHORS" —
   *   raw reporting she can cite from inline. Differs from heckler
   *   only in prose framing; under-the-hood scaffolding (no gate,
   *   search still runs, safety net still catches "-") is identical.
   *
   * - `"layered-fact-checker"` — the 2026-04-23 fact-check-layer
   *   methodology (`docs/FACT-CHECK-LAYER.md`). Voice-agnostic
   *   scaffolding flag: preserves whatever voice contract lives in
   *   the persona's kernel while teaching the CONFIRMS / CONTRADICTS
   *   / COMPLICATES / THIN tier taxonomy inside the kernel itself.
   *   First applied to Baba (trolly-EP register); second to Molly
   *   (NPR-journalist register). `buildPersonaContext` uses the
   *   default `SEARCH RESULTS (use for fact-checking)` framing (same
   *   as `"fact-checker"`) but skips the legacy `EVIDENCE: GREEN /
   *   THIN / NONE` gate — the new four-tier taxonomy in the kernel
   *   supersedes the old `[FACT CHECK]` / `[HEADS UP]` tag system,
   *   and leaving the gate active would inject contradictory tag
   *   prescriptions. Apply by: setting this flag, appending the
   *   methodology doc's kernel patch to the persona's system prompt,
   *   and rewriting the canonical tier lines in the persona's voice.
   *
   * Orthogonal to `factCheckMode` (which gates the claim-detector's
   * sensitivity on the Director side). Both fields are producer-only;
   * other slots ignore both. Defaults-preserving: pre-v1.8 packs
   * without this field behave exactly as they did.
   *
   * The safety-net-on-"-"-pass (persona-engine.ts) + the producer
   * pre-animation (side panel) still apply to every producerMode
   * because those are UI-surface contracts, not voice contracts.
   */
  producerMode?:
    | "fact-checker"
    | "heckler"
    | "journalist"
    | "layered-fact-checker";
  /**
   * v1.8 (persona-refinement push): long-form character reference material
   * delivered to the model alongside the system prompt. Whereas
   * `systemPrompt` is the tight "prompt kernel" (rules, voice, triggers,
   * red lines), `personaReference` carries the retrieval context the
   * model pattern-matches against at fire time:
   *
   *   - example responses across common live-feed scenarios
   *   - voice & cadence detail (laugh mechanics, accent, verbal tics)
   *   - craft rules in the persona's own articulated terms
   *   - topic buckets (mental filing system for material retrieval)
   *   - relational dynamics with the ensemble
   *   - red lines and production fences
   *   - recovery & deflection library (verbatim lines)
   *   - interjection shape template
   *   - verbatim joke / line bank ready to deploy
   *   - identity anchors (biographical flavor)
   *
   * `buildPersonaContext` appends this block immediately after
   * `systemPrompt` so the model reads voice + material in one pass
   * before the live transcript. Optional: personas without a
   * deep-research file (the pre-v1.8 "ultra light baseline" prompts)
   * simply omit it and operate on the kernel alone — backward
   * compatible by construction.
   *
   * NOT sent to the Director routing call — too large for the 400 ms
   * budget, and `directorHint` is the correct compressed signal for
   * "when to pick this voice." Keep the two layers orthogonal.
   */
  personaReference?: string;
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
  isForceReact?: boolean,
  /**
   * When set, a previous response from this persona was flagged as too similar
   * to a recent fire (semantic anti-repeat, SET-15). The text is injected as a
   * "don't repeat this" instruction so the model finds a different angle. Set
   * only when ENABLE_SEMANTIC_ANTI_REPEAT=true and the prior embed check hit.
   * Cleared from the repeat slot on the next fire once the new draft passes.
   */
  lastRepeatText?: string,
  /**
   * Producer-only: the status of the fact-check search for this fire. Passed
   * in from PersonaEngine so the model can calibrate its correction tier
   * against evidence availability instead of guessing from the presence-or-
   * absence of a SEARCH RESULTS section alone.
   *
   * - `"with_results"` — search returned usable bullets; evidence path open.
   * - `"empty"` — we HAD a claim to check but the search returned nothing
   *   usable (upstream empty / rate-limited / timed out). Bias [HEADS UP]
   *   hard; [FACT CHECK] is not earned without evidence.
   * - `"skipped"` — no search was attempted (force-react path, no extracted
   *   claim, disabled engine). Producer should treat this as "speak from
   *   memory, hedge when uncertain."
   *
   * Mirrors the AVeriTeC 4-class verdict bias: with empty evidence the
   * safe answer is "not enough evidence," realized here as the [HEADS UP]
   * tier. Keeps the speaking-animation contract intact while preventing
   * confidently-wrong [FACT CHECK] tags when the search pipeline degrades.
   */
  searchStatus?: "with_results" | "empty" | "skipped"
): string {
  let context = "";

  // ── FORCE-REACT PREAMBLE (read BEFORE the character prompt) ──
  // When the viewer taps a specific avatar, we want the model to read the
  // suspension of pass/tag/format rules BEFORE it reads the character's own
  // tier gate. Otherwise (especially on Claude Haiku) the model internalizes
  // FORMAT rules like "every response starts with a [TAG] — if none apply,
  // output '-'" and obeys them even when the later override says not to.
  // Putting this first makes the tier rules get read in the context of
  // "these are suspended for this turn." Recency reminder also appears at
  // the end of the prompt.
  if (isForceReact) {
    context += `⚡⚡⚡ READ THIS FIRST — TAP-RESPONSE MODE ⚡⚡⚡\n`;
    context += `The viewer has explicitly tapped YOUR avatar. What follows is your character prompt, but for THIS one response the following are SUSPENDED:\n`;
    context += `  • Any rule about outputting "-" / staying silent / passing.\n`;
    context += `  • Any FORMAT rule requiring a specific [TAG] or prefix (e.g. [FACT CHECK]/[CONTEXT]/[HEADS UP]/[CALLBACK]).\n`;
    context += `  • Any "only speak when [tier X] fits" gate.\n`;
    context += `  • Any "prefer silence to a mid take" / "pass to someone funnier" directive.\n`;
    context += `Read the character prompt below WITH THAT IN MIND. You will produce 1–2 sentences in your voice. An imperfect in-character take beats silence. You do NOT need a tag, a perfect fact, or a perfect dunk — just sound like you.\n\n`;
    context += `═══════════════════════════════════════════\n\n`;
  }

  context += `${persona.systemPrompt}\n\n`;

  // ── PERSONA REFERENCE MATERIAL (v1.8 persona-refinement push) ──
  // Long-form retrieval context delivered once per fire so the model reads
  // voice + deployable material in a single pass before the live transcript.
  // Contents vary by persona but typically include: example responses, voice
  // detail, craft rules, topic buckets, relational dynamics, red lines,
  // recovery lines, joke/line bank, identity anchors. See the
  // `personas/<name>.md` author files for the canonical schema. Absent on
  // pre-refinement personas (Baba, Troll, Fred, and the four TWiST voices
  // at time of Jackie's landing); those still run on the kernel alone.
  // Printed between the system prompt and the live transcript so the model
  // treats it as durable character state — not as "what the show just said."
  if (persona.personaReference && persona.personaReference.trim().length > 0) {
    context += `--- CHARACTER REFERENCE (read once for voice, then pattern-match) ---\n`;
    context += `${persona.personaReference.trim()}\n\n`;
  }

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

  // ── PRODUCER SEARCH-RESULTS INJECTION (three framings) ──
  // All three flavors of producer (fact-checker, heckler, journalist)
  // can benefit from fresh web bullets — pre-v1.8 Molly for tier-tagged
  // corrections, Gary-heckler for chart-position / pop-culture facts to
  // heckle with, v1.8 Molly-journalist for named-outlet reporting to
  // cite inline. The framing differs per mode: the fact-checker header
  // cues tier-tagged output; the heckler header frames the bullets as
  // raw material, not tier input; the journalist header frames them as
  // reporting anchors she can cite from conversationally.
  if (searchResults && persona.id === "producer") {
    if (persona.producerMode === "heckler") {
      context += `--- BACKGROUND FACTS (use as heckle fuel if something jumps out) ---\n${searchResults}\n\n`;
      context += `You don't have to use any of these — heckle the transcript first, and only pull a background fact if it sharpens a pop-culture / sports / chart-position correction. Don't tier-tag; stay in your 1-2 sentence heckle register.\n\n`;
    } else if (persona.producerMode === "journalist") {
      context += `--- REPORTING ANCHORS (cite inline if one fits your reaction) ---\n${searchResults}\n\n`;
      context += `These are reporting / studies / citations you can weave mid-sentence ("Heatmap's reporting has them ducking Scope 3…" / "the GridLab study showed…"). Don't tier-tag and don't preface with "according to my search results" — just name the outlet or analyst inline, the way a veteran reporter would. If nothing here fits, lean on what your character would plausibly already know; if you've already cited the same anchor recently, rotate to a different one or pass with "-".\n\n`;
    } else {
      context += `--- SEARCH RESULTS (use for fact-checking) ---\n${searchResults}\n\n`;
      context += `If you already fact-checked this claim in your recent lines, either add a NEW angle or pass with "-".\n\n`;
    }
  }

  // ── EVIDENCE-AVAILABILITY GATE (fact-checker producer only) ──
  // Explicit signal — more reliable than letting the model infer evidence
  // state from the presence / absence of the SEARCH RESULTS block. The
  // AVeriTeC evaluation family shows overconfident verdicts are the primary
  // failure mode when evidence is thin; the fix is to bias the tier
  // selection toward abstention-style tiers ([HEADS UP]) instead of
  // attempting a [FACT CHECK] from memory alone. Force-react path suspends
  // this (tap must always speak in voice); everyone else reads it.
  //
  // v1.8: heckler-mode AND journalist-mode producers skip this entirely.
  // Neither kernel uses the [FACT CHECK] / [HEADS UP] tier tags — the
  // heckler outputs exasperated reactions, the journalist cites inline
  // reporting conversationally — so an EVIDENCE block would contradict
  // the kernel and confuse the model. The reframed search headers above
  // carry sufficient evidence signal for both modes.
  if (
    persona.id === "producer" &&
    !isForceReact &&
    persona.producerMode !== "heckler" &&
    persona.producerMode !== "journalist" &&
    persona.producerMode !== "layered-fact-checker"
  ) {
    if (searchStatus === "with_results") {
      context += `--- EVIDENCE: GREEN ---\nSearch returned usable results. [FACT CHECK] is earned IF a specific number/date/name in the search contradicts the claim. If the search confirms the claim, [CONTEXT] adds the angle they missed. If the search is adjacent but doesn't settle the claim, use [HEADS UP]. Anchor every number or date to the search — no memory-only corrections on this fire.\n\n`;
    } else if (searchStatus === "empty") {
      context += `--- EVIDENCE: THIN ---\nA claim was extracted but search returned nothing usable (empty or upstream degraded). DO NOT emit [FACT CHECK] — there's nothing to anchor it to. Use [HEADS UP] with a specific "I'd want to verify…" hedge aimed at whatever entity/number/date lives in the tail. Your character's whole value prop in this tier is "calibrated uncertainty," not confident correction. "I'd double-check that" beats "actually it's 2019" on a claim you can't source.\n\n`;
    } else if (searchStatus === "skipped") {
      context += `--- EVIDENCE: NONE (memory only) ---\nNo search was run this tick. Speak from what your character would plausibly know — but tag it accurately. If you're genuinely sure (founding year of Google, public CEO name), [FACT CHECK] is okay; if you're fuzzy, [HEADS UP] is the right tier. Never invent specific numbers, dates, or funding rounds; hedge instead.\n\n`;
    }
  }

  // ── ACROSS-TURN ANTI-REPEAT INJECTION (SET-15) ──
  // When the previous response was flagged as too similar to a recent fire,
  // we inject a hard "don't repeat this" instruction here. The model sees the
  // exact text it already said and is told to find a different angle. The slot
  // is cleared in persona-engine.ts once this draft passes the similarity check.
  if (lastRepeatText) {
    context += `--- AVOID REPEATING THIS (you said it just now) ---\n`;
    context += `Do NOT repeat or paraphrase: "${lastRepeatText.slice(0, 300)}"\n`;
    context += `You said something very close to this in a recent turn. Find a completely different angle, a new specific detail, a different emotional register, or a new subject within the transcript to react to. If you have nothing new, output a single "-" to pass.\n\n`;
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
    context += `--- ⚡ REMINDER: TAP-RESPONSE MODE (see preamble at top) ⚡ ---\n`;
    context += `Pass / "-" / tag-format rules are SUSPENDED for this turn. You MUST produce 1–2 sentences of in-voice content. Do NOT output "-". Do NOT output nothing. Do NOT add meta commentary like "I'll pass" or "Note: I'm using X to indicate…".\n\n`;
    context += `Pick whatever feels natural — no priority order:\n`;
    context += `  • A vibe read on the moment (host's energy, dead air, tone shift).\n`;
    context += `  • A light riff off the transcript or a co-host's last line.\n`;
    context += `  • An in-voice aside on the topic — minor / weak is totally fine.\n`;
    context += `  • Whatever your character would say if someone turned to you and asked "thoughts?"\n\n`;
    context += `An imperfect in-character take BEATS silence. Now react. Your voice, your tics, 1–2 sentences max. Go.`;
  } else {
    context += `Now react. Stay in character. MAX 1-2 sentences. React mostly to the transcript above — that's where the show is right now. Riffing on another persona is fine when it's natural, as long as you're not re-quoting the same specifics from earlier turns. If you'd just be repeating a recent sidebar line word-for-word, output a single "-" and pass.`;
  }

  return context;
}
