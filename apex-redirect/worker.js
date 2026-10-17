// Closes out peanutgallery.live after Railway hosting was cancelled (2026-10-15).
// - Bare peanutgallery.live: 301 to the same path on www., which GitHub Pages serves.
// - api.peanutgallery.live: the hosted backend is gone. Answer 410 with an `error` field,
//   which the extension shows as-is, and keep requests from reaching Railway's edge.
const GONE_MESSAGE =
  "Peanut Gallery's hosted server has been retired. Switch to Self-host in Backend & keys to keep using it.";

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (url.hostname === "api.peanutgallery.live") {
      return Response.json({ error: GONE_MESSAGE }, { status: 410, headers: { "Cache-Control": "no-store" } });
    }

    url.protocol = "https:";
    url.hostname = "www.peanutgallery.live";
    return Response.redirect(url.toString(), 301);
  },
};
