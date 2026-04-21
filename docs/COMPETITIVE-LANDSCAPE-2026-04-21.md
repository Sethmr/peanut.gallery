# Competitive Landscape — 2026-04-21

Feature-gap pass across adjacent products (AI reactor companions, podcast clip tools, live-caption overlays, chat bots, Chrome entertainment layers). Feeds v2.0 prioritization and the v2.x roadmap. Companion to [`COMPETITIVE-LANDSCAPE-2026-04-18.md`](COMPETITIVE-LANDSCAPE-2026-04-18.md) — that one covered the broader category; this one is feature-specific.

Filter criteria (Peanut Gallery's non-negotiables):
- No cloud transcript storage ([DESIGN-PRINCIPLES § 5](DESIGN-PRINCIPLES.md#5-privacy-posture--keys-in-the-browser))
- No account system pre-v2.0
- No TTS / voice (deferred per [ROADMAP.md](ROADMAP.md#deferred--off-the-critical-path-to-v20))
- No "use a better model" suggestions (the Director is the moat, not the provider)
- No enterprise / seats / admin features

---

## Executive summary

1. **Clip-to-share is the single biggest gap between Peanut Gallery and every other AI media product.** Castmagic, Podcastle, Particle, Eklipse, and Otter all ship "pull a moment, make a card/clip, post it." Peanut Gallery ships Markdown export and will ship session recall in v2.0; the next load-bearing distribution lever is a **Broadsheet-styled PNG quote card** with the persona reaction attached. Same engine as the v2.0 session-recall snippet, just surfaced during live sessions too. Most leveraged feature on the list.
2. **Auto-highlights are table stakes in the clipping category** (Eklipse, Highlight Analyzer, Particle, Castmagic). The Director already knows which moments scored hot — persisting the top-N per session as "Best of this episode" is a small lift on top of existing fire-log data.
3. **Pacing control is an unexploited marketing wedge.** Dmooji, ai_licia, and Character.AI all let the user tune "how much character" they want. Peanut Gallery exposes pack swap but not a global sensitivity dial. A one-slider "Quieter / Normal / Rowdy" control in the drawer is an S-sized change that addresses the #1 complaint category any reactor product gets ("too noisy").
4. **Conversation loops (user-to-persona replies, upvote/downvote, pin) are under-used in live-reactor products but well-validated in chatbot land** (ChatBotKit, Poe, Character.AI). A thumbs-up on a quip is both a shareability primitive AND a future Director training signal — two wins from one S-sized UI.
5. **The "pack marketplace" space is genuinely empty.** Poe has the App-Store-of-bots model at millions of bots; Character.AI has millions of user-made characters; nobody has shipped "user-authored packs of 4 personas tuned for podcast reactivity." Moat-extender for post-v2.0; spiritual successor to the deferred Pack Lab.

---

## Must-have features for v2.0 (or v2.1)

### Theme A — Shareability (the distribution loop)

**A1. Broadsheet quote card (PNG-to-clipboard)**
One-line: pick a transcript moment + its persona reaction, render a Broadsheet-styled card to a canvas, copy to clipboard or download.
Competitors: [Castmagic Clip Generator](https://www.castmagic.io/tools/podcast-clip-generator), [Podcastle Clip Generator](https://podcastle.ai/tools/ai-podcast-clip-generator), [Particle podcast clips](https://techcrunch.com/2026/02/23/particles-ai-news-app-listens-to-podcasts-for-interesting-clips-so-you-you-dont-have-to/), [Otter Highlight Summary](https://otter.ai/blog/otters-new-highlight-summary-feature-turns-your-meeting-notes-into-a-summary-that-you-can-share).
Why for Peanut Gallery: this IS the distribution loop. Markdown export is for archivists; quote cards are for Twitter / Bluesky / iMessage. The Broadsheet rebrand (v1.5) and mascot assets (v1.5.3/v1.6) are already shippable visual identity; this bundles them into a single social artifact. Aligns 1:1 with the v2.0 launch feature spec in [`ROADMAP.md`](ROADMAP.md#v200-the-gallery--launch). Name it "Share the Gallery" (user word), not "session recall" (operations word).
Build cost: **M** (1–3 weeks) — canvas render + font embed + clipboard API + picker UI. Half already scoped for v2.0.
Priority: **Must-have v2.0.**

**A2. Auto-highlights ("Best of this episode")**
One-line: surface the Director's top-N hottest fires per session as a one-click "Best Moments" digest.
Competitors: [Eklipse auto-highlights (up to 100/stream)](https://eklipse.gg/features/ai-highlights/), [Highlight Analyzer engagement graph](https://highlight-analyzer.com/en), [Particle "interesting clips"](https://techcrunch.com/2026/02/23/particles-ai-news-app-listens-to-podcasts-for-interesting-clips-so-you-you-dont-have-to/), [Castmagic automatic clip identification](https://www.castmagic.io/features).
Why for Peanut Gallery: we already have the signal — trigger scores, fire frequency, recency — that other tools spend ML budgets reconstructing. Top-3 fires per session piped into the Past Sessions list (v2.0 feature) turns "I had a session" into "I had a session with three shareable moments." Directly feeds A1.
Build cost: **S** (≤ 1 week) — score-sort the existing fire log, render a list, link each entry to A1.
Priority: **Must-have v2.0.**

### Theme B — Pacing control (retention lever)

**B1. Global sensitivity dial**
One-line: one slider ("Quieter / Normal / Rowdy") that scales Director trigger thresholds + cascade probabilities globally.
Competitors: Dmooji character-specific tuning; [ai_licia custom character + trigger frequency](https://www.getailicia.com/ai-licia-for-twitch); implicit in every danmaku client (opacity/speed controls).
Why for Peanut Gallery: "too chatty" is the universal first-impression failure mode for reactor products (see the Dmooji reviews that mention it). The v3 Director already has all the knobs (rule thresholds, cascade probabilities, sticky penalty); wiring one slider to scale them is a trivial engineering change that unlocks a huge UX range. Fits in the "Critics" submenu that already exists (v1.5.1).
Build cost: **S**.
Priority: **Must-have v2.0** — new users will churn on "too much" without it.

**B2. Per-persona mute lock (beyond mute-a-critic)**
One-line: "Lock this persona to 50% less often" without full muting.
Why: complements B1 but per-character. Users love the troll for 20 minutes then want less of them; currently the only option is total mute.
Build cost: **S.**
Priority: Should-have v2.0 if B1 ships first; otherwise defer to v2.1.

### Theme C — Conversation loops (engagement ratchet)

**C1. Upvote / downvote on each fire**
One-line: thumbs up / thumbs down on each persona quip; thumb-up surfaces it in "Best Moments" (A2) and clip card (A1).
Competitors: [ChatBotKit upvote/downvote APIs](https://chatbotkit.com/changelog/chatbotkit-introduces-upvote-and-downvote-apis-to-our-suite-of-tools), [chatbot feedback patterns](https://chatbotkit.com/features/feedback-and-ratings).
Why for Peanut Gallery: double-win — (a) a thumb-up is a user-authored "clip this" signal (feeds A1/A2 and solves "which moment should I share" without ML); (b) it's a latent training signal for future Director tuning under design principle #4 ("customer value wins"). Privacy-safe because the signal stays in `chrome.storage.local` alongside the session.
Build cost: **S** — button + local-storage write + sort hook into A2.
Priority: **Must-have v2.0.**

**C2. Pin favorite quips**
One-line: pin a quip to the top of the side-panel feed so the user can keep it visible during the session.
Competitors: [Otter time-stamped comments](https://otter.ai/features), Twitch chat pinned messages.
Why for Peanut Gallery: low-lift, high-delight. During a long session, users lose great moments in the scroll.
Build cost: **S.**
Priority: Should-have v2.0.

---

## Should-have features for v2.x

### Theme D — Context expansion

**D1. YouTube chapter / description ingestion**
One-line: scrape the current video's chapter markers + description; feed them to the Director as structural hints.
Competitors: [Glasp summaries use YT transcript + metadata](https://glasp.co/youtube-summary), Sider podcast transcription.
Why: a chapter change is a free "topic shift" signal for the Director — producer gets a chance to fact-check the new topic, troll can set up a new bit. Description often names guests (perfect for Baba "you know this guy"). Strictly additive, no privacy cost (all public YouTube data on the page).
Build cost: **M** — YT DOM scrape in content script + schema on the Director context + prompt tweak.
Priority: Should-have v2.1.

**D2. Live-chat spike trigger (live streams)**
One-line: when YouTube live-chat volume spikes, fire the Director to acknowledge it.
Competitors: [ai_licia reacts to subs/raids/cheers](https://www.getailicia.com/ai-licia-for-twitch).
Why: was on the deferred triggers list; re-validated by ai_licia's success in the broadcaster-facing mirror. Low-risk — additive to existing trigger set.
Build cost: **M.**
Priority: Should-have v2.x.

### Theme E — Discovery & retention

**E1. "Who's hot this week" in the side-panel header**
One-line: tiny stat strip — "Baba has been the loudest critic in your last 3 sessions."
Competitors: Spotify Wrapped-style personalization; Character.AI's featured-characters surface.
Why: turns aggregate session data into a reason to open the panel again. Privacy-safe (all local). Pairs with A2.
Build cost: **S.**
Priority: Should-have v2.1.

**E2. Persona intro cards on first-session-with-a-pack**
One-line: first time a user swaps to a pack, the four personas each drop a 2-line introduction before live reactions start.
Competitors: [ai_licia character backstory](https://www.getailicia.com/ai-licia-for-twitch), Character.AI persona intros.
Why: the packs have rich RESEARCH.md personality docs users never see. A welcome-card moment per pack turns the pack swap from "new avatar" to "new cast I'm meeting." Dovetails with the v1.5.2 Editor's Note onboarding tour.
Build cost: **S.**
Priority: Should-have v2.x.

### Theme F — Multi-surface

**F1. Spotify Web Player support**
One-line: detect and attach to `open.spotify.com` tabs the same way the extension attaches to YouTube.
Competitors: [PodBrief works natively inside open.spotify.com](https://chromewebstore.google.com/detail/podbrief-%E2%80%94-ai-podcast-sum/abnkodnmoehkgphfcghabgdljefhbabk), [Sider tab-audio capture](https://sider.ai/extensions/podcast-transcript), [Notta live-tab transcription](https://www.notta.ai/).
Why: podcasts are the design center, and a large share of podcast listeners use Spotify. Same tab-capture pipeline; real work is (a) attach logic for the Spotify tab, (b) UI affordances when the active source is Spotify (no video thumbnail), (c) probably a pack recommendation ("Stern pack works well here" vs "TWiST pack for business shows"). Positioning: "the show that reacts to your podcast player, wherever you listen" — a genuine expansion of the addressable audience.
Build cost: **M.**
Priority: Should-have v2.x — first non-YouTube surface.

**F2. Twitch live-stream support**
One-line: attach to a Twitch tab the way the extension attaches to YouTube.
Competitors: ai_licia (broadcaster-facing), [Eklipse Twitch/Kick/YT auto-clip](https://eklipse.gg/features/automate-stream-clips/), [Highlight Analyzer YT + Twitch](https://highlight-analyzer.com/en).
Why: most streamers are already using ai_licia as a broadcaster tool; Peanut Gallery slots cleanly as the **audience-facing** mirror. A 4-persona peanut gallery reacting to a Twitch broadcast is on-brand and the pack slots map cleanly (producer = fact-checker on stream claims, troll = trolls the streamer, sfx = reacts to chat events, joker = bits).
Build cost: **M-L** (L if Twitch has tab-capture quirks).
Priority: Should-have v2.x.

---

## Nice-to-have features

**G1. Transcript timestamp scrubber in past-session view** — Click a line in a past session, YouTube jumps to that timestamp in a new tab. [Otter pattern](https://otter.ai/features). **Cost: S.** Nice-to-have v2.x.

**G2. Persona "quote of the session" auto-card** — At session end, each persona's best quip (by upvote or score) gets pre-rendered as a 4-up share card. Spotify Wrapped vibe. **Cost: S** (once A1 ships). Nice-to-have v2.x.

**G3. Danmaku floating overlay as optional view mode** — The Dmooji pattern. Already on the roadmap as deferred; validated by Bilibili's retention studies. **Cost: M.** Nice-to-have post-v2.0.

**G4. "Podcast newsletter" Markdown → Substack export** — Extension of the existing Markdown export. [Castmagic's blog-article export](https://www.castmagic.io/features) is the pattern. **Cost: S.** Nice-to-have.

**G5. Persona-reply chat ("reply to Baba")** — User types a one-liner back to a quip; the persona answers once. Otter-Chat-like but narrow. [Otter AI Chat pattern](https://otter.ai/chat). **Cost: M** — needs a guardrail layer because it's a user-injected prompt surface. Nice-to-have v2.x (be thoughtful about prompt-injection + war-zone restraint rule #6).

---

## Competitive gaps — opportunity space (nobody's doing this well)

1. **Podcast-native clip cards with persona reactions attached.** Particle clips the podcast audio; Peanut Gallery clips the audio *with four characters' takes baked into the card*. Nobody else in the podcast-clipping category has a persona layer. Differentiation wedge for A1 — we're not competing with Castmagic at podcast-clip production, we're shipping a card format the category doesn't have yet.
2. **Podcast-tuned reactor packs.** Dmooji has 10k+ anime characters (breadth); Peanut Gallery has packs tuned for podcast beats (depth). No one has bridged the two with a marketplace of *role-shaped* personas (producer / troll / sfx / joker archetype) rather than personality archetypes. Post-v2.0 Pack Lab / marketplace opportunity; [Poe with 1M+ custom bots](https://venturebeat.com/ai/poe-wants-to-be-the-app-store-of-conversational-ai-will-pay-chatbot-creators) and [Character.AI's roadmap](https://blog.character.ai/roadmap/) validate demand, but neither is shaped for reactive media.
3. **Sensitivity-as-first-class-setting for reactors.** Every tool has a mute button; nobody has shipped a credible "how much character do you want right now" dial. Obvious once you see it (B1). The Dmooji/ai_licia/Character.AI pattern is per-character intensity; Peanut Gallery can leapfrog with a global pacing control tied to real Director internals.
4. **Local-first privacy as a competitive claim.** Every competitor in the summary/transcript space uploads audio to their servers (Otter, Castmagic, Podcastle, Particle, Sider, Notta). Peanut Gallery's privacy posture is a marketable differentiator — but we're not currently using it as marketing copy. "Your podcast, your machine, no uploads" is a real hook for the crowd that isn't on Otter because they don't want their calls in the cloud.
5. **Event-driven triggers past silence + claims.** We fire on silence, claims, and cascade probabilities. ai_licia fires on follows/subs/raids/cheers; we could fire on YouTube chapter changes, ad breaks, chat spikes (D1 + D2). Nobody in the audience-facing reactor category has wired these triggers up; ai_licia owns broadcaster-facing.

---

## Prioritization tl;dr

If we can land five features before v2.0, they should be: **A1 (quote card), A2 (auto-highlights), B1 (sensitivity dial), C1 (upvote/downvote), C2 (pin favorite)**. Four S-sized + one M-sized; ~5–7 weeks aggregate. Everything else can wait for v2.x.

---

## Citations

### Direct reactor / co-viewing companions
- [Dmooji — Features](https://www.dmooji.ai/features) · [AI Danmaku](https://www.dmooji.ai/features/danmaku) · [Chrome Web Store](https://chromewebstore.google.com/detail/dmooji-youtube-danmaku-da/dcacgbaadlgfnmcpjncoobionpjnbnih)
- [ai_licia — Twitch co-host](https://www.getailicia.com/ai-licia-for-twitch) · [Overview](https://contentcreators.com/tools/ailicia)

### Podcast companions / transcription / clip tools
- [Castmagic Clip Generator](https://www.castmagic.io/tools/podcast-clip-generator) · [Features](https://www.castmagic.io/features)
- [Podcastle Clip Generator](https://podcastle.ai/tools/ai-podcast-clip-generator)
- [Otter Highlight Summary](https://otter.ai/blog/otters-new-highlight-summary-feature-turns-your-meeting-notes-into-a-summary-that-you-can-share) · [Features](https://otter.ai/features) · [AI Chat](https://help.otter.ai/hc/en-us/articles/19682180167575-Otter-AI-Chat-Overview) · [During live meeting](https://help.otter.ai/hc/en-us/articles/15113851067415-Using-Otter-Chat-during-a-live-meeting)
- [Particle — podcast clips (TechCrunch)](https://techcrunch.com/2026/02/23/particles-ai-news-app-listens-to-podcasts-for-interesting-clips-so-you-you-dont-have-to/)
- [PodBrief — Spotify](https://chromewebstore.google.com/detail/podbrief-%E2%80%94-ai-podcast-sum/abnkodnmoehkgphfcghabgdljefhbabk)
- [Sider — podcast transcript](https://sider.ai/extensions/podcast-transcript)

### Live-captioning, reactions, overlay
- [Bilibili — Wikipedia](https://en.wikipedia.org/wiki/Bilibili) · [Danmaku subtitling](https://grokipedia.com/page/Danmaku_subtitling)
- [Twitch Polls](https://help.twitch.tv/s/article/how-to-use-polls?language=en_US) · [StreamAlive — Twitch chat](https://www.streamalive.com/solutions/twitch)

### Stream highlight / auto-clip
- [Eklipse AI Highlights](https://eklipse.gg/features/ai-highlights/) · [Automate stream clips](https://eklipse.gg/features/automate-stream-clips/)
- [Highlight Analyzer — YT & Twitch](https://highlight-analyzer.com/en)

### Discord voice bots
- [SeaVoice](https://voice.seasalt.ai/discord/) · [NotesBot](https://www.notesbot.io/discord-transcription-bot) · [DiscMeet](https://discmeet.com/)

### Browser-extension summary / fact-check layers
- [Glasp YouTube summary](https://glasp.co/youtube-summary) · [Feature page](https://glasp.co/features/youtube-summary)
- [NewsGuard](https://www.newsguardtech.com/how-it-works/) · [Chrome Web Store](https://chromewebstore.google.com/detail/newsguard/hcgajcpgaalgpeholhdooeddllhedegi)

### Marketplace / community patterns
- [Poe — bot store (VentureBeat)](https://venturebeat.com/ai/poe-wants-to-be-the-app-store-of-conversational-ai-will-pay-chatbot-creators) · [Poe Creator Platform](https://creator.poe.com/docs)
- [Character.AI Roadmap](https://blog.character.ai/roadmap/)

### Upvote / downvote / feedback UX
- [ChatBotKit Feedback & Ratings](https://chatbotkit.com/features/feedback-and-ratings) · [Upvote/Downvote API changelog](https://chatbotkit.com/changelog/chatbotkit-introduces-upvote-and-downvote-apis-to-our-suite-of-tools)
