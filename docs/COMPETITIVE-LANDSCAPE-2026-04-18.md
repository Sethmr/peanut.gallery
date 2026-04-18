# Peanut Gallery — Competitive Landscape (2026-04-18)

> Snapshot of where Peanut Gallery sits in the "AI reacts to things you're watching / listening to" market, as of April 2026. Research pass done pre-v1.5.0 canary. Intent: keep forward progress informed by what the rest of the category is shipping.

**Categorization principle:** organized by distance from Peanut Gallery's core loop (real-time LLM personas react to live transcription of audio/video). Closer tools are higher-priority competitive reads; further ones are adjacent markets worth watching.

---

## 1. Direct competitors — "AI reacts in real-time while you watch/listen"

### Dmooji — the closest thing to Peanut Gallery in this market

- Chrome + Firefox extension; works on YouTube (regular videos, live chat, Shorts).
- 10,000+ AI characters (heavy anime/pop-culture library). User picks a companion; companion "watches along" and reacts.
- Reactions render as *danmaku* — floating comments that fly across the video, the Niconico/Bilibili UX pattern.
- Positioning: "Never watch alone." Social/emotional companion angle, not producer/booth angle.

**Feature overlap with PG:** real-time reactions to a YouTube video, multiple personas, browser-extension distribution.

**Where PG differentiates:**

- **The Director.** Dmooji almost certainly picks one character, then freestyle reacts; PG has a dedicated booth-producer abstraction (scorer + cascade probabilities + cooldowns + now LLM-assisted routing in v1.5). Nobody else in this category has that.
- **Transcription-driven specialties.** PG's producer fact-checks claims; troll trolls hype; soundfx reacts to mood shifts; joker builds comedy setups. Dmooji's characters are archetypes of *personality*, not *role*. PG's slot system is engineered for podcasts and shows with distinct conversational beats.
- **Named-crew packs vs. generic library.** Pg's Howard Stern pack + TWiST pack are tied to specific shows; Dmooji is a character bazaar. Pg is smaller but sharper for its target audience.
- **Side-panel + SSE + debug console.** Pg exposes a director trace with scores + top3 + cooldowns + RULE/LLM badges. That's a tool-for-operators surface; Dmooji is tool-for-viewers.

**Action items:** (1) install Dmooji, do a side-by-side session on a TWiST clip and a Stern clip, note where their reactions feel better than PG's and where PG wins. (2) consider danmaku-style floating overlay as an optional render mode alongside the side panel — it's a proven UX pattern in East Asia and would be a free-tier retention hook.

### Questie AI — gaming-focused VLM companion

- AI watches your screen via a Vision Language Model, reacts via voice chat.
- 30+ supported games (CS2, Valorant, Cyberpunk 2077, Destiny 2, Honkai Star Rail, etc.). Gemini / ChatGPT / Llama / Deepseek / Grok selectable.
- **Pricing:** $19.99 for 25+ hours (~$0.80/hour of gameplay). 25,000+ paid users.
- Explicit VTuber sub-product — "co-host" for stream prep + live reactivity.

**Relevance to PG:** not a direct competitor (different vertical), but the pricing + user count *validates* the "AI companion that reacts to live media" market. The ~$0.80/hour price point is the market signal. Pg currently monetizes by BYO-keys + limited free tier on hosted; Questie's pricing says a hosted-with-quota tier would find customers.

**Also note:** vision-based reactivity is going to eat gaming. Podcasts lean audio-first, which is where PG's Deepgram-driven pipeline stays relevant.

### ai_licia — Twitch AI co-host

- Purpose-built AI companion for Twitch streamers. Joins YouTube, TikTok, Kick streams.
- Reacts to stream events (follows, subs, raids, cheers, ads). Stream Deck integration.
- 19+ languages. Customizable personality, voice, backstory.

**Relevance to PG:** this is the *broadcaster-facing* mirror of PG's *audience-facing* product. Streamers pay for ai_licia to help them talk to chat; Pg's users use it to have something to talk back to a podcast with. Adjacent, not overlapping.

**Features worth stealing:**

