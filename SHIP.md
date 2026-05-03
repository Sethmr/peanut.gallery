# SHIP.md — Peanut Gallery Launch Checklist

Everything you need to ship. Copy-paste-ready text for every form field, ordered by priority (win the bounty first, Chrome Web Store second).

---

## What's already done (no action needed)

- `extension/manifest.json` cleaned up — permissions trimmed, dead domain (`peanut.gallery` → `peanutgallery.live`) fixed, description rewritten for CWS.
- `/privacy` page created at `app/privacy/page.tsx`. Will live at `https://peanutgallery.live/privacy` after deploy.
- Footer on the landing page links to `/privacy`.
- `sitemap.ts` updated to include `/privacy` and `/watch`.
- `scripts/pack-extension.sh` will zip `extension/` → `releases/peanut-gallery-v<version>.zip` for CWS upload.
- Icons verified: 16x16, 48x48, 128x128 PNGs present in `extension/icons/`.

---

## Phase 1 — Win the bounty (do this today)

### 1.1 Final cold-start smoke test (10 min)

On a fresh Chrome profile:

```
git pull
./setup.sh
npm run dev
```

In Chrome:

1. `chrome://extensions` → Developer mode on → Load unpacked → select `extension/`
2. Open a TWiST episode on YouTube
3. Click the 🥜 toolbar icon → side panel opens
4. Click **Start Listening**
5. Verify: transcript appears, at least one persona reacts, you still hear YouTube audio
6. Click **Stop** → everything resets cleanly

If any of that breaks, fix before tweeting. This is what a judge will do.

### 1.2 Deploy the updated landing to peanutgallery.live (5 min)

```
# From repo root
npx @railway/cli up
```

Then visit `https://peanutgallery.live` and confirm:

- Hero reads **"Live — Chrome Extension Shipping"**
- Primary CTA reads **"Install the Extension"**
- The Install section with 4 numbered cards is visible
- `https://peanutgallery.live/privacy` loads (GA will index this)

### 1.3 Record the demo video (20–30 min)

**Target length:** 60–90 seconds. Jason has a goldfish attention span for anything that isn't the product doing the thing.

**Shot list:**

1. **0:00–0:05** — Title card: "Peanut Gallery. The TWiST bounty, shipped."
2. **0:05–0:20** — Open a recent TWiST clip on YouTube. Click the 🥜 icon. Side panel slides in. Click Start Listening.
3. **0:20–0:55** — Just let it run. Don't narrate. The point is: Jason says something, The Producer fact-checks it, the Troll dunks, Jackie lands a punchline. Let the product speak.
4. **0:55–1:10** — Brief cut to the landing page at peanutgallery.live showing "Install the Extension."
5. **1:10–1:20** — End card: `peanutgallery.live` / `github.com/Sethmr/peanut.gallery` / MIT.

**Tool suggestion:** macOS built-in screen recording (Cmd+Shift+5) with mic off, then trim in QuickTime. Don't over-produce. Jason retweets raw product demos, not polished pitches.

**Upload to:** Twitter/X directly as a video attachment (up to 2:20 for blue-check accounts, 140s otherwise). Also upload to YouTube as an unlisted video for the GitHub README.

### 1.4 Send the bounty tweet

**Copy (pick one):**

**Option A — direct:**

> @jason @LonHarris — here's the TWiST bounty, shipped.
>
> Chrome extension. Opens a native side panel next to any YouTube video. 4 AI personas watching the show with you in real-time: a fact-checker (Claude + Brave Search), a sound effects guy, a comedy writer, and a cynical troll.
>
> Silent tab capture. No picker. ~$1.15/episode.
>
> Open source, MIT. BYO keys.
>
> peanutgallery.live
> github.com/Sethmr/peanut.gallery
>
> [attach video]

**Option B — opener-first (stronger hook):**

> You know how every AI video tool makes you screen-share your own tab? Mine doesn't.
>
> @jason @LonHarris — the TWiST bounty. 4 AI personas react to any YouTube video from a Chrome side panel. Silent tab capture, native sidebar, open source.
>
> peanutgallery.live
>
> [attach video]

**Option C — the The Producer opener:**

> @jason — The Producer just told me Uber was founded in 2007 (it was 2009, per the Jason Calacanis podcast archive). He's not wrong.
>
> The TWiST bounty: 4 AI personas watching your podcast, live. Chrome extension, native side panel, open source.
>
> peanutgallery.live
>
> [attach video]

**My pick:** Option B. It leads with the novel thing (no screen-share picker) and the credits Jason already. Don't use C unless the demo actually shows The Producer making that specific call.

