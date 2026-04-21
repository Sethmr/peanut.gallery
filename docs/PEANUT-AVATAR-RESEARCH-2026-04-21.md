# Peanut avatar — deep research on "more 3D"

**Prompt.** *"The ones we made are cool, but they aren't quite 3D enough."* — Seth, 2026-04-21.

**Goal.** Recommend a concrete upgrade path for the 8 peanut mascots so they read as genuinely dimensional, not flat-SVG-with-a-gradient. Four 42–64 px avatars on-screen at once. Bundle / perf / MV3-CSP constraints are real. Zero willingness to ship something that looks unfinished.

**Scope.** Techniques surveyed, ranked, with a top-3 recommended path. This doc is decision-support, not the ticket. Implementation tickets: [SET-21](https://linear.app/seth-dev/issue/SET-21) (stage 1, Todo) + [SET-22](https://linear.app/seth-dev/issue/SET-22) (stage 2, Backlog); v1.9 Bobbleheads track.

---

## 1. Current state

[`extension/sidepanel.js`](../extension/sidepanel.js) lines 170–368. One 64×64 viewBox SVG per persona:

- Single peanut body path with a **radial gradient** (38% 30% origin → 72% radius)
- One static highlight ellipse (opacity .55, upper-left)
- Ground-shadow ellipse (ry 1.8)
- Dark-fill eyes with tiny white specular dots
- One of five mouth shapes
- Per-persona prop markup (clipboard, headphones, megaphone, etc.)
- All animation is CSS keyframes: `idle-bob` + `.persona-bubble.speaking` wiggle

**Why it reads flat today:**

1. **One light source, frozen.** The highlight doesn't move relative to the body, and there's no rim light, no ambient occlusion, no cast shadow from the prop onto the body.
2. **No parallax between layers.** Prop + body + shadow all live in the same SVG transform, so they always appear coplanar with the viewer.
3. **No micro-motion.** Idle bob is a 2-frame Y translate. Nothing suggests weight, volume, or inertia — the things that distinguish bobblehead-feel from clipart-feel.
4. **No secondary lighting cues.** No cast shadow under the prop, no subsurface warm-up in the translucent shell curve.

These four gaps are all fixable without going to real 3D.

---

## 2. Technique survey

### A. SVG filter lighting — `<feDiffuseLighting>` + `<feSpecularLighting>`

**What it is.** SVG's built-in Phong-model shading. Applies real diffuse + specular light computations to any path, using the alpha channel as a bump map. The light source can be `<fePointLight>`, `<feDistantLight>`, or `<feSpotLight>`.

**Cost.** Zero bundle. Native browser support since 2013; baseline in all modern browsers. Rasterization runs on the GPU in Chromium.

**Fit for Peanut Gallery.** Very high. The peanut's rounded shell is exactly what Phong shading was designed for. One `<filter>` per body path, one `<fePointLight>` placed at (20, −10, 50) on the viewbox, specular exponent ~20, `kl` ~1.2 → you get a wet-looking lit sphere-ish body with a traveling specular highlight. The filter output composites over the existing radial gradient, so we keep the warm peanut color while adding real shading.

**Upgrade path.** Add a `<filter>` definition shared across all 8 mascots. Wrap the body path in `<g filter="url(#mshade)">`. Keep the prop OUTSIDE the filter so the prop doesn't get the same lighting treatment (we want the prop to cast ONTO the body, not be lit by the same filter). Costs ~30 LOC.

**Upgrade on top.** Animate `<feDistantLight>` `azimuth` between 120° and 150° on `.persona-bubble.speaking` (3–5 s ease). The specular highlight slides across the shell in sync with talk-wiggle — this is the single gesture most likely to make someone say *"wait, are these 3D?"*

**Reference recipe** (shared `<defs>`, applied via `filter="url(#peanutShade)"`):

```svg
<filter id="peanutShade" x="-10%" y="-10%" width="120%" height="120%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.7"
                      specularExponent="22" lighting-color="#FFF5DF"
                      result="spec">
    <feDistantLight azimuth="135" elevation="45"/>
  </feSpecularLighting>
  <feComposite in="spec" in2="SourceGraphic" operator="in" result="lit"/>
  <feComposite in="SourceGraphic" in2="lit" operator="arithmetic"
               k1="0" k2="1" k3="1" k4="0"/>
</filter>
```

### B. Multi-layer HTML+SVG parallax (the Blink/WebKit workaround)

**What it is.** CSS 3D transforms (`perspective`, `translateZ`, `preserve-3d`) don't apply to elements *inside* an SVG — Blink and WebKit explicitly don't support `preserve-3d` on SVG content. Workaround: break the mascot into 2–3 separate `<div><svg>...</svg></div>` elements, stacked with `position: absolute`, each with its own `translateZ`, all inside a parent with `transform-style: preserve-3d`.

**Cost.** Zero bundle. Some DOM restructuring.

**Fit.** Moderate-high. Lets us ship:
- Body at `translateZ(0)` (the anchor)
- Prop at `translateZ(12px) scale(1.05)` (reads as "in front")
- Ground-shadow at `translateZ(-8px)` (reads as "floor")
- Highlight as a separate layer at `translateZ(1px)` (reads as glint on the surface)

On idle, apply `rotateY(sin(t))` and `rotateX(cos(t))` in a ~4 s loop to the container. The layers parallax naturally — that's the bobblehead head-sway feeling without a 3D engine.

**Pitfalls.** Igalia's [2019 writeup](https://blogs.igalia.com/nzimmermann/posts/2019-12-12-3d-transformations/) on this is still the canonical warning and the 2026 behaviour is unchanged: Firefox applies the transforms but *draws at one screen pixel per SVG user unit, then scales like a raster — a blurry mess.* At 42–64 px retina, the scaled-raster tax is severe. Safer fix: snap `translateZ` to integer pixels, set `backface-visibility: hidden`, `will-change: transform`. Also: our current mascot is one SVG — moving to 2–3 SVGs per persona is a real refactor (~200 LOC in `buildPeanutSVG`).

### C. Rive — runtime 2D skeletal + mesh deformation

**What it is.** A WebAssembly-powered runtime for character animation with real bone rigs, meshes, constraints, and interactive state machines. Native designer tool (Rive Editor) is free for indie use. Output is a single `.riv` binary loaded by the runtime.

**Cost.** Runtime is ~400 KB wasm + ~40 KB JS. Per-mascot `.riv` files ~10–50 KB each.

**MV3 CSP gotcha — sharper than it looks.** Rive's default runtime fetches WASM from a CDN at load time. **MV3 bans remote code execution.** Bundling WASM locally via Rive's `preloading WASM` config makes it *technically* work, but it forces `wasm-unsafe-eval` in `content_security_policy.extension_pages`. Chrome Web Store review has historically flagged that flag as a rejection risk even when use is legitimate (see the parallel [`dotlottie-web` MV3 CSP issue #434](https://github.com/LottieFiles/dotlottie-web/issues/434)). The engineering is doable; the review surface is the real cost.

**Fit.** High IF we have a designer willing to rig the mascots in Rive Editor. Without that, Rive is useless — it's a runtime for designer output, not a code-first tool.

**Verdict for us.** Defer unless/until we have the designer hours. Quality ceiling is the highest of any option, but the delivery risk is also the highest because it depends on external creative work.

### D. Lottie (Bodymovin)

**What it is.** After Effects → Bodymovin exporter → Lottie-Web runtime → animation JSON. Industry standard.

**Cost.** Lottie-Web runtime ~82–90 KB gzipped in 2026. Lighter variant (`jLottie`) at ~15 KB but feature-limited. Each mascot animation ~20–50 KB JSON.

**MV3.** Runtime is pure JS; no eval, no remote code. Bundle locally, runs clean.

**Fit.** Similar to Rive — needs designer in After Effects. Lottie's animation ceiling is below Rive's (no mesh deformation, limited 3D) but the tooling is more familiar and the file format has been stable for ~8 years.

**Verdict.** **Skip for Peanut Gallery.** Lottie is frame-sampled 2D — it won't look more 3D than the SVG-filter path (A) that costs zero bundle and zero designer hours. Paying ~90 KB gzipped + an After Effects pipeline to get animation that's smoother-but-not-more-volumetric than what feSpecularLighting gives us is the wrong trade at this surface size. Revisit only if a designer shows up with existing Lottie-native assets we can drop in.

### E. Three.js + glTF bobbleheads

**What it is.** Real 3D in the side panel. Hand-model the peanut in Blender, export as GLB, render with Three.js + a stylized toon-shader material. This is the v1.9 "Bobbleheads (Stretch)" roadmap entry's A-path.

**Cost.** Three.js core ~150 KB gzipped + GLTFLoader ~10 KB + each GLB ~30–80 KB. GPU shader overhead negligible for 4 × 64 px renders.

**MV3.** Works with Three.js core (no eval). DracoLoader pulls WASM — if we don't compress meshes with Draco we avoid that path entirely. Straightforward.

**Fit.** Ceiling is genuinely 3D. Cost is real — every session now pays a Three.js tax on top of our existing persona-engine + transcription + Haiku pipeline. For 4 characters at 64 px, that's a steep tradeoff: we're shipping a 3D engine to render the size of a thumbnail.

**Verdict.** The roadmap's "2-day gamble" path is honest — it's either worth it or it isn't, and you can tell by end-of-day-one. **Don't invest more than 2 days without a "yes, this reads as Peanut Gallery" verdict at the halfway point.**

### F. Pre-rendered sprite sheets (the "3D without the runtime" play)

**What it is.** Model the mascots in Blender / Spline / AI-generated (Meshy / Tripo). Render each mascot's idle loop + fire-reaction as a 24-frame sequence. Compose into an animated WebP or a CSS sprite sheet. Render at 2× resolution for retina.

**Cost.** Zero runtime. ~30 frames × 64×64 × 4 mascots = small. Modern animated WebP compresses this to ~20–40 KB per mascot.

**Fit.** This is the sleeper pick. You get real 3D — whatever you render in Blender — at 2D-sprite runtime cost. No shader, no scene graph, no MV3 friction. `<img src>` and play.

**Pitfalls.**
- Authoring workflow. Blender is real time investment. Meshy AI 3D generation (2026 state: strong for stylized characters with auto-rigging) closes a lot of that gap.
- Fixed camera. Sprites can't parallax to cursor; what you render is what you show. Upgrade path: render 8 angle variants, pick by cursor position on hover.
- State-driven frame selection. We need to map "fire event" → sprite sequence start. ~50 LOC wrapper.

**Verdict.** **This is what I'd ship first.** Real 3D feel, zero runtime tax, works in MV3 without tuning, and you can iterate the 3D asset separately from the extension code.

### G. AI MP4 reaction loops

**What it is.** Generate 1–2 s seamless-loop MP4 reactions per persona via Sora / Runway / similar (2026 state: genuinely usable for stylized cartoon loops). Play on fire-event.

**Cost.** ~100 KB per MP4 at low resolution; browser-native `<video>` playback; no JS.

**Fit.** Higher fidelity than sprite sheets for non-repetitive motion. But AI video is unpredictable — you'd generate 20 and pick 4, and the ones you pick may drift off-character. Also: AI MP4 doesn't idle well (seamless loop is hard for cartoon characters at 2 s length).

**Verdict.** Interesting supplement to sprite sheets, not a replacement. Keep for the "hype moment" animations (fire, force-react) where the one-shot motion matters; use sprites for the idle loop.

### H. Pure-SVG "design tricks" (the zero-effort path)

**What it is.** Stop short of any new runtime and just upgrade the existing SVG:
- Add 2nd + 3rd gradient stops offset radially to fake rim lighting
- Add a `<filter>` with `<feGaussianBlur>` + `<feOffset>` → inner shadow → ambient occlusion
- Draw a cast shadow path from the prop onto the body (opacity 0.2, blurred)
- Add a subtle warm-tone `<feColorMatrix>` on the body's lower edge (simulated bounce light)
- CSS keyframe: slow drift on the highlight ellipse's `cx` / `cy` (2–3 s period)

**Cost.** ~50 LOC change to `buildPeanutSVG`. No runtime addition. Works today.

**Fit.** Under-estimated. Half of "3D feel" is just "multiple lights + soft contact shadows + micro-motion." This costs one afternoon and moves the needle meaningfully — sometimes enough to skip the bigger options entirely.

**Verdict.** **Always do this first** even if you commit to F or E. It's the cheap floor; everything else builds on top.

### I. Cel-shading (hand-authored, no library)

**What it is.** Replace the continuous radial gradient with 2–3 flat tonal regions (lit, mid, shadow) separated by hard edges, plus a single sharp rim-light path. This is the anime / Overwatch / Breath-of-the-Wild look. Not a library — a design decision about how to draw the SVG.

**Cost.** Pure design work. Each persona's body path gets split into 3 overlayed paths (lit, mid, shadow). ~40 LOC per persona.

**Fit.** Interesting third-option. Fits the "paper / warm-radio" Peanut Gallery aesthetic. Reads as *stylised-volumetric* rather than *photoreal-volumetric* — which may actually be on-brand: we're cartoon peanuts, not realistic ones. Stacks with (A) feSpecularLighting as a subtle rim-light enhancer rather than a replacement.

**Verdict.** **Viable alternative to (A)** if the Phong look lands too "wet/plastic." Worth trying A first (cheaper, more automatic) and falling back to I only if the aesthetic feels wrong.

---

## 3. Fit matrix

| Technique | Runtime cost | Authoring cost | "3D feel" ceiling | MV3 risk | Designer-gated? |
|---|---|---|---|---|---|
| A · SVG filter lighting | 0 KB | Low (1 dev afternoon) | ★★★ | None | No |
| B · HTML+SVG parallax layers | 0 KB | Medium (~200 LOC refactor) | ★★★ | Low (subpixel polish) | No |
| C · Rive | ~440 KB | High (designer in Rive Editor) | ★★★★★ | Medium (WASM preload) | Yes |
| D · Lottie | ~90 KB | High (designer in After Effects) | ★★★★ | None | Yes |
| E · Three.js + glTF | ~160 KB + GLB | High (Blender modeling) | ★★★★★ | None | Partial (AI 3D helps) |
| F · Pre-rendered sprite sheets | 0 KB + ~30 KB assets | Medium (Blender or Meshy) | ★★★★ | None | Partial (AI helps) |
| G · AI MP4 loops | 0 KB + ~100 KB assets | Low (prompt Sora/Runway) | ★★★ | None | No |
| H · Design tricks (pure SVG polish) | 0 KB | Low (1 dev afternoon) | ★★ | None | No |
| I · Cel-shading (hand-authored) | 0 KB | Medium (~40 LOC × 8 personas) | ★★★ | None | No (but benefits from an art eye) |

---

## 4. Recommended path

**Stage 1 — ship this week (H + A combined):**
One afternoon. Add SVG filter lighting + multiple gradient stops + prop-cast-shadow + subtle highlight drift. Ships in a single PR. Moves every mascot from "cool flat illustration" to "illustrated with depth." No new dependency, no MV3 surprise, no designer blocker.

**Stage 2 — ship in the v1.9 Bobbleheads window (F):**
Pre-rendered sprite sheets. Use Meshy or Tripo to generate a stylized 3D peanut (they're strong on cartoon mascots in 2026). Render idle + fire-reaction loops in Blender, export as animated WebP, swap the SVG body for the WebP via CSS. Keep the SVG prop as a separate overlay so packs can still swap props without re-rendering the body. This is the "real 3D without the runtime tax" answer — and it works even if we never commit to the Rive / Three.js path.

**Stage 3 — optional long-play (C):**
If someone produces a Rive designer pass on the mascots, switch. Rive is the highest-ceiling option; it's also the riskiest because it depends on creative work we don't control. Keep it as "the upgrade that unlocks when a designer shows up."

**What NOT to do:**
- **Three.js** (E) for 4 × 64 px renders. The engine weight is irrational for the surface area. Only justifiable if we commit to much richer future uses (full-gallery mode, live3D during TWiST submission, etc.).
- **Lottie** (D) over Rive. Rive is strictly more capable with ~4× the bundle, but bundle isn't the constraint — designer tooling is, and Rive's editor is more natural for character rigs.
- **Designer-gated stage-1.** Don't wait on external work to fix the "flat" problem. Stages 1 + 2 both work without a designer in the loop.

---

## 5. Two-day prototype plan (Stage 1)

Scoped tight so we can validate stage 1 before committing to stage 2.

**Day 1 — SVG depth pass:**
- Extend `buildPeanutSVG` with a shared `<filter id="mshade">` using `<feDiffuseLighting>` + `<feSpecularLighting>` + `<fePointLight>`.
- Add 2 additional gradient stops to the body (warm rim at bottom, cool-bounce at shoulder).
- Draw per-persona prop cast shadow — simple `<path>` with `filter="url(#mblur)"` at low opacity.
- CSS keyframe: `mhighlight` moves `cx` + `cy` on a 4 s ease.
- A/B side-by-side with current version. Seth ships verdict.

**Day 2 — layered parallax (optional, only if day 1 lands):**
- Refactor `buildPeanutSVG` output into 3 HTML layers (body / prop / shadow).
- Apply `transform-style: preserve-3d` + `translateZ` to each layer.
- Pointer-follow: `container.onmousemove` updates `--tilt-x` / `--tilt-y` custom properties; each layer's `rotateY` / `rotateX` computes from those.
- Test on retina + Windows + Linux.

**Exit criteria:** Seth says "yeah, these look 3D" OR ships stage 1 as-is and we park stage 2 for later. Either outcome is good — stage 1 alone is a meaningful upgrade.

---

## 6. What to file in Linear

**[SET-21](https://linear.app/seth-dev/issue/SET-21) — "Peanut avatar depth pass (stage 1)"** — Todo. One-PR scope. Blocks on nothing; can ship alongside the v3 canary. Estimated: 1 dev-day.

**[SET-22](https://linear.app/seth-dev/issue/SET-22) — "Pre-rendered 3D sprite-sheet avatars (stage 2)"** — Backlog. Depends on SET-21 shipping + designer/AI output. Estimated: 2–3 dev-days + asset generation. This is the v1.9 Bobbleheads slot — if stage 1 is enough, we defer stage 2 indefinitely without regret.

**No ticket for Three.js / Rive.** Revisit only if: (a) stage 1 underwhelms AND sprite sheets feel off-brand, or (b) a designer materializes with Rive output.

---

## 7. Sources

- [`<feSpecularLighting>` on MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feSpecularLighting)
- [`<feDiffuseLighting>` on MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDiffuseLighting) — Phong-model implementation details
- [SVG Basics — Lighting Filter Effects](https://www.svgbasics.com/filters2.html)
- [Creating SVG Lighting Effects with feSpecularLighting](https://vanseodesign.com/web-design/svg-filter-primitives-fespecularlighting/)
- [Stefan Judis — Fancy SVG filters](https://www.stefanjudis.com/blog/fancy-svg-filters/) — strongest single reference on character-art SVG filter techniques
- [CSS-Tricks — Adding Shadows to SVG Icons](https://css-tricks.com/adding-shadows-to-svg-icons-with-css-and-svg-filters/) — inner-shadow + ambient-occlusion filter chain
- [dotlottie-web MV3 WASM CSP issue #434](https://github.com/LottieFiles/dotlottie-web/issues/434) — canonical example of the Rive/Lottie CSP-reviewer risk
- [three.js MeshToonMaterial docs](https://threejs.org/docs/pages/MeshToonMaterial.html) — reference for option E's toon-shader path
- [Medium — AI 3D Generators Compared (Tripo / Meshy / Rodin)](https://medium.com/data-science-in-your-pocket/ai-3d-model-generators-compared-tripo-ai-meshy-ai-rodin-ai-and-more-8d42cc841049)
- [Animated WebP vs APNG vs GIF — 2025 production guide](https://webp-to-png.tools/blog/animated-images-in-2025-webp-vs-apng-vs-gif-real-world-use-cases/) — format choice for option F
- [CSS 3D Transforms + SVG — Igalia](https://blogs.igalia.com/nzimmermann/posts/2019-12-12-3d-transformations/) — critical pitfall writeup for `preserve-3d` not working on SVG content
- [O'Reilly — 3D Transformations with SVG](https://oreillymedia.github.io/Using_SVG/extras/ch11-3d.html)
- [Lottie-Web bundle size 2026 — GitHub issue](https://github.com/airbnb/lottie-web/issues/1184)
- [Lottie-Web on Bundlephobia](https://bundlephobia.com/package/lottie-web)
- [jLottie — lightweight Lottie variant](https://github.com/LottieFiles/jlottie)
- [Rive runtime web JS + preloading WASM](https://rive.app/docs/runtimes/web/preloading-wasm) — MV3-compat path
- [Rive Runtimes overview](https://rive.app/runtimes)
- [Chrome MV3 side panel guide 2026](https://www.extensionfast.com/blog/how-to-build-a-chrome-extension-side-panel-in-2026)
- [Resolving CSP issues in MV3](https://medium.com/@python-javascript-php-html-css/resolving-content-security-policy-issues-in-chrome-extension-manifest-v3-4ab8ee6b3275)
- [Meshy AI 3D Generator](https://www.meshy.ai/) — stylized character generation
- [Meshy AI rigging features](https://www.meshy.ai/features/ai-animation-generator)
- [Rodin AI Review 2026](https://dupple.com/tools/rodin-ai)
- [Best text-to-3D generators 2026 (3DAI Studio)](https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/best-text-to-3d-generators-2026)
- [CSS-only parallax with `perspective` + `transform3d`](https://medium.com/creative-technology-concepts-code/css-only-parallax-using-perspective-and-transform3d-ca6ab3a911a2)
- [CSS 3D Transforms: Polypane examples 2024](https://polypane.app/css-3d-transform-examples/)
- [CSS Spheres tutorial — multi-gradient 3D ball](https://cssanimation.rocks/spheres/)
- [Peanut Gallery ROADMAP — v1.9 Bobbleheads (Stretch)](ROADMAP.md#v190-bobbleheads-stretch) — existing planned-path reference
