# `extension/` — Chrome MV3 extension

Parent: [`../INDEX.md`](../INDEX.md). Install flow in [`README.md`](README.md). Architecture: [`../docs/CONTEXT.md`](../docs/CONTEXT.md) → "Chrome Extension" + [`../docs/SESSION-NOTES-2026-04-16.md §3`](../docs/SESSION-NOTES-2026-04-16.md) (immutable permissions / user-gesture contract).

Intentionally **unbundled** plain JS — no TypeScript, no build step. `npm run check:extension` runs `node --check` across every .js file as a minimal syntax gate, because `tsc` doesn't see this code.

## Files

| File | Role | Notes |
|---|---|---|
| [`manifest.json`](manifest.json) | MV3 manifest | `version` (currently `1.6.0`) + `description` must match marketing. Description is capped at **132 chars** by CWS — current is 122. Permissions: `tabCapture`, `offscreen`, `activeTab`, `storage`, `sidePanel`. `optional_host_permissions: ["http://*/*", "https://*/*"]` — this expansion beyond YouTube makes recording-consent law user-responsibility (see [Terms §5.1](../docs/legal/TERMS-OF-SERVICE.md)). |
| [`background.js`](background.js) | Service worker | Icon click → opens side panel, requests `tabCapture`, manages offscreen document. Threads `packId` + `rate` + key headers + `subscriptionKey` → offscreen. |
| [`offscreen.js`](offscreen.js) | Offscreen document | Invisible page that owns the MediaRecorder + downsamples to 16 kHz PCM + posts chunks to `/api/transcribe`. Parses SSE, broadcasts to side panel. |
| [`offscreen.html`](offscreen.html) | Tiny shell for offscreen.js. | Do not put UI here. |
| [`sidepanel.html`](sidepanel.html) | Side-panel DOM + styles | Version badge at bottom reads `chrome.runtime.getManifest().version` at runtime (PR #95) so it's never stale. Setup section is scrollable (v1.4 fix). Settings drawer footer carries direct links to Privacy / Terms / Security (v1.7). |
| [`sidepanel.js`](sidepanel.js) | Side-panel controller | 3.5k lines — owns `PACKS_CLIENT` dropdown, `PERSONAS` Proxy over active pack, firing-state bookkeeping, transcript rendering, feed-entry action menu, pinned strip, Room Volume dial, Plus subscription UI (backend-mode segmented control + key input + progress bar + checkout confirm flow), first-run tutorial. Debug panel revealed via long-press (750 ms) on the version badge. **TDZ tripwire:** new top-level blocks must not forward-reference later `const` DOM bindings — see [`feedback_sidepanel_tdz_lesson.md`](https://github.com/Sethmr/peanut.gallery/blob/develop/docs/DEBUGGING.md#issue-010-sidepanel-tdz--nothing-tappable-after-a-new-top-level-block). |
| [`session-store.js`](session-store.js) | v2.0 session-recall groundwork (v1.6) | Persists session metadata + transcript samples + persona reactions to `chrome.storage.local`. 50-session LRU, 4000-char transcript-tail cap, 15s debounce. Unbuilt UI surface — the v2.0 "Past sessions" drawer will read from this. |
| [`content.js`](content.js) | Content script on `peanutgallery.live/*` only | Bridge element read-back — the marketing site sets a DOM element the extension reads for session hand-off. **Do not widen the matches list.** No YouTube page access. |
| [`lib/quote-card.js`](lib/quote-card.js) | Quote-card PNG renderer (SET-23) | `OffscreenCanvas` + `document.fonts.ready` gate; SVG mascot via Blob URL (no eval, no remote fetches); CSS custom properties read live so Paper + Night themes render correctly. Copy-to-clipboard with download fallback. |
| [`icons/`](icons/) | 16/48/128 peanut icons | `_preview_*.png` and `_*.png` are excluded by the zip script (local-only). |
| [`README.md`](README.md) | Install + architecture summary for humans. |

## Key data flow

```
user clicks 🥜 icon
  → background.js opens side panel + gets tabCapture stream id
  → offscreen.js captures audio, downsamples, POSTs to /api/transcribe with SSE response
  → sidepanel.js renders transcript + persona reactions as SSE events arrive
  → feed-entry actions (upvote/downvote/pin/quote-card) post to /api/feedback
  → session-store.js mirrors transcript + reactions to chrome.storage.local for the (upcoming) Past Sessions UI
```

## Packing for CWS

`scripts/pack-extension.sh` zips `extension/` into `releases/peanut-gallery-v<version>.zip`. Workaround for the sandbox's `rm` restriction on the zip target: build to `/tmp` first, then `cp` over the stale file.

## Manifest tripwires

- `description` max 132 chars. CWS rejects uploads over. Current is 122.
- `host_permissions` lists only the `peanutgallery.live` subdomains (content script + future-hosted-API targets). Wider tab access uses `optional_host_permissions: http(s)://*/*` + `activeTab` + `tabCapture` — **not** static hosts.
- `background.service_worker` not `scripts` (MV3 requirement).

## Things outside the extension that break if the manifest changes

- The landing page at `www.peanutgallery.live` has an "already installed" pill that relies on the `content.js` match list. Widen the match list → update the pill detection.
- The Chrome Web Store "Privacy practices" tab must match `docs/legal/PRIVACY-POLICY.md` § "Extension permissions." Any permission change is a re-submission.
- Plus subscription drawer (`sidepanel.html` + `sidepanel.js`) sends `X-Subscription-Key` on every hosted-mode request. The backend `/api/transcribe` gates on this header — don't silently rename.