**Time of day:** Tuesday–Thursday, 10am–12pm PT. Matches when Jason is usually active on X.

### 1.5 Side channels (bonus, post-tweet)

- **Show HN:** "Show HN: Peanut Gallery — Chrome extension with 4 AI personas that react to any YouTube video" → link to peanutgallery.live. Post 8–11am PT Tuesday or Wednesday for best decay curve.
- **r/SideProject and r/LocalLLaMA** — same hook, different framing per sub. Mention the silent tab capture for /r/chrome.
- **@TWiStartups reply:** quote-tweet your own submission from a second account or just reply with "pinning this in case anyone else submits 👀"

---

## Phase 2 — Chrome Web Store submission

You already paid the $5. Now the paperwork. Allow ~45 minutes.

### 2.1 Pack the extension

```
./scripts/pack-extension.sh
```

That writes `releases/peanut-gallery-v1.0.0.zip`. Upload this file, not the parent folder.

### 2.2 Assets you need to make manually

| Asset | Size | Required? | Notes |
|---|---|---|---|
| Small promo tile | **440 × 280** | Yes | Peanut icon + "Your podcast's AI writers' room" |
| Marquee promo tile | 1400 × 560 | Optional | Only if you want featured placement |
| Screenshots | **1280 × 800** or **640 × 400** | Yes, at least 1 (up to 5) | Side panel in action |

**Screenshot shot list (take 3–5):**

1. Side panel open next to a YouTube video, transcript flowing, one persona mid-reaction.
2. All 4 persona avatars with one glowing + sine wave active.
3. Install / setup view (the server URL + API key fields).
4. A feed with 2–3 persona entries stacked.
5. (Optional) The peanutgallery.live landing page in a browser.

Retina screen: shoot at 2x, export at 1280x800. macOS: Cmd+Shift+4 → Space → click the window. Then edit in Preview → Tools → Adjust Size if needed.

### 2.3 Store listing copy (paste these into the CWS form)

**Extension name:**

```
Peanut Gallery
```

**Short description (max 132 chars):**

```
Watch any YouTube video with an AI writers' room. 4 personas react in real-time in a native Chrome side panel.
```

**Detailed description (paste as-is):**

```
Peanut Gallery is an AI writers' room for your podcasts. 4 personas watch any YouTube video alongside you — a fact-checker, a sound effects guy, a comedy writer, and a cynical troll — reacting live in Chrome's native side panel, with no tab switching and no screen-share picker.

Built for long-form talk shows, interviews, and pods — where a booth producer actually adds something. Inspired by the Morning Crew. Two packs ship out of the box; swap between them in the side panel per session.

THE HOWARD PACK (default)
• The Producer — fact-checker (Claude Haiku + Brave Search or xAI Live Search). Mid-show corrections and background data on every claim.
• The Sound Guy — sound effects guy (xAI Grok 4.1 Fast). Well-timed cues and the occasional razor-sharp aside.
• The Joke Writer — comedy writer (Claude Haiku). Setup-punchline jokes and callbacks.
• The Cynical Troll — contrarian commentator (xAI Grok 4.1 Fast, non-reasoning). Says what the chat is thinking.

THE TWIST PACK (swap in the side panel)
Tuned for This Week in Startups-style podcasts — Molly Wood (producer), Jason Calacanis (troll), Lon Harris (sound effects), and Alex Wilhelm (joker). Same 4 roles, startup vocabulary.

HOW IT WORKS
1. Click the peanut icon on any YouTube tab → a native Chrome side panel opens.
2. Click Start Listening. Tab audio is captured silently via chrome.tabCapture — the same API used by Otter.ai, Fireflies, and Recall.ai. No permission picker, no interference with playback. You hear the video; the AI hears it too.
3. Audio streams to a local server (run with `npm run dev`), which handles transcription via Deepgram Nova-3 and routes 250ms chunks through an AI director. The director picks one persona to react, then cascades to others with staggered delays — like a real writers' room.
4. Responses stream back token-by-token via Server-Sent Events and appear in the side panel alongside the transcript.

OPEN SOURCE — BRING YOUR OWN KEYS
Peanut Gallery is MIT licensed. Your API keys (Deepgram, Anthropic, xAI, optionally Brave Search) live in chrome.storage.local on your machine and are passed directly to your own server. Nothing is logged, nothing is persisted, nothing is sent to a third party beyond the AI providers you configure.

Source + install instructions: https://github.com/Sethmr/peanut.gallery
Hosted reference web app: https://peanutgallery.live

COST
~$1.15 per 2-hour episode across all four providers at current rates.

BUILT FOR
The $5,000 This Week in Startups bounty from Jason Calacanis and Lon Harris. @TWiStartups.
```

