# Chrome Web Store Screenshots — Shot List

Goal: knock out 3–5 screenshots in under 30 minutes. CWS requires **1280×800** (best) or 640×400. Up to 5 per listing; I'd ship 3 good ones before 5 mediocre ones.

---

## Before you start (2 min)

1. Resize your browser window to **exactly 1280×800**. Easiest way:
   - Open Chrome DevTools (⌥⌘I)
   - Click the device-toolbar icon (⌘⇧M)
   - Set dimensions to 1280 × 800, set DPR to 2
   - Close DevTools before capturing — device mode just locks viewport size, the capture still looks native

   Or use a window-resizer extension and eyeball it — CWS accepts anything 1280×800 ± a few pixels.

2. Make sure your dev server is running: `npm run dev` in the repo.

3. Load the extension (reload at `chrome://extensions` if you just rebuilt the icons).

4. Open a clean Chrome window — no other tabs, no bookmarks bar clutter. Hide the bookmarks bar: ⌘⇧B.

5. Capture method: **⌘⇧4 → Space → click the window**. macOS grabs the full window cleanly with the drop shadow.

---

## Source videos to use

Pick videos with talking-head content (not music videos — transcription won't fire). These are the ones I'd use in order:

| Shot | Video | Why |
|---|---|---|
| 1 | Any recent **TWiST** episode (`youtube.com/@twistartups`) | On-brand for the bounty. Jason says factually checkable things. |
| 2 | **All-In Podcast** — any episode | Multiple speakers, debate-heavy → personas fire a lot. |
| 3 | A **news clip** (CNBC / Bloomberg interview) | Fact-checker shines on stats/dates. |

For the screenshots, **don't use copyrighted music videos or movie clips** — reviewers get paranoid. Podcasts and interviews are fine.

---

## Shot 1 — Hero (the money shot)

**What:** YouTube video playing on the left, your side panel on the right with all 4 personas visible, 2–3 reactions already loaded, transcript scrolling.

**Setup:**
- Open a TWiST episode on YouTube
- Click the 🥜 toolbar icon → **Start Listening**
- Let it run 60–90 seconds so you get 3–4 persona responses in the feed
- Pause the YouTube video on a shot where Jason or Lon is clearly visible (not a title card, not an ad)

**Capture:** Full Chrome window at 1280×800.

**Filename:** `cws-01-hero.png`

---

## Shot 2 — Fact-checker catching a claim

**What:** Close-up feel — the side panel showing The Producer with a correction that includes a Brave Search snippet/source link.

**Setup:**
- Let it run until The Producer fires on a factual claim (dates, stats, company names trigger him reliably)
- Once you see a good correction with a source, pause YouTube
- Scroll the side panel so Baba's response is centered and fully visible
- If the YouTube video is distracting, that's fine — the side panel is the subject

**Capture:** Full window.

**Filename:** `cws-02-factcheck.png`

---

## Shot 3 — The writers' room cascade

**What:** A moment where multiple personas have all chimed in on the same segment. Shows the "4 voices, 1 conversation" value prop.

**Setup:**
- Wait for a segment where something provocative is said (opinion, prediction, spicy take)
- Once you see the Troll + Jackie + Fred all respond within ~5 seconds of each other, pause YouTube
- Scroll the side panel so all four speakers' recent responses are visible in one frame

**Capture:** Full window.

**Filename:** `cws-03-cascade.png`

---

## Shot 4 (optional) — Transcript + sine waves

**What:** Zoomed-in feel on the side panel showing the live transcript scrolling and the sine waves pulsing under a speaking persona.

**Setup:**
- With audio actively playing, grab a frame where exactly one persona is speaking (sine wave visible under their avatar)
- Transcript section should show 4–6 lines of recent speech

**Capture:** Full window. (Or crop to just the side panel + a sliver of video if it looks cleaner — CWS allows that too.)

**Filename:** `cws-04-transcript.png`

---

## Shot 5 (optional) — The idle state / first-run

**What:** Side panel open, **Start Listening** button prominent, empty feed with persona avatars showing. Sells the "it's about to happen" moment.

**Setup:**
- Open a YouTube video but *don't* click Start Listening yet
- Panel should show the 4 avatars and a clean empty state

**Capture:** Full window.

**Filename:** `cws-05-ready.png`

---

## If a shot doesn't land — common fixes

- **Side panel cuts off on the right.** Chrome's side panel has a fixed width. If the YouTube video is squeezed weird, go full-screen on YouTube first, then open the side panel; Chrome rebalances.
- **Persona responses are cringe or off-topic.** That's a feature of the product — leave it. But if one response embarrasses you, scroll past it before capturing.
- **Everything looks too dark.** Turn off YouTube's cinema mode (`T`), use the default player background.
- **Toolbar icon is the old peanut.** Reload the extension at `chrome://extensions` after regenerating icons.

---

## Where to save them

Drop all 5 PNGs in `marketing/screenshots/` (create the folder). Git-ignore if you don't want them in the repo, or commit them — they're useful for social posts too.

```
mkdir -p marketing/screenshots
# drag screenshots in from Desktop / wherever macOS saved them
```

---

## Uploading to CWS

Order matters — Shot 1 is the one most people see. In the CWS dev dashboard:

1. Listing tab → **Screenshots** section
2. Upload 3–5 in order: hero, fact-check, cascade, transcript, ready
3. The first one becomes the card preview in search results

Skip the "promotional tile" (440×280) for now — it's only required for featured placement, not submission.

---

**Time budget:** 25 minutes if everything cooperates. If a shot isn't working after 3 attempts, move on — 3 good screenshots beats 5 forced ones.
