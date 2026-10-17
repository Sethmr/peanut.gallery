# apex-redirect

Cloudflare Worker `peanutgallery-apex-redirect` that closes out the hosted backend after Railway hosting was
cancelled on 2026-10-15. Deployed 2026-10-16.

| Route | Behavior |
|---|---|
| `peanutgallery.live/*` | 301 to the same path and query on `https://www.peanutgallery.live` (GitHub Pages). The Railway app used to do this. |
| `api.peanutgallery.live/*` | 410 JSON `{"error": "...retired. Switch to Self-host..."}`. The extension shows the `error` field, so Demo and My keys users see why it stopped. |

Both routes sit on proxied DNS records, so no request reaches the old Railway origin. The DNS records still
point at Railway; the Worker routes are what keep them from mattering.

Deploy (Wrangler logged in as seth@manugames.com, the account that owns the zone):

    npx wrangler deploy

Check:

    curl -sI https://peanutgallery.live/privacy
    curl -s https://api.peanutgallery.live/api/transcribe
