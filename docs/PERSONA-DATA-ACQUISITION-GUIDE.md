# Persona Data Acquisition Guide

**Companion to [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md).** That doc is the *strategy*; this one is the *copy-paste operator guide* for Phase 1 — grabbing ~75 hours of in-voice transcripts across both packs for under $20 (ceiling: $50). All sources are public. Once you have the data, Claude does the voice-pattern extraction and prompt rewrite loops for free on your subscription.

**Budget target:** ≤ $20 preferred, ≤ $50 ceiling.
**Time target:** ~2 hours of your active time (rest is download + transcription running in the background).
**Output target:** ~75 hours of labeled transcripts, organized per-persona.

---

## What you're collecting and why

For each of the 8 personas, we need enough in-voice content to pattern-match verbal fingerprints, catchphrases, sentence shape, topic handling, and how they pass when they have nothing to say. The stronger the ground truth, the better Claude can rewrite the `systemPrompt` blocks to land the voice.

| Pack | Persona | What to grab | Why |
|---|---|---|---|
| Howard | Baba Booey (Gary Dell'Abate) | His own podcast ("Baba Booey's Book Report"), public interview appearances, clips from official Stern YouTube channel | Need solo content to separate his voice from Howard's banter |
| Howard | The Troll (composite) | Artie Lange's "Halfway House" podcast, Artie on Joe Rogan / Jim Norton / Colin Quinn, Stern-caller compilations | This slot is a composite — Artie + great callers are the strongest data |
| Howard | Fred Norris | Rare — "Fred Norris classic" compilations on YouTube, any podcast appearance he's done, Howard's interviews with Fred | Fred speaks little; we need every public line we can get |
| Howard | Jackie Martling | "The Jackie Martling Joke Hunt" podcast (still running), stand-up album clips on YouTube, "Stump the Comedian" compilations | Jackie has been publicly active for 30 years — tons of solo content |
| TWiST | Molly Wood | NPR Marketplace Tech archive (free transcripts), her "Molly Wood Reports" newsletter, TWiST episodes | Marketplace archive is pre-transcribed gold; skip paying for it |
| TWiST | Jason Calacanis | TWiST main channel, All-In Podcast (he's a co-host), his book "ANGEL" as a voice reference | All YouTube; pick 20 recent episodes of each |
| TWiST | Lon Harris | TWiST episodes (he's there most weeks), his Substack writing | Paste Substack posts as a writing-voice reference alongside the audio |
| TWiST | Alex Wilhelm | TWiST + Fortune Term Sheet archive + Mostly Metrics podcast appearances | Alex has a distinct data-comedy voice; isolated solo content is best |

---

## One-time setup — install the tools (free)

```bash
# 1. yt-dlp — downloads audio + auto-captions from YouTube
#    Homebrew (macOS):
brew install yt-dlp ffmpeg

# 2. (Optional) whisper.cpp for local high-quality transcription fallback.
#    Only needed if auto-captions on a clip are garbage.
brew install whisper-cpp

# 3. Python + OpenAI whisper (alternative to whisper.cpp; same purpose)
#    Skip if you installed whisper.cpp above.
# pip install openai-whisper

# 4. jq (for parsing captions JSON)
brew install jq
```

Verify:

```bash
yt-dlp --version   # should print 2024.x.x or newer
ffmpeg -version    # should print ffmpeg 6+
```

---

## Folder layout (create once)

```bash
cd /Users/seth/Projects/Seth/peanut.gallery/chrome-extension
mkdir -p docs/persona-research/transcripts/{howard,twist}/{producer,troll,soundfx,joker}
mkdir -p docs/persona-research/raw-audio   # .m4a cache; delete after transcribing
touch docs/persona-research/INDEX.md       # you'll append one line per source as you collect
```

Each transcript file is named `<source-slug>_<YYYY-MM-DD>.txt`. Example: `baba-booey-book-report_2025-11-12.txt`.

---

## The three-tier transcription strategy

This is the trick that keeps you under $20:

| Tier | Source | Cost | When to use |
|---|---|---|---|
| **1. yt-dlp auto-captions** | YouTube's built-in auto-captions (`.vtt` file) | **$0** | First pass for every YouTube source. Captions are ~90% accurate for studio audio. Skip diarization; speaker-labeling comes later from context. |
| **2. Local whisper** | whisper.cpp or `whisper` CLI on downloaded audio | **$0** (CPU/GPU time) | When auto-captions on a clip are garbage (noisy audio, heavy accents, music beds). |
| **3. OpenAI Whisper API** | `https://api.openai.com/v1/audio/transcriptions` | $0.006/min | Last resort for critical clips where local whisper isn't accurate enough. Budget ~$10 of API credit = 27 hours of fallback transcription. |

Deepgram Nova-3 is also an option (~$0.004/min via PG's existing backend) and has diarization built in — good if you have TWiST episodes where you want automatic speaker splitting. But you don't need it for the bulk: Claude can speaker-split from raw text by verbal fingerprint, since you're only tagging one speaker at a time anyway.

---

## The three-tier speaker-separation strategy

YouTube auto-captions don't tell you who's speaking. Here's how to handle that without paying for diarization:

1. **Solo sources first** — prioritize content where one of the 8 personas is the only speaker. Marketplace Tech (Molly only), "The Jackie Martling Joke Hunt" (Jackie + one guest), "Baba Booey's Book Report" (Baba + one guest), Jason's solo monologues on TWiST. Goal: 5+ hours of solo per persona. That's enough for voice-pattern extraction.
2. **Duo interviews** — one persona + one non-persona interviewer. Easy: the persona is almost every other paragraph. Claude can split these from context in seconds.
3. **Group shows** (TWiST with all 4, All-In with all 4) — these are the multi-speaker hard case. Either:
   - Skip them for phase 1 (plenty of solo content exists)
   - Or use Deepgram's diarization through the existing PG pipeline (budget ~$5 for 20 hours of group content)

Per-persona target: **5–10 hours of clearly-attributable speech** is plenty. Quality beats volume.

---

## Bulk download recipe — TWiST (free, ~40 hours of content)

TWiST uploads most episodes to YouTube. Auto-captions are excellent because studio audio.

### Grab the last 50 episode IDs into a list

```bash
# TWiST main channel uploads playlist
YT_CHANNEL_URL="https://www.youtube.com/@ThisWeekInStartups/videos"

# List the last 50 uploads (IDs + titles)
yt-dlp \
  --flat-playlist \
  --print "%(id)s %(title)s" \
  --playlist-end 50 \
  "$YT_CHANNEL_URL" > /tmp/twist-episodes.txt

head /tmp/twist-episodes.txt
# Expect: "xFJceTJrbWo Why Your Company Should Own Its AI Model | E2278" ...
```

### Download auto-captions only (no audio = fast, free, small)

```bash
cd docs/persona-research/transcripts/twist

# One command, all 50 episodes, English auto-captions only.
yt-dlp \
  --skip-download \
  --write-auto-subs \
  --sub-langs en \
  --sub-format vtt \
  --playlist-end 50 \
  -o "%(id)s_%(title)s.%(ext)s" \
  "$YT_CHANNEL_URL"
```

Output: 50 `.en.vtt` files in the current folder. Each file is 50–200 KB of timestamped captions. Total disk: ~10 MB.

### Convert .vtt → .txt (strip timestamps for voice analysis)

```bash
# Simple sed one-liner: keep caption text, drop timestamps + WEBVTT header
for f in *.en.vtt; do
  grep -vE '^\s*$|^WEBVTT|^[0-9:.\->]+ -->|^NOTE|^Kind:|^Language:' "$f" \
    | sed 's/<[^>]*>//g' \
    > "${f%.en.vtt}.txt"
done

# Move raw .vtt out of the way; keep .txt files organized
mkdir -p _vtt && mv *.en.vtt _vtt/
ls *.txt | head -5
```

### Log each source in INDEX.md as you go

```bash
# Template for each source (run once per source):
{
  echo "- **TWiST E2278** — https://youtube.com/watch?v=xFJceTJrbWo — 2026-02-14 — 4 speakers — auto-captions tier-1"
} >> /Users/seth/Projects/Seth/peanut.gallery/chrome-extension/docs/persona-research/INDEX.md
```

---

## Targeted download recipe — solo persona sources

For each persona, grab 3–5 solo pieces. Examples below — swap URLs for whatever YouTube surfaces today.

### Molly Wood — NPR Marketplace Tech (free, already transcribed)

Marketplace publishes transcripts on their site. No download needed:

```bash
# Visit: https://www.marketplace.org/shows/marketplace-tech/
# For each episode with Molly as host, right-click "Transcript" → save as HTML,
# or copy-paste the transcript text directly into a .txt file.
# ~50 episodes exist from Molly's era; grab 20.

# Save as:
docs/persona-research/transcripts/twist/producer/marketplace-tech_2023-03-15.txt
```

### Jason Calacanis — All-In Podcast + solo TWiST monologues

```bash
ALLIN_CHANNEL="https://www.youtube.com/@allin/videos"
yt-dlp \
  --skip-download \
  --write-auto-subs \
  --sub-langs en \
  --sub-format vtt \
  --playlist-end 20 \
  -o "docs/persona-research/transcripts/twist/troll/allin_%(id)s_%(title)s.%(ext)s" \
  "$ALLIN_CHANNEL"
```

Then same `.vtt → .txt` cleanup as above.

### Jackie Martling — "The Jackie Martling Joke Hunt"

```bash
# Jackie's podcast channel — find current URL by searching YouTube for
# "Jackie Martling Joke Hunt"
JACKIE_URL="<paste-playlist-url-here>"
yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt \
  --playlist-end 10 \
  -o "docs/persona-research/transcripts/howard/joker/joke-hunt_%(id)s.%(ext)s" \
  "$JACKIE_URL"
```

### Baba Booey — "Baba Booey's Book Report"

Search YouTube for the current playlist URL. 20+ episodes available. Same command pattern.

### Fred Norris — compilations

Fred's solo content is rare. Search YouTube for "Fred Norris compilation" or "Fred Norris best of" — grab 5 clips totaling ~1 hour. Auto-captions are fine.

### Artie Lange (Troll proxy)

"Artie Lange's Halfway House" and Artie's guest spots on Joe Rogan / Jim Norton / Colin Quinn Tell Me a Story are all public YouTube. Easy 10 hours.

### Alex Wilhelm — Mostly Metrics + TechCrunch Equity archive

Equity Podcast archived at TechCrunch (free). Mostly Metrics on YouTube. Target: 5 hours solo.

### Lon Harris — his Substack (writing, not audio)

Copy-paste his Substack posts as `.txt` files into `docs/persona-research/transcripts/twist/soundfx/`. Writing voice counts for Phase 2 even without audio. Target: 10+ posts.

---

## When auto-captions aren't enough — local whisper fallback

Signs that a clip needs re-transcription:
- Captions say `[music]` or `[inaudible]` for > 30% of the clip
- You spot-read and find mis-transcribed technical terms in every paragraph
- Speaker has a heavy accent + auto-captions render them as word salad

Recipe:

```bash
# 1. Download the audio (not just captions)
yt-dlp \
  --extract-audio \
  --audio-format m4a \
  --audio-quality 0 \
  -o "docs/persona-research/raw-audio/%(id)s.%(ext)s" \
  "https://youtube.com/watch?v=<ID>"

# 2. Run whisper.cpp (fastest on Apple Silicon)
cd docs/persona-research/raw-audio
whisper-cli -m /opt/homebrew/share/whisper-cpp/models/ggml-base.en.bin \
  -l en -of txt -otxt <ID>.m4a
# Output: <ID>.txt

# 3. Move to the right persona folder
mv <ID>.txt ../transcripts/<pack>/<slot>/<source-slug>_<date>.txt

# 4. Clean up the audio file — you don't need it anymore
rm <ID>.m4a
```

`whisper.cpp`'s `base.en` model is ~1 GB and runs in ~real-time on an M1. Use `small.en` or `medium.en` if you want better quality at the cost of speed. Never commit the audio files or the models — add `.m4a` and `docs/persona-research/raw-audio/` to `.gitignore` if they're not already.

---

## When local whisper isn't enough — Whisper API fallback

Rare. Only needed for critical clips with tough audio. $0.006 per minute. Track spend in INDEX.md.

```bash
# Requires: export OPENAI_API_KEY=sk-...
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F model="whisper-1" \
  -F response_format="text" \
  -F file="@/path/to/audio.m4a" \
  > transcript.txt
```

Budget allocation: **$10 cap** on Whisper API — that's ~27 hours of the toughest content, plenty of headroom.

---

## Quality bar — when do you have enough?

Per persona:

- **Minimum:** 3 hours of solo transcripts + 2 hours of duo content. Enough to surface catchphrases + sentence shape.
- **Target:** 5–8 hours solo + 2–5 hours duo. Gives Claude enough breadth to see voice evolution + failure modes.
- **Diminishing returns:** past 15 hours, new data stops revealing new patterns.

Stop rule: when you've logged 20+ sources in `INDEX.md` per pack and each persona has at least 3 hours of attributable speech.

---

## Handoff — feed to Claude for Phase 2

Once the transcripts are collected, kick off Phase 2 from `PERSONA-REFINEMENT-PLAN.md`. One paste into Claude Code:

```
Read docs/persona-research/transcripts/ end-to-end. For each of the 8 personas
(howard: producer, troll, soundfx, joker; twist: same four), produce a voice-
pattern report at docs/persona-research/voice-<slot>-<pack>.md following the
schema in PERSONA-REFINEMENT-PLAN.md § Phase 2. Patterns must be traceable to
at least 3 distinct transcripts; flag anything weaker. Don't quote > 20 words
verbatim from any source.
```

Claude reads, extracts, writes. This is where your free Opus/Sonnet runtime does the work. Expected output: 8 voice-pattern reports ~1–2k words each, each cited to specific transcript + timestamp.

Then Phase 3 (prompt rewrite) uses those reports as the source of truth for new `systemPrompt` + `directorHint` on each of the 8 personas.

---

## Cost tracker (fill in as you go)

| Line | Cost | Notes |
|---|---|---|
| yt-dlp + auto-captions for 50 TWiST episodes | $0.00 | |
| yt-dlp + auto-captions for 20 All-In episodes | $0.00 | |
| yt-dlp + auto-captions for 10 Jackie episodes | $0.00 | |
| yt-dlp + auto-captions for 10 Baba episodes | $0.00 | |
| yt-dlp + auto-captions for 10 Artie episodes | $0.00 | |
| yt-dlp + auto-captions for 5 Fred clips | $0.00 | |
| yt-dlp + auto-captions for 10 Alex clips | $0.00 | |
| Marketplace Tech archive (Molly) | $0.00 | pre-transcribed, free |
| Substack copy-paste (Lon) | $0.00 | |
| Whisper API fallback (budget $10, probably spend <$5) | ~$5.00 | |
| **Total** | **~$5** | Well under the $20 preferred ceiling |

Deepgram via PG backend as a diarization-only fallback for group content, if you want it: budget $5 for 20 hours of multi-speaker group shows. Would bring total to ~$10.

---

## Ongoing improvement (Claude is free; data is the bottleneck)

The plan is:

1. **First pass** — follow this guide, get 75 hours of transcripts, $5–10 spend, 2 hours of your time.
2. **Claude reads + writes** — Phase 2 + 3 of PERSONA-REFINEMENT-PLAN. Free on your subscription.
3. **Ship new prompts** — iteratively, one persona at a time, per v1.8.x point releases in [`ROADMAP.md`](ROADMAP.md).
4. **Watch telemetry** — after each prompt ships, `npm run analyze:director-v3` + fallback-rate checks.
5. **Return to the well** — if a persona still feels off after prompt-tune, add more solo transcripts for that specific persona. Each new source is a free `yt-dlp --write-auto-subs` + a cleanup pass. Incremental data grabs cost nothing.

You can repeat steps 2–5 indefinitely on Claude time. The $10–20 of Whisper API is a one-time investment unless you go deep on a persona that only has noisy-audio sources.

---

## Fair-use + legal posture

- All sources listed are public YouTube content, public podcast feeds, or public newsletters.
- Transcripts are used to *study* voice patterns; the outputs are `systemPrompt` blocks describing voice in general terms + 3–5 paraphrased few-shot examples per persona. No verbatim quotes > 20 words.
- Do NOT commit raw audio files to git. `docs/persona-research/raw-audio/` should be `.gitignore`d.
- Do NOT commit transcripts of paywalled content (SiriusXM live Stern Show). Only the publicly-posted clips on the official Stern YouTube channel are fair game.
- When citing patterns in voice reports, always include source URL + timestamp. If a pattern can only be cited from one source, drop it — not enough signal to generalize.

---

## TL;DR — the commands for Seth

```bash
# Setup (once)
brew install yt-dlp ffmpeg whisper-cpp jq
cd /Users/seth/Projects/Seth/peanut.gallery/chrome-extension
mkdir -p docs/persona-research/transcripts/{howard,twist}/{producer,troll,soundfx,joker} docs/persona-research/raw-audio

# The bulk grab (90% of the work)
for CHANNEL in \
  "https://www.youtube.com/@ThisWeekInStartups/videos" \
  "https://www.youtube.com/@allin/videos" \
  "<jackie-joke-hunt-URL>" \
  "<baba-book-report-URL>" \
  "<artie-halfway-house-URL>"; do
  yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt \
    --playlist-end 20 \
    -o "docs/persona-research/transcripts/unsorted/%(id)s_%(title)s.%(ext)s" \
    "$CHANNEL"
done

# Clean up .vtt → .txt
cd docs/persona-research/transcripts/unsorted
for f in *.en.vtt; do
  grep -vE '^\s*$|^WEBVTT|^[0-9:.\->]+ -->|^NOTE|^Kind:|^Language:' "$f" \
    | sed 's/<[^>]*>//g' > "${f%.en.vtt}.txt"
done
rm *.en.vtt

# Then move each .txt into the right pack/slot folder manually based on who's speaking.
# Once done, paste the "Handoff" prompt into Claude Code to start Phase 2.
```

That's the whole thing. Budget $5–10 real spend, ~2 hours of active time, 75+ hours of in-voice data ready for Claude to work on indefinitely.

---

## Related docs

- [`PERSONA-REFINEMENT-PLAN.md`](PERSONA-REFINEMENT-PLAN.md) — the strategic plan (phases, success criteria, fair-use posture).
- [`PACK-AUTHORING-GUIDE.md`](PACK-AUTHORING-GUIDE.md) — the persona contract your rewrites must honor.
- [`ROADMAP.md § v1.8.x`](ROADMAP.md#v18x-persona-refinement-sprint) — where the output of this work ships.
- [`DESIGN-PRINCIPLES.md § 3a`](DESIGN-PRINCIPLES.md#3a-persona-prompts-are-the-lever-not-the-director) — why persona prompts are the main tuning lever.