- Event-driven triggers. ai_licia reacts to subs/raids. Pg's director already fires on silence + claims; add triggers for things like "YouTube chat spike detected", "ad break started", "chapter change" to widen reactive surface area.
- Customizable personality + backstory authoring UI. Pg's pack system is code-first (`lib/packs/*/personas.ts`). A visual persona-builder is a much wider funnel.

---

## 2. Adjacent — "AI generates a podcast from source material"

Post-hoc generators, not real-time. Different market, but user overlap is meaningful.

- **NotebookLM Audio Overview (Google)** — the gold standard. Two-host format from any text source. Can ingest PDFs, URLs, docs. Dominates mindshare in this category.
- **ElevenLabs GenFM** — matches NotebookLM's audio production quality; single-source limitation at time of this search.
- **Podcastfy (open source, Python)** — multimodal input, multilingual output. On GitHub. Would be the reference implementation for someone wanting to self-host a NotebookLM-style pipeline.
- **Wondercraft / Jellypod / BeFreed / Imagera / podcast-generator.ai** — various flavors. BeFreed targets micro-learning from books; Wondercraft targets general podcast production with unlimited hosts.

**Strategic read:** these tools create podcasts. Pg reacts to podcasts. The overlap is in audience (podcast-curious users), not in function. Positioning Pg as "the show that reacts to your podcasts" versus "AI generates fake podcasts" is a real distinction worth leaning on in marketing copy — listeners want authenticity + reactivity, not more synthetic content.

---

## 3. Research frontier — where the next wave comes from

### LiveCC (CVPR 2025, showlab/livecc on GitHub)

- First video LLM with real-time streaming commentary as a native capability.
- Trained on Live-CC-5M + Live-WhisperX-526K datasets that densely interleave ASR transcripts with video frames. Open source. 7B model on HuggingFace.
- Beats 72B models in real-time commentary quality per the paper.

**Why this matters to Pg:** the whole pipeline (video frames + ASR + commentary) collapses into one model. Pg currently orchestrates Deepgram → Director → Claude/Grok streams at ~10-15s tick cadence with explicit cost per tick. A single streaming multimodal model could compress that to sub-second latency at a fraction of the cost in 18-24 months.

**Architectural implication:** keep Pg's layers *swappable*. If LiveCC-style models get to production quality, Pg's Director becomes a routing shim in front of one (or four — one per slot) streaming models, not four separate Anthropic/xAI SDK calls. The v1.5 design — LLM-pick interface + source badging — is already shaped to absorb this transition.

### Multi-party turn-taking research (Frontiers 2025, Murder Mystery Agents)

- Academic framework for controlling turn-taking in multi-agent LLM dialogue, tested on Murder Mystery tabletop RPG.
- Findings: human turn-taking systematics (interruption cost, silence protocol, topic alignment) transfer cleanly to LLM agent orchestration.

**Relevance:** Pg's cascade probabilities + cooldowns + recency penalties are an engineered approximation of the same behavior. The research validates the design direction and suggests concrete upgrades (e.g. topic-alignment penalties alongside recency penalties — "don't let the joker speak back-to-back about fact-checking after the producer just fact-checked").

### Multi-persona critique tools (custom GPTs, AI Writers' Room substack)

- "The Writers' Room" GPT has 5 personas: Strategist, Contrarian, Reporter, Editor, Coach. Users paste content, personas critique in turn.
- Turn-based, not real-time. Product-critique surface, not entertainment.

**Relevance:** shows the pattern of "multiple LLM voices with distinct roles" is becoming a design pattern, not a novelty. Pg's archetype slot system (producer/troll/soundfx/joker) is the real-time entertainment variant of the same pattern. Keep an eye on the pattern — if one of these tools adds live audio, it's a direct competitor.

---

## 4. Non-competitors worth knowing about

- **YouTube summarizer extensions** (ChatTube, Glasp, Glarity, BibiGPT) — summarize *after* watching. Fundamentally different product; shared distribution channel (CWS).
- **AI live-streaming avatar tools** (VisionStory, Virbo, Viggle) — character-with-face for streamers. Different side of the camera.
- **CAMB.AI** — live sports commentary, multi-speaker, Italian Ligue 1 coverage. Production-grade single-event AI commentary. No personas, no extension; informs what "real-time AI commentary" looks like at scale.
- **Character.AI, Replika, TalkPersona** — general AI companions. Not video-reactive.

