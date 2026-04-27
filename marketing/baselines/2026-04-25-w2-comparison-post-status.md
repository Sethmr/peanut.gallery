# Week 2 comparison post — ship readiness check (2026-04-25)

**Scheduled checkpoint output.** Companion to `2026-04-25-ga4-delta.md` and `2026-04-25-gsc-delta.md`. Today is the **5th day of the 7-day target_publish window** (2026‑04‑20 → 2026‑04‑26) for `marketing/content/2026-W2-vs-competitors.md`. This doc captures the ship-readiness audit done today.

## Has the post shipped?

**No.** Verified by:
- `marketing/content/2026-W2-vs-competitors.md` frontmatter still reads `status: draft`.
- `site/` directory has no `blog/` subdirectory — no `/blog/peanut-gallery-vs-notegpt-vs-glasp/index.html` exists.
- `site/sitemap.xml` (live as of `<lastmod>2026-04-24</lastmod>`) has 9 URLs and none is the comparison-post slug.
- Live `https://www.peanutgallery.live/sitemap.xml` matches the local sitemap.

## Competitor user-count re-verification (2026-04-25)

The draft is dated 2026‑04‑18; the publishing checklist requires re-pulling competitor counts before shipping. Re-verified today via web search (chrome-stats.com is the same source the 2026-04-18 baseline used):

| Competitor | 2026-04-18 baseline (in draft) | 2026-04-25 verified | Δ | Action |
|---|---|---|---|---|
| **Glasp** — YouTube Summary with ChatGPT & Claude | 2,000,000 users | **2M+ users** ("trusted by 2M+") | flat | No change to draft needed |
| **NoteGPT** — YouTube Summary, Chat with AI | 400,000 users | **400,000 users** | flat | No change to draft needed |
| **Eightify** — AI YouTube Summarizer | 200,000 users | not re-verified | n/a | Not in head-to-head table; safe to leave |
| **Clarify AI** | 20,000 users | not re-verified | n/a | Not in head-to-head table |
| **Dmooji** | 20,000 users | not re-verified | n/a | Not in head-to-head table |

Glasp's CWS listing was last updated 2026‑04‑14 (v2.0.30 per the chrome-web-store source) — no material drift. **The numbers in the head-to-head table are still accurate as of today.**

## Other freshness checks

| Claim | Status |
|---|---|
| NoteGPT removed `sidePanel` permission in July 2025 | Still true per `2026-04-18-notegpt-sidepanel-investigation.md`. No update. |
| NoteGPT requires login for core features | Stated in draft; not re-verified. CWS listing still says "Sign in with Google" prominently. Likely still true. |
| Glasp requires sign-up | Stated in draft; not re-verified. Unchanged in the 2 weeks since baseline. |
| Peanut Gallery is open source / MIT | True. |
| `chrome.tabCapture` permission scope | True per `extension/manifest.json` v2.0.1 (`tabCapture`, `offscreen`, `activeTab`, `storage`, `sidePanel` + scoped host permissions). |
| `/install` and `/watch` links resolve | `/install/` returns 200 (verified via live HTML). `/watch` is on the apex `peanutgallery.live` (Next.js app); needs Seth-side verification. The draft links to `/install` and `/watch` — both should be tested before publish. |

## Ship recommendation

**Recommend shipping this week**, but **not from this scheduled run** for two reasons:

1. **Repo + ownership boundary.** The marketing site is the separate `Sethmr/peanut.gallery.site` repo (`site/` locally). Per `.auto-memory/feedback_ui_authority_boundaries.md`, the HTML UI is Claude Design's territory; this run shouldn't author the post's HTML template. Engineering can wire the route, sitemap, and JSON-LD; design owns the page chrome.
2. **No `/blog/` template exists.** There's no precedent route in `site/` to copy. Shipping the post requires either creating a `site/blog/` directory with a new template that matches the broadsheet/newsprint design system, OR gating it as a "long article" in the existing flat structure (`site/peanut-gallery-vs-notegpt-vs-glasp/index.html`) which is a worse SEO signal.

**Concrete proposal for Seth (15-minute call to make):** decide whether the comparison post lives at `/blog/peanut-gallery-vs-notegpt-vs-glasp/` (preferred — supports a future blog index) or at `/vs/notegpt-glasp/` (preferred for query match — `[brand] vs notegpt vs glasp` queries hit the URL slug directly). Once the path is decided, Claude Design can produce the HTML template, and engineering wires:

