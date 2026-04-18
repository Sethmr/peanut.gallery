# NoteGPT `sidePanel` removal — risk memo

**Date:** 2026-04-18
**Question:** Why did NoteGPT (400K users, our closest feature-comparable competitor) remove the Chrome `sidePanel` permission in July 2025, and what does it mean for Peanut Gallery's "native side panel" differentiator?
**Short answer:** They replaced the native Chrome Side Panel with a custom in-page DOM sidebar. The move was UX-driven, not a platform retreat. Our "native side panel" claim is intact and, if anything, *more* differentiated than I assumed.

## The facts

From the chrome-stats.com version history for NoteGPT (extension ID `baecjmoceaobpnffgnlkloccenkoibbb`):

- **2024-06-18** (v1.3.13.1 → 1.3.14.0): `sidePanel` permission **added**.
- **2025-07-20** (v2.0.2.1 → 2.0.2.2): `sidePanel` permission **removed**.
- They had the API live for ~13 months, then dropped it in a minor version bump.

From NoteGPT's own blog post about the replacement UX: the current product uses a "sleek, non-intrusive sidebar for its summarization panel" activated by a floating NoteGPT logo on each web page / PDF. That's a **DOM-injected overlay**, not the native Chrome side panel. Same visual footprint, different implementation, different UX guarantees.

## Why they likely moved

I couldn't find a public post-mortem or changelog explanation from NoteGPT. Reading across the known Chrome `sidePanel` API issues and the UX choices NoteGPT made, the most probable reasons (ranked):

1. **UX consistency across surfaces.** NoteGPT runs on YouTube + Twitter + web articles + PDFs. Each surface has a different natural reading flow. A native side panel is *fixed* — it's a right-side drawer that ignores the page's content frame. An overlay sidebar can contextually position itself (anchor to the article column, float next to the PDF page, etc.). For a tool that works across radically different page types, the overlay is more flexible.

2. **Known `sidePanel` API friction (documented in Chromium and Chrome docs):**
   - Can't trigger Web Speech API permission dialogs from a side-panel context.
   - `sidePanel.close()` rejects in some states; developers report resizing bugs.
   - UI updates in Chrome 140 (late-2025 era) added a pin icon and removed the global side panel icon — a moving target for onboarding copy.
   - For an extension onboarding 400K users, "click this icon" instructions that keep changing with Chrome versions are a support-cost drag.

3. **Cross-browser portability.** Brave, Arc, and Edge implement `chrome.sidePanel` with varying fidelity; some Chromium forks delay support for new API surfaces. DOM overlays work identically everywhere Chromium runs.

4. **Not a deprecation signal from Google.** Chrome 140 (post-removal) added `sidePanel.getLayout()` for RTL support — Google is actively investing in the API, not retiring it. So NoteGPT didn't leave because the API was going away.

## What this means for Peanut Gallery

**Our positioning is actually stronger than I thought this morning.** The `sidePanel` removal isn't a platform red flag — it's a product-design divergence. NoteGPT optimized for *multi-surface consistency*. We're optimized for *live side-by-side companionship with a single YouTube tab*. Different problem, different right answer.

| Attribute | NoteGPT (current) | Peanut Gallery |
|---|---|---|
| UI location | Floating logo → overlay sidebar on the page | Chrome's native side panel, separate from content |
| Persistence across tabs | No (overlay is per-page) | Yes (side panel persists across YouTube tabs) |
| Interferes with content layout? | Yes (injects into page DOM) | No (dedicated OS-level drawer) |
| Requires permission grant? | `scripting` + host perms | `sidePanel` + `tabCapture` |
| Works on pages with strict CSP? | Can break | Unaffected |

Our "no tab switching, no layout interference" claim lives in the side panel being *not part of the page*. NoteGPT's overlay, by contrast, *is* part of the page — which is fine for reading but messes up full-bleed experiences (Netflix-style YouTube, fullscreen presentations). For a product that sits next to a video you're watching, the native side panel is a genuinely better fit.

## Marketing claims — keep or adjust?

Current marketing copy (from `app/layout.tsx` + `app/install/page.tsx` + CWS Variant A):

- ✅ **Keep:** "Native Chrome side panel (no tab switching)" — accurate and differentiating.
- ✅ **Keep:** "Lives next to the video, not on top of it. Persists across tabs." — literally true for us; literally false for NoteGPT.
- ⚠️ **Monitor, don't adjust yet:** "Silent tab capture (no screen-share picker)" — a side-panel context can't initiate permission dialogs, which is *relevant* but not a blocker for us because `chrome.tabCapture` uses a service-worker-initiated flow that doesn't prompt from the side panel itself. Confirmed working in our shipping code. No change needed.

**No marketing claim needs revision.** We're not inheriting NoteGPT's UX problem because we're not trying to solve their problem.

## Residual risks (monitor, don't act on yet)

1. **Chrome API surface churn.** Chrome 140's UI change (pin icon, removed global side panel icon) is the kind of thing that forces documentation updates. When it ships to stable, audit our `/install` page's step 4 ("Click the 🥜 Peanut Gallery icon in the Chrome toolbar") to confirm the path still matches the post-140 UI.

2. **Side panel permission justification on CWS review.** When we next update the CWS listing, keep the `sidePanel` permission justification tight: *"The extension's core feature is a live reactions panel that lives alongside the YouTube video. The native `chrome.sidePanel` API is the purpose-built surface for this — it keeps the video unaffected and persists across tab switches."* This is our compliance-checklist Section A2 ("minimum-necessary permissions") answer; if a reviewer flags it, the answer is already in the bank.

3. **If NoteGPT eventually comes back to `sidePanel`.** Unlikely (they invested in overlay infra), but worth watching. If they do, we lose some of the "only extension using the native panel for YouTube" moat.

## Action items

1. **[P2] Add a one-liner to the CWS detailed description** calling out the side-panel choice explicitly. Suggested copy (vetted against the compliance checklist):

   > *"Peanut Gallery uses Chrome's native Side Panel API — not a page-injected overlay. The reactions live in a dedicated drawer that doesn't cover the video, doesn't slow the page, and persists when you switch tabs."*

2. **[P2] Add this same one-liner to `app/install/page.tsx` §Features.** Position between "Native Chrome side panel" and "Real-time YouTube transcription."

3. **[P3] Schedule a 30-day audit** of whether the `chrome.sidePanel` API has shipped any breaking UI changes. I'll add this to the measurement checkpoint list in the synthesis doc.

## Bottom line

The `sidePanel` removal at NoteGPT is *not* a warning shot — it's a product-design divergence. Our positioning holds. I'd ship the one-liner above as part of the next CWS listing update (after Variant A goes in) and keep an eye on Chrome 140+ UI changes, but there's nothing to walk back.

## Sources

- [Chrome sidePanel permission history on chrome-stats.com](https://chrome-stats.com/permission/sidePanel)
- [NoteGPT Chrome Web Store listing](https://chromewebstore.google.com/detail/notegpt-youtube-summary-c/baecjmoceaobpnffgnlkloccenkoibbb)
- [NoteGPT blog: "The Ultimate Reading Assistant"](https://notegpt.io/blog/reading-assistant)
- [What's new in Chrome extensions (API changelog)](https://developer.chrome.com/docs/extensions/whats-new)
- [chrome.sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [PSA: Updated UI for the chrome.sidePanel API](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5PQyHPYQuXY/m/ZbsHqqTlAgAJ)
- [w3c/webextensions #387 — sidePanel permissions inconsistency](https://github.com/w3c/webextensions/issues/387)
