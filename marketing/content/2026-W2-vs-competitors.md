---
status: draft
author: Peanut Gallery team
drafted: 2026-04-18
target_publish: Week 2 (2026-04-20 to 2026-04-26)
route: /blog/peanut-gallery-vs-notegpt-vs-glasp
slug: peanut-gallery-vs-notegpt-vs-glasp
title: "Peanut Gallery vs NoteGPT vs Glasp: AI for YouTube"
meta_description: "Peanut Gallery, NoteGPT, and Glasp compared — three ways to add AI to YouTube. Summaries, reactions, annotations, and what each tool is actually for."
primary_keywords:
  - peanut gallery vs notegpt
  - notegpt alternative
  - glasp alternative
  - ai youtube chrome extension
  - chrome side panel ai
secondary_keywords:
  - live ai reactions youtube
  - youtube summary extension
  - ai companion youtube
  - open source youtube ai extension
  - youtube ai extension no login
word_count_target: 1800–2200
cws_compliance_checked: 2026-04-18
compliance_notes: |
  Vetted against marketing/CWS-COMPLIANCE-CHECKLIST.md sections C1, C3, D1, F.
  - No "best" / "#1" / "top-rated" claims
  - No implied endorsement by YouTube, Google, Anthropic, xAI, Deepgram
  - Persona names referenced with "inspired by" framing only
  - Competitor user counts dated + sourced to chrome-stats.com (2026-04-18 pull)
  - Feature claims match shipping code per 2026-04-18 on-page audit
  - Tone is comparative, not disparaging — honest about what we don't do
---

# Peanut Gallery vs NoteGPT vs Glasp: AI for YouTube

*Last updated: 2026-04-18*

If you've searched "AI extension for YouTube" in the last year, you've probably bumped into Glasp and NoteGPT. They're the two largest players in the Chrome Web Store for AI-on-YouTube, with roughly 2,000,000 and 400,000 users respectively as of 2026-04-18. Peanut Gallery is the new one in the room — a free, open-source Chrome extension that does something neither of those two does.

Before going further: this isn't a ranking. These three tools solve different problems. The point of this post is to make that difference clear, so you can pick the right one — or run two of them side by side, which is genuinely the most reasonable answer for a lot of people.

## TL;DR