**Category:**

```
Productivity
```
(secondary: Developer Tools)

**Language:**

```
English
```

### 2.4 Privacy Practices tab

**Single purpose description:**

```
Capture audio from the current browser tab so it can be transcribed in real-time and used to generate AI persona reactions that appear in the Chrome side panel next to the video.
```

**Justification for each permission** (CWS will ask for each — paste these):

- **`tabCapture`** —
  ```
  Required to capture audio from the active YouTube (or other video) tab using chrome.tabCapture.getMediaStreamId. The captured audio is streamed to the user's configured server for real-time transcription by Deepgram and is never written to disk. Capture is only initiated after the user explicitly clicks "Start Listening" in the side panel and ends immediately when they click Stop or close the tab.
  ```

- **`offscreen`** —
  ```
  Required to host an invisible offscreen document that runs the AudioContext / getUserMedia pipeline. Service workers cannot use these APIs; the offscreen document is the Chrome-recommended pattern for MV3 extensions that need to process media.
  ```

- **`activeTab`** —
  ```
  Granted when the user clicks the extension toolbar icon, scoping tabCapture.getMediaStreamId to only that tab. Prevents the extension from capturing audio from any tab the user hasn't explicitly activated it on.
  ```

- **`storage`** —
  ```
  Stores the user's server URL and API keys (Deepgram, Anthropic, xAI, optional Brave Search) plus the selected search-engine preference (`brave` or `xai`) in chrome.storage.local so they don't have to retype them every session. Stores a pending tabCapture stream ID in chrome.storage.session (cleared on browser restart). Nothing is synced, nothing leaves the browser except via the user's own fetch calls to their configured server.
  ```

- **`sidePanel`** —
  ```
  Opens the extension UI (transcript, persona avatars, response feed) in Chrome's native side panel next to the video, rather than in a popup or separate tab. This is the primary UI surface of the extension.
  ```

- **`host_permissions` for `https://peanutgallery.live/*`** —
  ```
  The extension streams audio and receives Server-Sent Events from the hosted reference implementation at peanutgallery.live. This is the only host granted at install time.
  ```

- **`optional_host_permissions` for `http://*/*` and `https://*/*`** —
  ```
  Users who self-host the open-source Peanut Gallery server (localhost during development, or their own deployed domain for full privacy) can point the extension at that server via a URL field in the UI. When they click Start Listening, the extension calls chrome.permissions.request() in response to that user gesture, triggering Chrome's standard permission dialog for that specific origin. No broad host access is granted at install time — permission is requested per-origin, only when the user opts in.
  ```

**"Remote code" question:**

```
No — the extension does not execute remote code. All JavaScript that runs is shipped in the extension package. Server responses (SSE events) are treated purely as data and rendered as escaped text in the side panel.
```

**Data usage disclosure (tick these boxes):**

- I do not sell user data to third parties ✅
- I do not use/transfer user data for purposes unrelated to the extension's single purpose ✅
- I do not use/transfer user data to determine creditworthiness or for lending ✅

**Privacy policy URL:**

```
https://peanutgallery.live/privacy
```

### 2.5 Distribution tab

- **Visibility:** Public.
- **Geography:** All regions.
- **Mature content:** No.
- **Pricing:** Free.

### 2.6 Submit

Click **Submit for review**. Reviews on first submissions with audio capture typically take 1–7 days. Chrome will email you. If it's rejected, the email will cite the specific policy — most first-timer rejections are either (a) permission justifications that were too terse (the text above is not terse) or (b) screenshots that don't match the description. Both are easy fixes.

---

## Phase 3 — After you've submitted

### 3.1 Tag everything

```
git tag v1.0.0
git push --tags
```

Create a GitHub release from the tag with the zip attached. People occasionally install extensions from GitHub releases.

### 3.2 Wait for CWS review

1–7 days. Approve email → your extension gets a public store URL. Update the landing page hero CTA from "Install the Extension" (dev mode) to "Add to Chrome" (store link).

### 3.3 Post the store link

- Quote-tweet your original bounty submission with the new store URL.
- Update the README install section to lead with "Add to Chrome" above the dev-mode instructions.
- DM @jason the store link, in case he missed the original tweet.

---

## Post-ship niceties (optional, whenever)

- `git add releases/ && echo "releases/" >> .gitignore` — don't commit zips.
- Add a `CHANGELOG.md` with v1.0.0 entry.
- File 3–5 GitHub issues for the obvious v1.1 work (CWS promo assets, more personas, custom prompts, etc.) so the repo looks alive.

---

_Built with Claude. Shipped by Seth._
