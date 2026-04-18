# Peanut Gallery — Chrome Web Store listing copy

Paste these into the Chrome Web Store developer dashboard for the
Peanut Gallery listing. Short description goes in the "Summary" field
(pulled from manifest.json `description`; keep in sync if you edit).
Long description goes in the "Description" field.

Target keywords, used naturally throughout: *YouTube Chrome extension,
AI Chrome extension, YouTube AI sidebar, AI commentary YouTube, YouTube
fact checker, real-time AI reactions, Chrome side panel extension, AI
reacts to YouTube, live YouTube transcription, AI writers' room.*

---

## Short description (≤132 chars, must match manifest.json)

AI writers' room for YouTube. 4 personas react live — fact-checker, troll, sound guy, comedy writer. Howard or TWiST pack.

---

## Long description

Peanut Gallery turns any YouTube video into a live show with 4 AI personas watching alongside you — a fact-checker, a sound effects guy, a comedy writer, and a cynical troll. They react in real-time in a native Chrome side panel, next to the video. No tab switching. No screen-share picker. Audio captured silently while you watch.

Inspired by the Howard Stern Show staff.

THE CAST

- Baba Booey — fact-checker. Mid-show corrections and background data on every claim. Searches the web via Brave Search to verify stats, dates, and attributions.
- Fred Norris — sound effects guy. Well-timed cues and the occasional razor-sharp aside.
- Jackie Martling — comedy writer. Setup-punchline jokes, callbacks, observational humor.
- The Cynical Troll — contrarian commentator, 120ms response time. Says what the chat is thinking.

HOW IT WORKS

1. Install. Click the peanut icon on any YouTube tab — a native Chrome side panel opens.
2. Enter your API keys (Deepgram, Anthropic, xAI, and optionally Brave Search). Keys are stored locally in your browser and sent only to the providers you configure.
3. Click Start Listening. Tab audio is captured silently via chrome.tabCapture — the same API used by Otter.ai, Fireflies, and Recall.ai. No permission picker, no interference with playback. You hear the video; the AI hears it too.
4. Responses stream back token-by-token and appear in the side panel alongside a live transcript.

PRIVACY-FIRST BY DESIGN

- Your API keys live in chrome.storage.local on your machine and are passed directly to the providers — never logged, never persisted.
- Audio is transcribed in real-time and discarded. No session is written to disk.
- No user accounts. Nothing to sign up for.
- For full privacy: Peanut Gallery is MIT-licensed open source. Run the server yourself with `npm run dev` and point the extension at localhost. Your audio never leaves your machine except to the AI providers you choose.

COST

Approximately $1.15 per 2-hour episode across all four providers at current rates. No subscription, no middleman — you pay the providers directly.

LINKS

- Source code + setup: https://github.com/Sethmr/peanut.gallery
- Hosted reference web app: https://peanutgallery.live
- Privacy policy: https://peanutgallery.live/privacy

BUILT FOR

The $5,000 This Week in Startups bounty from @jason and @lonharris. Ship it. @TWiStartups.

---

## Search-term slots (fill ALL that are available in dev dashboard)

youtube ai sidebar
youtube chrome extension
youtube ai commentary
ai reacts to youtube
youtube fact checker
ai writers room
live youtube transcription
chrome side panel extension
youtube ai assistant
howard stern ai
this week in startups
jason calacanis
real-time ai commentary
open source chrome extension
youtube ai reactions

---

## Category

Productivity (primary)
— alternative: Entertainment. Productivity ranks higher in CWS search
for utility-style extensions; Entertainment is a better fit for casual
discovery. Pick Productivity unless data says otherwise after 2-4 weeks.

---

## Screenshot caption text (for the 5 required 1280x800 images)

1. "An AI writers' room for any YouTube video"
2. "4 personas react in real time from Chrome's side panel"
3. "Live fact-checking with Brave Search — catches wrong dates mid-sentence"
4. "Silent tab capture. No screen-share picker. No playback interference."
5. "Free, open source, bring-your-own-keys. MIT licensed."
