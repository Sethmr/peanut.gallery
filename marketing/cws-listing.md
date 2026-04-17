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

AI writers' room for YouTube. 4 AI personas react in real-time from the side panel — fact-checker, troll, sound guy, comedy writer.

---

## Long description

Peanut Gallery is a free, open-source Chrome extension that puts an AI writers' room next to any YouTube video. Four AI personas — inspired by the Howard Stern Show staff — watch the video with you in real time and react from Chrome's native side panel. A fact-checker catches misstatements mid-sentence. A comedy writer drops setup-punchline one-liners. A sound effects guy cues timed drops and razor-sharp asides. A cynical troll says what the audience is thinking but won't type.

Works on ANY YouTube video — podcasts, interviews, livestreams, keynotes, lectures, music, news clips, anything with audio. Built for This Week in Startups, designed for everything else.

🥜 THE CAST

• Fact-Checker (Claude Haiku + Brave Search) — Monitors the conversation for claims and cross-references them against live web results. Catches wrong dates, misquoted stats, and "I'm pretty sure" moments in real time.

• Cynical Troll (Groq, Llama 70B) — Dunks on everything with internet-brain energy. 120ms response time because trolls don't deliberate.

• Sound Effects Guy (Groq, Llama 8B) — Background context and timed sound-effect cues. The one whispering fun facts in your ear.

• Comedy Writer (Claude Haiku) — Setup-punchline structure, callback humor, observational comedy. The one who makes you spit out your coffee mid-episode.

A rule-based director picks one persona per moment, then others cascade with staggered delays — just like a real writers' room. Some moments get one response; some get two or three; occasionally all four pile on.

⚡ HOW IT WORKS

Peanut Gallery uses chrome.tabCapture — the same API Otter.ai and Fireflies use — to capture YouTube tab audio silently. No screen-share picker. No playback interference. No second tab. You hear the video; the extension hears it too. Audio streams to a backend (hosted or self-hosted) at 16kHz PCM, gets transcribed by Deepgram Nova-3 in under 300ms, and routed through the director to the AI personas. Reactions stream token-by-token via SSE directly into Chrome's Side Panel, right next to the video.

🔒 PRIVACY

Your audio is transcribed in real time and discarded. Nothing is logged. Nothing is persisted. If you use the hosted backend, API keys live in your browser's extension storage and are forwarded per request — never saved server-side. If you want zero trust, self-host the backend in one command. The full privacy policy is at peanutgallery.live/privacy.

🛠 OPEN SOURCE

Peanut Gallery is MIT-licensed and fully open source on GitHub at github.com/Sethmr/peanut.gallery. Fork it, swap providers, remix the personas, or self-host for full privacy. No platform trap, no proprietary pipeline.

💸 COST

Free to try with the hosted backend. Bring your own API keys (all providers have free tiers) for unlimited use. Typical cost with your own keys: ~$1.15 per two-hour video.

✅ FEATURES

• Native Chrome side panel — lives next to the video, not on top of it
• Real-time YouTube transcription (Deepgram Nova-3, <300ms latency)
• Live fact-checking with Brave Search
• Four AI personas with director-driven cascade logic
• Silent tab audio capture via chrome.tabCapture (no permission picker)
• Bring your own API keys — Deepgram, Groq, Anthropic, Brave
• Self-hostable backend (one-command Docker deploy)
• Works on any YouTube video, any channel, any length
• MIT licensed, fully open source

🎯 WHO IT'S FOR

• Podcast listeners who want a live writers' room on This Week in Startups, Lex Fridman, The All-In Podcast, The Tim Ferriss Show, Joe Rogan, Huberman Lab, anything
• Content creators who want live fact-checking and commentary on their own uploads
• Teams watching conference keynotes together — Peanut Gallery is the async coworker in the side panel
• Students using YouTube lectures who want a contextual sidekick
• Anyone who's wondered "what if I could hear the chat reacting to this in real time?"

🚀 INSTALL

Click "Add to Chrome" above. Open any YouTube video. Click the 🥜 icon. Hit Start Listening. Four personas react in real time.

Built by Seth Rininger in response to Jason Calacanis and Lon Harris's $5,000 open-source bounty on This Week in Startups. Shipped as a Chrome extension. Works on any YouTube video.

peanutgallery.live | github.com/Sethmr/peanut.gallery

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