---

## 5. Positioning takeaways for Pg

1. **The Director is the moat.** v1.5's Smart Director v2 (LLM-assisted routing with rule-based fallback under a 400ms budget) is pushing deeper into territory nobody else in the real-time reaction category has formalized. Keep doubling down here.

2. **Podcast-first beats YouTube-generic.** Dmooji is trying to be everything for every video; Pg is tuned for shows with named voices, distinct conversational beats, and fact-checkable claims. Leaning harder into "the booth producer for your podcast" versus a generic YouTube companion is the differentiation angle for marketing copy + CWS listing.

3. **Packs as a content surface.** The pack system (Howard, TWiST) is an under-leveraged distribution lever. Adding packs for popular shows — All-In, Acquired, Hard Fork, Lex Fridman — gives Pg reasons to land in front of new audiences. Cost per pack is research + 4 persona prompts + a persona-test run.

4. **The hosted-paid tier is a question, not an answer.** Questie at $0.80/hour and 25k paid users says the market exists. Pg's current posture (BYO keys + 15 min free tier with demo keys) is conservative. A usage-metered hosted tier (e.g. $9/month for 10 hours, $19/month for unlimited with fair-use) would be a natural v1.7 or v2.0 line item. Do not add before the product is boring-to-operate; premature monetization paints Pg into corners.

5. **Side-panel is right, but danmaku is a strong secondary UX.** Dmooji proves the floating-comment mode has an audience. An optional overlay mode (produce the same persona reactions as floating captions over the YouTube player) is a small engineering lift on top of existing infra and would broaden Pg's visual appeal for casual users.

6. **Keep layers swappable for LiveCC-style convergence.** In 18-24 months, a single streaming multimodal model might do what Pg's 4-stage pipeline does today at a fraction of the latency and cost. Pg's v1.5 `pickPersonaLLM` interface + `TriggerDecision.source` metadata is already shaped to absorb that transition — no action today, just do not regress the modularity.

7. **Name + IP.** "Peanut Gallery" as a trademark is contested by several podcasts on Apple/Spotify but no tech products. Category distinctness is good; if a trademark filing is desired later, focus on "AI" + "booth" + "reactive" adjacent classes.

---

## 6. Things to watch (next research pass, ~v1.6 or after 30 days)

- Does Dmooji add audio/voice persona output? (Currently text danmaku only, best I can tell.) If yes, they catch up to Pg's planned v1.6 Voice feature.
- Does NotebookLM add "react to this live-playing audio" mode? Google's most likely leap from their current state.
- Does ai_licia add a "watch along with a podcast" audience-facing mode? Would directly enter Pg's lane.
- Does LiveCC's 7B-Instruct model become hostable cheaply enough (e.g. Replicate cold-start < 1s, self-host on commodity GPU under $0.01/minute) to be a real alternative to the orchestrated Claude/Grok pipeline?
- Does anyone ship "Stern-style writers' room over live YouTube" explicitly? The name-dropping angle (Howard, TWiST) is legally thorny — Pg uses archetype slots + pack-specific persona-gen prompts to stay on the generic side of the line. If a competitor emerges willing to push harder on celebrity-voice clone parody, the law will sort them out; Pg's conservative posture is correct.

---

**Sources consulted in this research pass:**

- Dmooji feature pages + Chrome Web Store listing + Medium analysis on AI video companions
- Questie AI product pages + VTuber sub-product + Twitch page
- ai_licia product pages + Deepgram case study + Elgato marketplace
- LiveCC arXiv paper (2504.16030) + showlab/livecc GitHub + HuggingFace model cards
- G2 + Atlas Workspace + Imagera AI articles on NotebookLM alternatives
- Frontiers in AI 2025 paper on multi-party turn-taking
- Podcastfy GitHub (souzatharsis/podcastfy)
- CAMB.AI Ligue 1 live commentary announcement
- Wondercraft, Jellypod, BeFreed, podcast-generator.ai product surfaces
- TechCrunch Feb 2026 on Particle's AI news podcast clip tool
- "AI Writers' Room" custom GPT + Draft Intelligence substack

Store this doc as the baseline for the next competitive review. Update when v1.6 (Voice + Clip Share) ships or every ~90 days, whichever comes first.
