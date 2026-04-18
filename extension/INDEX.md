# `extension/` — Chrome MV3 extension

Parent: [`../INDEX.md`](../INDEX.md). Install flow in [`README.md`](README.md). Architecture: [`../docs/CONTEXT.md`](../docs/CONTEXT.md) → "Chrome Extension" + [`../docs/SESSION-NOTES-2026-04-16.md §3`](../docs/SESSION-NOTES-2026-04-16.md) (immutable permissions / user-gesture contract).

Intentionally **unbundled** plain JS — no TypeScript, no build step. `npm run check:extension` runs `node --check` across every .js file as a minimal syntax gate, because `tsc` doesn't see this code.

## Files

| File | Role | Notes |
|---|---|---|
| [`manifest.json`](manifest.json) | MV3 manifest | `version` + `description` must match marketing. Description is capped at **132 chars** by CWS — current is 122. |
| [`background.js`](background.js) | Service worker | Icon click → opens side panel, requests `tabCapture`, manages offscreen document. Threads `packId` + `rate` + key headers → offscreen. |
| [`offscreen.js`](offscreen.js) | Offscreen document | Invisible page that owns the MediaRecorder + downsamples to 16 kHz PCM + posts chunks to `/api/transcribe`. Parses SSE, broadcasts to side panel. |
| [`offscreen.html`](offscreen.html) | Tiny shell for offscreen.js. | Do not put UI here. |
| [`sidepanel.html`](sidepanel.html) | Side-panel DOM + styles | Version badge at bottom must match `manifest.json#version`. Setup section is scrollable (v1.4 fix). |
| [`sidepanel.js`](sidepanel.js) | Side-panel controller | Owns `PACKS_CLIENT` dropdown, `PERSONAS` Proxy over active pack, firing-state bookkeeping, transcript rendering. Debug panel revealed via long-press (750 ms) on the version badge. |
| [`content.js`](content.js) | Content script on `peanutgallery.live/*` only | Used for the "already installed" pill the landing page shows when the extension is present. No YouTube page access. |
| [`icons/`](icons/) | 16/48/128 peanut icons | `_preview_*.png` and `_*.png` are excluded by the zip script (local-only). |
| [`README.md`](README.md) | Install + architecture summary for humans. |

## Key data flow

```
user clicks 🥜 icon
  → background.js opens side panel + gets tabCapture stream id
  → offscreen.js captures audio, downsamples, POSTs to /api/transcribe with SSE response
  → sidepanel.js renders transcript + persona reactions as SSE events arrive
```

## Packing for CWS

`scripts/pack-extension.sh` zips `extension/` into `releases/peanut-gallery-v<version>.zip`. Workaround for the sandbox's `rm` restriction on the zip target: build to `/tmp` first, then `cp` over the stale file.

## Manifest tripwires

- `description` max 132 chars. CWS rejects uploads over. Current is 122.
- `host_permissions` must list only `https://peanutgallery.live/*` (the content script target). YouTube access is via `optional_host_permissions` + `activeTab` + `tabCapture` — not static hosts.
- `background.service_worker` not `scripts` (MV3 requirement).
