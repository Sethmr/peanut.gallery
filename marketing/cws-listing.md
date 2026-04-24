# Peanut Gallery — Chrome Web Store listing copy

Paste these into the Chrome Web Store developer dashboard for the
Peanut Gallery listing. Short description goes in the "Summary" field
(pulled from manifest.json `description`; keep in sync if you edit).
Long description goes in the "Description" field.

Target keywords, used naturally throughout: *YouTube Chrome extension,
AI Chrome extension, YouTube AI sidebar, AI commentary YouTube, YouTube
fact checker, real-time AI reactions, Chrome side panel extension, AI
reacts to YouTube, live YouTube transcription, AI writers' room,
peanut mascots, illustrated AI personas.*

---

## Short description (≤132 chars, must match manifest.json)

AI writers' room for YouTube. 4 personas react live — fact-checker, troll, sound guy, comedy writer. Howard or TWiST pack.

---

## Long description

Four critics. One tab. Your AI writers' room for YouTube — filed like a late-night newspaper desk, now with a gallery of illustrated peanut mascots on the front page.

Peanut Gallery mounts in Chrome's native side panel as a broadsheet: cream paper stock, Anton slab masthead, four peanut-mascot avatars standing by — each one an illustrated SVG character carrying their signature prop (clipboard, headphones, mic, match). A fact-checker. A sound effects guy. A comedy writer. A cynical troll. They watch any YouTube video alongside you and file their reactions as a wire-service feed — every quip stamped with a 24-hour timestamp and a role tag (FACT, DUNK, CUE, BIT).

No tab switching. No screen-share picker. No interference with playback. Audio is captured silently while you watch.

Built for long-form talk shows, interviews, and pods — where a booth producer actually adds something. Inspired by the Howard Stern Show. Two packs ship out of the box; swap between them in the side panel per session.

THE HOWARD PACK (default)

- Baba Booey — fact-checker. Mid-show corrections and background data on every claim. Searches the web via Brave Search or xAI Live Search to verify stats, dates, and attributions.
- Fred Norris — sound effects guy. Well-timed cues and the occasional razor-sharp aside.
- Jackie Martling — comedy writer. Setup-punchline jokes, callbacks, observational humor.
- The Cynical Troll — contrarian commentator, 120ms response time. Says what the chat is thinking.

THE TWIST PACK (swap in the side panel)

Tuned for This Week in Startups-style podcasts — Molly Wood (producer), Jason Calacanis (troll), Lon Harris (sound effects), and Alex Wilhelm (joker). Same 4 roles, startup vocabulary.

THE BROADSHEET UI (v1.5 line)

- Illustrated peanut mascots (v1.5.3) — each of the 8 personas across both packs ships with a hand-authored SVG peanut avatar carrying their signature prop. Baba Booey with his clipboard, Fred's purple headphones, Jackie's stand mic, the Troll as a boiled peanut. TWiST pack: Molly's reporter notebook, Jason's megaphone, Lon's clapperboard, Alex's pie chart. Idle bob at rest, excited wiggle while speaking.
- Two-card pack chooser (v1.5.3) — swap packs by tapping a card; see both packs' mascots side by side before committing.
- Role-stamped wire feed — every reaction filed with FACT / DUNK / CUE / BIT and a 24h timestamp. Filter pills in the footer hide any tag you want to tune out.
- First-run guided tour (v1.5.2) — new installs get a 4-step Editor's Note walkthrough on first open; replayable anytime from the Appearance submenu.
- Paper theme for daylight, Night theme for 2am captures. Toggle in the drawer.
- Mute a critic with one tap — their mug gets a strike-through, their stream goes silent. No server round-trip.
- Download the whole session as Markdown when you're done — full transcript plus every quip, role-tagged, ready to paste into a doc.

HOW IT WORKS

1. Install. Click the peanut icon on any YouTube tab — a native Chrome side panel opens.
2. Enter your API keys (Deepgram, Anthropic, xAI, and optionally Brave Search). Keys are stored locally in your browser and sent only to the providers you configure.
3. Click Start Listening. Tab audio is captured silently via chrome.tabCapture — the same API used by Otter.ai, Fireflies, and Recall.ai. No permission picker, no interference with playback. You hear the video; the AI hears it too.
4. Responses stream back token-by-token into the wire feed alongside a live transcript. Mute, filter, or download the session at any time.

PRIVACY-FIRST BY DESIGN

- Your API keys live in chrome.storage.local on your machine and are passed directly to the providers — never logged, never persisted.
- Audio is transcribed in real-time and discarded. No session is written to disk.
- No user accounts. Nothing to sign up for.
- For full privacy: Peanut Gallery is MIT-licensed open source. Run the server yourself with `npm run dev` and point the extension at localhost. Your audio never leaves your machine except to the AI providers you choose.

COST

Approximately $1 per hour across all three providers at current rates. No subscription, no middleman — you pay the providers directly.

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
podcast ai companion
startup podcast extension
twist pack
podcast fact checker
ai booth producer

---

## Category

Productivity (primary)
— alternative: Entertainment. Productivity ranks higher in CWS search
for utility-style extensions; Entertainment is a better fit for casual
discovery. Pick Productivity unless data says otherwise after 2-4 weeks.

---

## Screenshot caption text (for the 5 required 1280x800 images)

Updated for v1.5.3 "The Cast" — mascots now lead the top screenshot. Each caption is ≤80 chars so it won't truncate on CWS.

1. "Four peanut mascots, one tab. Your AI writers' room for YouTube."
2. "Illustrated peanuts with signature props — clipboard, mic, headphones, flame."
3. "Tap a pack card to swap between Howard and TWiST. Lineup locked during capture."
4. "Role-stamped wire feed. Live fact-checking. Paper or Night theme."
5. "Silent tab capture. MIT licensed. Bring your own keys."

**Screenshot refresh TODO (Seth):** existing CWS screenshots were shot against the v1.5.1 initials-mug UI. Need reshoots against v1.5.3 to actually show the mascots the captions are selling. See `SCREENSHOTS.md` for the capture flow.
