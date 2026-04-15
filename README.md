# 🥜 Peanut Gallery

**Your podcast's AI writers' room.**

4 AI personas watch your live show and react in real-time. A stern producer keeping facts straight. A cynical troll. A chaos agent. A joke writer. All streaming alongside the conversation as it happens.

🌐 **[peanutgallery.live](https://peanutgallery.live)** &nbsp;|&nbsp; MIT Licensed &nbsp;|&nbsp; Open Source

---

> $5,000 + a guest spot on the show. Here's what you have to build...
>
> — [@twistartups](https://x.com/twistartups)

Built in response to Jason Calacanis and Lon Harris's open bounty on [This Week in Startups](https://www.youtube.com/@ThisWeekInStartups).

---

## 🚧 Status: Building in Public

We're shipping this fast. Star the repo to get notified.

---

## The Cast

### 🎯 The Stern Producer
*Powered by Claude Haiku*

Keeps facts straight. Searches the web in real-time to verify claims made on air. The AI version of a show producer who won't let anything slide.

> "Jason just said Uber was founded in 2007. It was 2009. Again."

### 🔥 The Cynical Troll
*Powered by Groq · Llama 70B*

Dunks on everything with internet-brain energy. Contrarian by default, occasionally right. Responds in 120ms because trolls don't deliberate.

> "Oh cool, another AI wrapper. Very 2024."

### 🌀 The Chaos Agent
*Powered by Groq · Llama 8B*

Derails, free-associates, says the thing no one was thinking. A smaller model makes the chaos feel more chaotic.

> "What if we replaced all VCs with a single pigeon trained on term sheets?"

### 😂 The Joke Writer
*Powered by Claude Haiku*

Setup-punchline structure, callback humor, observational comedy. The one who makes you spit out your coffee mid-episode.

> "Jason's investment thesis: if it has 'AI' in the name and the founder has a pulse, it's a yes."

---

## How It Works

```
YouTube Live URL → yt-dlp → FFmpeg → Deepgram Nova-3 → 4 AI Personas → Streaming Sidebar UI
```

1. **Paste a YouTube URL** — live stream or any video
2. **Real-time transcription** — audio pipes to Deepgram at sub-300ms latency
3. **Persona engine fires** — every 2 minutes of new dialogue, all 4 personas react in parallel
4. **Streaming sidebar** — responses appear token-by-token in a 4-column dark-themed UI

---

## Stack

Multi-provider by design. No platform trap.

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | Next.js 15, Tailwind, shadcn/ui | App Router + SSE streaming |
| Transcription | Deepgram Nova-3 | Sub-300ms, $0.46/hr, WebSocket native |
| Smart Personas | Claude Haiku (Anthropic) | Reasoning + nuance for Producer & Joke Writer |
| Fast Personas | Groq + Llama | 120ms TTFT for Troll & Chaos Agent |
| Fact-Checking | Brave Search API | Real-time claim verification |
| Deployment | Vercel | One-click, free tier |

**Cost per 2-hour episode: ~$1.15**

---

## Quick Start

```bash
git clone https://github.com/Sethmr/peanut.gallery.git
cd peanut-gallery
cp .env.example .env  # Add your API keys
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000), paste a YouTube URL, and watch the gallery react.

### API Keys Needed

| Service | Get It | Free Tier |
|---------|--------|-----------|
| Deepgram | [console.deepgram.com](https://console.deepgram.com/signup) | $200 free credit |
| Groq | [console.groq.com](https://console.groq.com/keys) | 2,000 req/day |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | $5 free credit |
| Brave Search | [brave.com/search/api](https://brave.com/search/api/) | $5/mo credit |

---

## Roadmap

- [ ] Chrome extension for tab audio capture
- [ ] Custom persona builder
- [ ] Audience-facing mode (embed widget for viewers)
- [ ] Auto-generated show notes with timestamps
- [ ] Voice mode (personas speak via ElevenLabs)
- [ ] Persona memory across episodes
- [ ] OBS overlay integration
- [ ] Multi-show support (any podcast, not just TWiST)

---

## Built By

**[Seth Rininger](https://sethrininger.dev)** — iOS dev turned AI builder. 12+ years shipping apps at scale. Currently building at the intersection of AI, podcasting, and chaos.

Built for **[This Week in Startups](https://x.com/twistartups)** · Jason Calacanis & Lon Harris

---

MIT License · Fact-checking powered by Brave Search
