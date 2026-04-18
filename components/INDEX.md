# `components/` — React components

Used by the Next.js landing + `/watch` pages. Parent: [`../INDEX.md`](../INDEX.md).

| File | Purpose |
|---|---|
| [`ApiKeysModal.tsx`](ApiKeysModal.tsx) | BYO-key modal used in `/watch`. Fields: Deepgram, Anthropic, xAI, Brave (optional). Scrollable when content overflows (v1.4 fix — adding xAI pushed the Save button off-screen on shorter viewports). |
| [`CombinedFeed.tsx`](CombinedFeed.tsx) | Merged feed view for the hosted `/watch` page. Interleaves transcript + persona reactions chronologically. |
| [`FadeInObserver.tsx`](FadeInObserver.tsx) | IntersectionObserver wrapper for landing-page scroll-reveals. |
| [`PersonaColumn.tsx`](PersonaColumn.tsx) | Single-persona column view (avatar + live-streaming reactions). |
| [`PersonaIcon.tsx`](PersonaIcon.tsx) | Avatar rendering with persona-tinted border + firing-state spinner. |
| [`TranscriptBar.tsx`](TranscriptBar.tsx) | Bottom-of-screen rolling transcript strip. |
| [`YouTubePlayer.tsx`](YouTubePlayer.tsx) | IFrame API wrapper. Types in [`../types/youtube.d.ts`](../types/youtube.d.ts). |

## Notes

- Anything user-facing here must stay in sync with the extension's sidepanel visual language. When one adds an affordance (e.g. the search-engine dropdown), the other should follow.
- `components/` is web-app scoped. The Chrome extension has its own vanilla-JS UI in [`../extension/`](../extension/) — do NOT try to import React components into the extension.
