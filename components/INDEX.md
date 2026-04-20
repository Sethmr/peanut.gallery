# `components/` — React components

Used by the Next.js landing page. Parent: [`../INDEX.md`](../INDEX.md).

| File | Purpose |
|---|---|
| [`FadeInObserver.tsx`](FadeInObserver.tsx) | IntersectionObserver wrapper for landing-page scroll-reveals. |

## Notes

- The `/watch` reference demo and its components (`ApiKeysModal`, `CombinedFeed`, `PersonaColumn`, `PersonaIcon`, `TranscriptBar`, `YouTubePlayer`) were retired alongside `app/watch/` as part of the v1.5 "clean out the legacy web-app UI" work. The Chrome extension is the canonical UI now; the middleware at the Next.js app root 308-redirects any non-`/api/*` traffic to `www.peanutgallery.live`.
- `components/` stays for any React surface the landing page still needs. The Chrome extension itself is vanilla JS in [`../extension/`](../extension/) — do NOT try to import React components into the extension.