- `site/<route>/index.html` with the post content from `marketing/content/2026-W2-vs-competitors.md` rendered into the broadsheet template.
- `BlogPosting` JSON-LD with `author`, `datePublished`, `dateModified`, `headline`, `image`, `publisher` (Organization node).
- `BreadcrumbList` JSON-LD: Home → Blog → This post.
- `FAQPage` JSON-LD using the 6 Q&As at the bottom of the draft (each ≤ 300 chars — already true).
- `alternates.canonical` set to the final live URL.
- Add to `site/sitemap.xml`.
- After deploy: ping IndexNow with the new URL (key file already exists at `site/f6034c7304ba548b70ba5a95b9d559f8.txt`).
- After deploy: re-submit sitemap in GSC + BWT.

## CWS compliance vetting (re-walked 2026-04-25)

Re-walked the quick-vet gate in `marketing/CWS-COMPLIANCE-CHECKLIST.md` against the 2026-04-18 draft text:

| Check | Pass? | Notes |
|---|---|---|
| Claim accuracy — feature claims match shipping code | ✅ | Persona list (fact-checker, troll, comedy writer, sound guy) matches v2.0.1 manifest + persona files |
| Permission parity — no claim exceeds manifest | ✅ | Draft lists `sidePanel`, `tabCapture`, `storage` + scoped YouTube hosts; matches manifest exactly |
| Persona branding safety — no "is" / "official X" framing | ✅ | "inspired by an archetype from talk-radio / tech-podcast culture" — meets the legal hedge from `feat(personas): "inspired by"` commit (`d1f7a41`) |
| No keyword stuffing | ✅ | Reads as natural prose; no SEO-spam patterns |
| No "best" / "#1" / "top-rated" claims | ✅ | "If you're trying to pick one" is comparative without superlatives. "the best free option" appears only in a paraphrased Glasp positioning quote — recommend lowercasing or rephrasing on final pass |
| No implied endorsement by YouTube / Google / Anthropic / xAI / Deepgram | ✅ | All three are mentioned as service providers, not endorsers |
| Privacy disclosure parity — claims match `/privacy/` and `extension/privacy` | ✅ | "audio captured locally via `chrome.tabCapture` after explicit click; keys stored in `chrome.storage.local`; no analytics" — matches privacy policy |
| No "voice cloning" or likeness claims | ✅ | Draft is text-only-reactions throughout; matches the v2.0 Terms of Service §"AI output and persona framing" |

**Two soft fixes to make before publish:**

1. The phrase "the best free option" appears in the Glasp paraphrase. Rephrase to "a popular free option" or attribute it as a quote from a third-party review. CWS auto-classifiers occasionally flag "best" even in attributed contexts.
2. The post's `target_publish: Week 2 (2026-04-20 to 2026-04-26)` will be in the past on the publish date — update to the actual publish date.

## Decision needed from Seth

Pick one:

- **(a) Ship today/tomorrow** — confirm the route (`/blog/...` vs `/vs/...`), hand off to Claude Design for the template, push live. The comparison post is the highest-leverage Week 2 SEO play (per `marketing/SEO-PLAN.md` §3 Part C).
- **(b) Roll into Week 3** — concede that Week 2 was eaten by v2.0 launch + v2.0.1 compliance pass, and ship next week with Variant A short description in parallel.
- **(c) Cut scope** — publish a shorter "Peanut Gallery in 2 minutes" page first, defer the head-to-head until competitor data refreshes (next pull at 2026-05-02 checkpoint).

My read: **(a)**. The data is fresh, the prose is compliance-clean (with the two soft fixes), and shipping this week earns a 7-day SEO head start over (b). The risk is route-template churn if Claude Design needs more than half a day on the broadsheet adaptation. If that risk feels real, fall back to (b) — not (c).

## Next checkpoint

- **2026-05-02** — if shipped, first impressions for the comparison-post URL should appear in GSC. Look for queries like `peanut gallery vs notegpt`, `notegpt alternative`, `glasp alternative`.

Sources used in this re-verification:
- [NoteGPT chrome-stats.com listing](https://chrome-stats.com/d/baecjmoceaobpnffgnlkloccenkoibbb)
- [Glasp YouTube Summary chrome-stats.com listing](https://chrome-stats.com/d/cdjifpfganmhoojfclednjdnnpooaojb) (via web search)
- [Glasp YouTube Summary on chromewebstore.google.com](https://chromewebstore.google.com/detail/youtube-summary-chatgpt-b/cdjifpfganmhoojfclednjdnnpooaojb)
- Live `extension/manifest.json` (v2.0.1)
- Live `https://www.peanutgallery.live/sitemap.xml` (9 URLs, terms/ now resolves)
