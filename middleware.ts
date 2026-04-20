import { NextRequest, NextResponse } from "next/server";

/**
 * Peanut Gallery — kill the legacy marketing UI at peanutgallery.live
 *
 * Context: before v1.5 we served marketing + install + /watch demo out of
 * this Next.js app at the apex peanutgallery.live. The v1.5 line moved the
 * canonical public site to the static peanut.gallery.site repo, deployed at
 * https://www.peanutgallery.live via GitHub Pages. Both now live, so apex
 * is duplicate content fighting www for SEO ranking (the v1.5 ROADMAP step
 * 3 said "clean out the legacy web-app UI" — this is that cleanup).
 *
 * What this does:
 * - /api/* passes through untouched. That's the backend the Chrome
 *   extension streams audio / SSE against. NEVER redirect it.
 * - Every other path (marketing homepage, /watch, /install, /privacy,
 *   /sitemap.xml, /robots.txt, /favicon requests, etc.) 308-redirects to
 *   the same path on https://www.peanutgallery.live.
 *
 * Why 308 (Permanent Redirect): Google collapses 308-chained URLs into the
 * target and drops the source from the index. Unlike 302, 308 preserves
 * the original HTTP method, so any third-party link hitting /install with
 * a POST doesn't silently lose its body. We're serving GET marketing here
 * either way; the method-preserving safety is belt-and-suspenders.
 *
 * Why a host-agnostic redirect (applies whether the request came in via
 * peanutgallery.live or api.peanutgallery.live): api.peanutgallery.live
 * shouldn't serve anything except /api/* anyway. If someone hits
 * api.peanutgallery.live/random, redirecting them to
 * www.peanutgallery.live/random is still the right behavior — they'll get
 * a clean 404 from the static site if that path doesn't exist, instead of
 * a confusing Next.js page rendered from a subdomain that's supposed to be
 * backend-only.
 *
 * Matcher skips Next.js internals (_next/*) so static JS/CSS the redirected
 * pages reference keep loading without a redirect hop. The actual UI will
 * never load because the entry path gets redirected first; this is just
 * defense-in-depth if one slips through.
 */
const CANONICAL_ORIGIN = "https://www.peanutgallery.live";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const dest = new URL(`${CANONICAL_ORIGIN}${pathname}${search}`);
  return NextResponse.redirect(dest, 308);
}

export const config = {
  matcher: ["/((?!_next/).*)"],
};
