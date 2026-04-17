#!/usr/bin/env bash
# Files 5 v1.1 issues on github.com/Sethmr/peanut.gallery.
# Run from the repo root after `gh auth login` has been done.
# Safe to rerun — it will just create duplicates, so only run it once.

set -euo pipefail

REPO="Sethmr/peanut.gallery"

gh issue create --repo "$REPO" \
  --title "Swap ScriptProcessorNode → AudioWorkletNode in extension/offscreen.js" \
  --label "enhancement,tech-debt,extension" \
  --body "$(cat <<'EOF'
## Why
`extension/offscreen.js` currently uses `audioContext.createScriptProcessor(4096, 1, 1)` to grab PCM from the captured tab. `ScriptProcessorNode` is deprecated — Chrome still supports it, but the modern replacement is `AudioWorkletNode`, which runs on a dedicated audio-rendering thread and won't get dropped in a future Chrome release.

This was deliberately deferred pre-bounty because the current pipeline is known-good across Chrome versions and swapping it means wiring a new worklet file into `manifest.json` + moving the 48→16 kHz downsampling into a worklet processor — a prime spot to reintroduce a bug.

## What
- [ ] Add `extension/pcm-worklet.js` with a processor that downsamples 48 kHz → 16 kHz mono Int16 and posts 250 ms chunks via `port.postMessage`.
- [ ] Register the worklet in `offscreen.js` via `audioContext.audioWorklet.addModule(...)`.
- [ ] Replace `createScriptProcessor` + the connect chain with `new AudioWorkletNode(audioContext, 'pcm-worklet')`, keeping `source.connect(node); node.connect(audioContext.destination)` so the tab audio stays audible.
- [ ] Declare the worklet file under `web_accessible_resources` in `manifest.json`.
- [ ] Verify transcription accuracy hasn't regressed vs. the ScriptProcessor baseline on a 10 min TWiST clip.

## Links
- Chrome blog: https://developer.chrome.com/blog/audio-worklet
- Existing implementation: `extension/offscreen.js` (search for `createScriptProcessor`)
- Rationale for deferral: `docs/SESSION-NOTES-2026-04-16.md` §4
EOF
)"

gh issue create --repo "$REPO" \
  --title "Custom persona builder — let podcasters define their own cast" \
  --label "enhancement,product" \
  --body "$(cat <<'EOF'
## Why
The Howard Stern cast is hardcoded in `lib/personas.ts`. For the product to work outside the TWiST use case, users need to define their own panel — e.g. a crypto podcast wants a rug-pull watcher + a maxi + a regulator, not Baba Booey.

## What
- [ ] UI in the side panel (and the reference web app) for creating/editing a persona: name, emoji, color, model, system prompt, specialty patterns for the Director.
- [ ] Persist the custom cast in `chrome.storage.local` — it's already the BYOK surface, so it doesn't require server state.
- [ ] Add an "Import from JSON" / "Export to JSON" path so casts can be shared as gists.
- [ ] Ship 2–3 starter casts: TWiST (Stern staff), Crypto (bull/bear/regulator/degen), Generic (analyst/skeptic/enthusiast/comedian).
- [ ] Make sure the Director cascade still works when a user ships fewer than 4 personas.

## Out of scope (for v1.1)
- Sharing a marketplace of casts across users. That's v1.2.
EOF
)"

gh issue create --repo "$REPO" \
  --title "Auto-generated highlights reel + show notes from the transcript" \
  --label "enhancement,product" \
  --body "$(cat <<'EOF'
## Why
Every episode already produces a full transcript + 4 streams of persona reactions with timestamps. That's enough raw material to ship two high-value post-show artifacts for free:

1. **Show notes** — a structured markdown summary with guest names, claims made, fact-checker corrections, and the best one-liners.
2. **Highlights reel** — a list of timestamped clip ranges (start/end in seconds) where personas piled on, Baba Booey corrected a claim, or the Troll landed a dunk. Exportable as a CSV or an ffmpeg concat list.

## What
- [ ] New endpoint `app/api/postshow/route.ts` that takes a `sessionId` (or an uploaded transcript + persona log) and returns `{ notes: string, highlights: Array<{ start, end, label, personaId }> }`.
- [ ] Use Claude Haiku for the notes (structured JSON output), rule-based scoring for highlight selection (cascade depth, fact-check density, unique-persona count per 30-sec window).
- [ ] Side panel "Export" button at end-of-session → downloads `show-notes.md` and `highlights.csv`.
- [ ] README blurb + screenshot.

## Not blocking
- Actually cutting video clips. Producing the timestamps is enough for v1.1; ffmpeg-as-a-service is a later call.
EOF
)"

gh issue create --repo "$REPO" \
  --title "Voice mode — ElevenLabs TTS for persona reactions" \
  --label "enhancement,product" \
  --body "$(cat <<'EOF'
## Why
Reading reactions while watching a podcast is a context-switch. Speaking them (quietly, panned left or right) would let Peanut Gallery sit in the background of a listening session the way actual radio bits do. This is also the most-likely-to-go-viral UX change because the Howard Stern framing lives or dies by voices, not text.

## What
- [ ] Add an ElevenLabs API key field in the side panel settings (BYOK — same pattern as Deepgram/Groq/Anthropic).
- [ ] Map each persona to a voice ID (config in `lib/personas.ts`). Suggested: gravelly for the Troll, deadpan for Fred, nasal for Jackie, flustered for Baba Booey.
- [ ] Stream TTS audio as personas finish streaming tokens (queue so two personas never speak over each other).
- [ ] "Mute voice" toggle in the side panel, default off so the text experience stays the primary mode.
- [ ] Optional: pan personas L/R/C so they feel like they're sitting around a mic.

## Cost gate
- Document the per-episode cost bump (ElevenLabs is meaningfully more expensive than the rest of the stack combined). Make it explicit in the UI so users opt in with their eyes open.
EOF
)"

gh issue create --repo "$REPO" \
  --title "Persona memory across episodes — running jokes and callbacks" \
  --label "enhancement,polish" \
  --body "$(cat <<'EOF'
## Why
Right now each persona remembers its last ~3 messages within a single session (`buildPersonaContext` in `lib/personas.ts`). The Stern-show magic comes from the opposite: Baba Booey has been getting dunked on for the same thing for 30 years. Without cross-episode memory, the personas will always feel like strangers meeting each host for the first time.

## What
- [ ] Add an optional IndexedDB store in the side panel keyed by channel/host (e.g. `@twistartups`, `@lexfridman`). Persist: 5–10 most notable reactions per persona per channel, plus a small running-jokes string.
- [ ] At session start, hydrate each persona's context with its top 3 past callbacks for this channel.
- [ ] "Clear memory for this channel" button so users can reset.
- [ ] Opt-in only. Off by default to avoid a surprise privacy ask.

## Notes
- IndexedDB, not `chrome.storage.local` — storage is bigger and the shape is more queryable.
- Do NOT send this to the server. Keep it client-side so the privacy promise (`README.md` — "Nothing is logged, nothing is persisted") stays intact.
EOF
)"

echo
echo "All 5 issues filed. Check: https://github.com/$REPO/issues"