- **NoteGPT** and **Glasp** are **summarizers**. You watch a video, they produce a written summary (and in NoteGPT's case, mind maps, chat, and notes). They're optimized for *after* you've watched, or for deciding *whether* to watch.
- **Peanut Gallery** is a **live reactions sidebar**. Four AI personas — a fact-checker, a troll, a comedy writer, and a sound guy, each inspired by an archetype from talk-radio / tech-podcast culture — react in Chrome's native Side Panel while the video plays. It's optimized for the experience *during* watching.
- If you mostly want to skip to the key takeaways of a 90-minute interview, use a summarizer. If you want commentary alongside the stream, Peanut Gallery is the only one in this group that does that.

## The category divergence

Most YouTube-AI extensions have converged on a shared playbook: transcript extraction → LLM summary → post-watch UI. It's a good playbook. Summaries are useful. The category leaders — Glasp at 2M users, NoteGPT at 400K, Eightify at 200K — all compete inside that playbook.

Peanut Gallery sits in a different category entirely. Rather than replacing the watch experience with a read experience, it augments the watch experience with four concurrent running commentaries. The design goal is closer to a podcast co-host than a research assistant.

That's why a head-to-head feature table below reads strangely: the three tools share an input (a YouTube video) and a surface (a Chrome extension), but the outputs barely overlap. Reading the table as "which one is best" will mislead you; reading it as "which job is each one doing" will help you pick.

## Feature comparison

| Attribute | **Peanut Gallery** | NoteGPT | Glasp |
|---|---|---|---|
| **What it does** | 4 AI personas react live while you watch | Summary, mind map, notes, AI chat on video transcript | Summary, highlight extraction, note sharing |
| **When it runs** | During the video | After / while pausing | After / while pausing |
| **Output format** | Streaming reactions in a side panel | Summary card, mind map, searchable notes | Summary + highlights for social/note sharing |
| **UI surface** | Chrome's native Side Panel API | DOM-injected overlay on the page *(changed from side panel in July 2025)* | DOM-injected overlay + companion web app |
| **Works on live streams** | Yes (core design target) | No (requires finished transcript) | No (requires finished transcript) |
| **Requires sign-up / login** | No | Yes (Google or email) | Yes (Google or email) |
| **Account required to use core features** | No | Yes | Yes |
| **Pricing model** | Free. Bring your own API keys. | Free tier + paid plans | Free tier + paid plans |
| **Data handling** | Audio captured locally via `chrome.tabCapture` after explicit click; keys stored in `chrome.storage.local`; no analytics | Transcripts and summaries stored on NoteGPT servers (per their policy) | Content stored on Glasp servers (per their policy) |
| **License / source** | MIT, self-hostable, [source on GitHub](https://github.com/Sethmr/peanut.gallery) | Proprietary SaaS | Proprietary SaaS |
| **CWS user count (2026-04-18)** | New — growing | ~400,000 | ~2,000,000 |
| **CWS category** | Productivity | Tools | — |
| **Core Chrome permissions** | `sidePanel`, `tabCapture`, `storage` | `scripting`, host permissions *(as of July 2025)* | Host permissions, `storage` |
| **Number of AI personas / voices** | 4, distinct personalities | 1 assistant | 1 assistant |
| **Opinionated tone** | Yes, varies per persona | Neutral | Neutral |
| **Fact-checking called out as a feature** | Yes (dedicated persona) | No (general Q&A only) | No |

*Sources: [chrome-stats.com public install counts](https://chrome-stats.com/), the extensions' own Chrome Web Store listings, and the shipping manifests (for Peanut Gallery, [`extension/manifest.json`](https://github.com/Sethmr/peanut.gallery/blob/main/extension/manifest.json)). Numbers are point-in-time; for live counts check the Chrome Web Store directly.*

## When to pick each one

### Pick NoteGPT if…

You watch a lot of long-form content (interviews, lectures, podcasts) and want to triage whether it's worth the time, or bank a written record of the ones that were. NoteGPT's mind-map output is a distinctive feature. The note-taking layer integrates with their web app for cross-video synthesis, which matters if you use YouTube as a primary learning surface. You're willing to sign up for an account and send transcripts to NoteGPT's servers for processing.

### Pick Glasp if…

You already share highlights from web articles on Glasp's community platform and want to fold video highlights into the same stream. The strongest part of Glasp is the social/commonplace-book layer — a public, searchable record of what you've learned, linked to other people doing the same. If you're not using that layer, Glasp's summarizer alone is less differentiated than NoteGPT's feature set.

### Pick Peanut Gallery if…

You watch a specific video or show and wish there was someone next to you reacting to it — calling out the claims, cracking jokes, adding context. The four personas are deliberately not neutral; a fact-checker and a comedy writer have different jobs, and you hear from both. The extension works on live streams, which summarizers by definition can't. You don't want to create an account or send transcripts to a third party.

### Use two of them if…

Running Peanut Gallery *during* a long video and a summarizer *after* is a completely reasonable workflow. They live in different surfaces (Peanut Gallery in Chrome's native Side Panel, NoteGPT/Glasp as overlays on the page) and don't compete for the same real estate on screen.

## The side panel question

There's one detail in the table above that deserves its own paragraph: NoteGPT originally used Chrome's `sidePanel` API — the same surface Peanut Gallery uses — and then removed it in a July 2025 release. They replaced it with a DOM-injected sidebar triggered by a floating logo on each page.

It's not a signal that Chrome is deprecating the Side Panel API (Chrome 140 actually added new Side Panel features late in 2025). It's a product-design choice. NoteGPT runs across articles, PDFs, Twitter, and YouTube; a DOM overlay that anchors to the page's content frame is more flexible than a fixed right-side drawer when you're optimizing for that many surfaces.

Peanut Gallery made the opposite choice for the opposite reason. The extension is built around a single-surface experience — you're watching a YouTube video, and you want commentary next to it, not layered on top of it. Chrome's native Side Panel:

- Doesn't cover the video or change the page's layout.
- Persists as you switch between YouTube tabs.
- Isn't blocked by page-level Content Security Policies or fullscreen takeovers.

Both approaches are legitimate. Which one you prefer depends on what you're optimizing for.

## Open source and "bring your own keys"

Another table row worth pulling out: Peanut Gallery is MIT-licensed and the full source is on GitHub. NoteGPT and Glasp are proprietary SaaS.

That matters for three groups of people:

1. **Privacy-cautious users.** Peanut Gallery captures video audio via `chrome.tabCapture` only after you click Start Listening, sends it to Deepgram for transcription, and sends transcript chunks to Anthropic / xAI / Brave depending on the persona — all using your own API keys, which live only in your browser's local storage. None of that traffic goes through a Peanut Gallery server, because there isn't one. The extension also ships a self-hostable reference web app (the same code that powers [/watch](/watch) on peanutgallery.live), which you can run locally if you prefer.
2. **People in locked-down environments.** If your employer blocks third-party SaaS but allows browser extensions with bring-your-own-key models, Peanut Gallery clears that gate more easily than NoteGPT or Glasp do.
3. **Developers who want to fork.** The four personas are separate modules. Adding a fifth persona — or tuning the existing ones for a different kind of content (a code review persona for YouTube programming videos, for example) — is a one-file change.

The tradeoff: bring-your-own-keys has an onboarding cost that "sign in with Google" doesn't. If you don't already have an Anthropic, xAI, and Deepgram account, getting to the first reaction takes more than zero minutes. NoteGPT and Glasp's onboarding is genuinely faster. We think the tradeoff is worth it; not every user will.

## Permissions and trust

For anyone auditing Chrome extensions before installing, here's what each one asks for:

**Peanut Gallery** requests: `sidePanel` (the native side-panel surface itself), `tabCapture` (to read audio from the YouTube tab you're watching, initiated by a user click), `storage` (to save your API keys locally), and host permissions scoped to YouTube domains. No `webRequest`, no `cookies`, no `management`. Full justification is in the [Chrome Web Store listing](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh) and in [`extension/manifest.json`](https://github.com/Sethmr/peanut.gallery/blob/main/extension/manifest.json).

**NoteGPT** requests scripting + broad host permissions (needed to inject its overlay UI onto many kinds of pages). This is a reasonable scope for what NoteGPT does, but it's broader than Peanut Gallery's scope.

**Glasp** similarly requires host permissions across the sites it highlights on.

Broader permissions aren't automatically worse — they match what each extension is built to do. But if you're the kind of user who reads the "permissions this extension needs" dialog and asks what each one is for, Peanut Gallery's request list is shorter and more specific.

## What Peanut Gallery doesn't do

To keep this comparison honest:

- **It doesn't write post-watch summaries.** If you want a one-paragraph TL;DR after the video is over, a summarizer does that better. We've considered adding a fifth "recap" persona that runs at the end of a video; it's on the roadmap but not shipping yet.
- **It doesn't store your notes across videos.** Peanut Gallery is a live, in-the-moment experience. NoteGPT's note-taking layer and Glasp's highlight stream are durable records; we aren't trying to be that.
- **It doesn't have a community layer.** Glasp's social graph — see what other people highlighted on the same article or video — is a distinctive feature. Peanut Gallery is single-user by design.
- **It's newer and smaller.** Glasp has 2M users and several years of iteration. We have fewer and shipped in 2026. If you value a long track record of updates and a large Chrome Web Store review base, that's a point for the incumbents.

## FAQ

**Can I use Peanut Gallery and NoteGPT together?**
Yes. They live in different surfaces (native side panel vs. overlay) and don't conflict. A common workflow: Peanut Gallery during a long interview, NoteGPT afterward for the written summary.

**Does Peanut Gallery work on live streams?**
Yes. Because it captures the tab's audio in real time and streams transcription to Deepgram, live broadcasts work the same as recorded videos. Summarizers that depend on finished transcripts can't do this.

**What AI models does Peanut Gallery use?**
Transcription is via Deepgram. Persona reactions currently use a mix of Anthropic's Claude and xAI's Grok models, with one persona (the fact-checker) optionally using Brave Search for current-events context. All of these run on your own API keys.

**Is Peanut Gallery really free?**
The extension itself is $0 and open source. You pay whatever Deepgram and the LLM providers charge for your own usage. For typical viewing patterns, that's in the cents-per-hour range on most model choices.

**Can I self-host Peanut Gallery?**
Yes. The reference web app at [peanutgallery.live/watch](/watch) is the same code you can run locally from the [GitHub repo](https://github.com/Sethmr/peanut.gallery). The Chrome extension installs independently.

**Why four personas instead of one?**
Different voices notice different things. A fact-checker persona is good at spotting dodgy claims; a comedy writer is good at spotting setup-payoff structures; a sound guy is good at catching audio cues; a troll is good at deflating self-important moments. Running them in parallel turns out to feel more like a group chat than like a single assistant, and that turned out to be the more interesting experience.

## The bottom line

If you're trying to pick one and move on:

- Watching long interviews and podcasts for information you need to retain? **NoteGPT or Glasp.**
- Want the watching experience itself to be better — livelier, more scrutinized, funnier? **[Install Peanut Gallery](/install).**
- Running a live stream or event recording? Peanut Gallery is the only one of the three that handles live.

If you want to try Peanut Gallery, it's [free in the Chrome Web Store](https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh). MIT license, no account required, bring your own API keys.

---

## Publishing checklist (for whoever ships this)

Before publishing this post live:

1. **CWS compliance re-check.** Walk the quick-vet gate in [`marketing/CWS-COMPLIANCE-CHECKLIST.md`](../CWS-COMPLIANCE-CHECKLIST.md) one more time against the final copy. Confirm no "best / #1 / top-rated" slipped back in, no implied endorsements, competitor user-count numbers still accurate on the publish date (re-pull from chrome-stats.com if >2 weeks since draft).
2. **Fact-check competitor claims.** NoteGPT and Glasp feature sets may have shifted — re-read their CWS listings on the publish date and reconcile any drift. Especially check: Does NoteGPT still use a DOM-injected overlay? Does Glasp still require login for core features? Have user counts crossed any round number worth updating?
3. **Internal links.** Confirm `/install`, `/watch`, `/privacy`, and the CWS URL all resolve. Link to the [source code](https://github.com/Sethmr/peanut.gallery) and the [manifest](https://github.com/Sethmr/peanut.gallery/blob/main/extension/manifest.json).
4. **JSON-LD.** When this post gets a blog route, add:
   - `BlogPosting` with `author`, `datePublished`, `dateModified`, `headline`, `image`, `publisher` (Organization node from the existing graph).
   - `BreadcrumbList`: Home → Blog → This post.
   - `FAQPage` using the 6 Q&As above (each under 300 chars per FAQ — ours are fine).
   - Avoid `AggregateRating` unless we have real ratings to cite.
5. **Canonical URL.** Set `alternates.canonical` to the final live URL in the blog layout's `metadata` export.
6. **Sitemap + IndexNow.** After publish, add to `public/sitemap.xml` and submit to Bing IndexNow so the post is indexed within hours rather than days.
7. **Social preview image.** 1200×630 OG image with the post title. Use the same typography system as the homepage hero for brand consistency.
8. **Comment period.** Don't enable comments for v1. If we add them later, moderate for the usual compare-post pitfalls (astroturfing from either direction).

## Data provenance

All numbers and claims in this post trace back to:

- [`marketing/baselines/2026-04-18-competitor-landscape.md`](../baselines/2026-04-18-competitor-landscape.md) — chrome-stats.com pulls dated 2026-04-18 for NoteGPT, Glasp, Eightify, Dmooji.
- [`marketing/baselines/2026-04-18-notegpt-sidepanel-investigation.md`](../baselines/2026-04-18-notegpt-sidepanel-investigation.md) — full context on the July 2025 NoteGPT side-panel removal.
- [`extension/manifest.json`](../../extension/manifest.json) — permissions authoritative for Peanut Gallery.
- [`app/privacy/page.tsx`](../../app/privacy/page.tsx) — data handling claims.

If any competitor updates its extension materially before publish, revise the numbers before shipping — don't ship a stale table.
