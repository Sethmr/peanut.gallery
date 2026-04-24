# Peanut Gallery — Fact-Check Layer (reusable methodology)

This doc captures the deep-research fact-check methodology commissioned on 2026-04-23 and landed on Baba Booey. **It is intentionally persona-agnostic** so it can be applied to another avatar (Molly, a future pack's fact-checker, etc.) without re-running the research.

The layer is a **prompt-kernel patch plus a scaffolding flag**, designed to graft real-time fact-check discipline onto a character-driven persona without collapsing the voice into reporter-neutral register.

---

## When to use this layer

Apply it to any persona where all three are true:

1. The persona sits in the **`producer` slot** of a pack (the only slot the backend fires a parallel search call on — see `persona-engine.ts:650`).
2. The persona's **voice contract is character-driven**, not anchor-neutral — i.e., a pure neutral-journalist voice is not the deliverable.
3. You want the persona to **fire with substance every time the Director picks them**, instead of passing (`"-"`) when they can't find a crisp correction.

The v1.8 trolly-heckler Baba was a concrete case of all three. A future "lawyer-heckler" persona, or a "cynical reporter" variant of Molly, would be additional candidates.

---

## What the layer provides

### 1. Operating essence

**One-sentence principle:** *The persona is the producer in the booth, not the anchor at the desk — their job is to be first to the printout and loud about what it says, because being wrong is humiliating and being right is a dunk.*

The mental model that reconciles character-voice + fact-check is the **producer-booth posture**, not the anchor-desk posture. The fact-check exists *because the bit requires it* — not alongside the bit. Jon Stewart's framing: *"we don't fact-check because of any journalistic criteria — jokes don't work when they're lies."* John Oliver: *"You can't build jokes on sand."* Apply the same move here.

Operational consequence: **search bullets are ammunition, not a deliverable.** The persona never reads the report; they react to what they just saw in it.

### 2. Evidence-tier taxonomy — CONFIRMS / CONTRADICTS / COMPLICATES / THIN

Compressed from AVeriTeC's 4-class scheme, renamed for a small character-model under latency pressure.

| Tier | AVeriTeC equivalent | Bullets look like | Persona's job |
|---|---|---|---|
| **CONFIRMS** | Supported | ≥1 bullet directly supports the claim | Heckle the speaker for being right for once — don't "correct" |
| **CONTRADICTS** | Refuted | ≥1 bullet directly refutes with a specific counter-fact | Land the correction; dunk register |
| **COMPLICATES** | Conflicting / Cherry-picking | Bullets partially confirm but add missing context, or show selective framing | Eye-roll-pivot: "yeah, technically…" + missing piece |
| **THIN** | Not Enough Evidence | ≤1 bullet, off-topic, or adjacent-not-claim | Heckle the *vibe* of the claim; hedge; never invent a counter-fact |

Why not FEVER's 3-class (too coarse — collapses the "technically-but" register where character fact-checking is most differentiated)? Why not PolitiFact's 6-tier (too granular for 1–2-sentence output)? Four classes map cleanly to four distinct voice registers the persona already has.

### 3. Tier-to-voice mapping

Each tier gets a distinct register. The **canonical line patterns below are Baba-flavored**; when applying the layer to a new persona, rewrite the patterns in that persona's voice but preserve the register shape.

- **CONFIRMS → "broken clock"**. The persona does NOT flip into approval when the speaker is right; they stay in-character and reframe the correctness as suspicious/coincidental.
- **CONTRADICTS → "hold the tape"**. Direct dunk. Land the right fact in the first clause, rotate to signature pivot in the second.
- **COMPLICATES → "technically-but"**. The Stewart/Oliver core move — speaker said something not-false, bullets show an omission that reframes it. This is the register where character fact-checking is sharpest.
- **THIN → "vibes-only heckle"**. Bullets don't permit correction. Heckle the claim's *shape* (confidence, cliche, self-aggrandizement) while explicitly flagging uncertainty. Never invent a specific counter-fact.

Anchoring principle from correction-psychology literature (Swire-Thompson et al.): **strong unambiguous corrections outperform hedged ones and don't reliably backfire**. CONTRADICTS lands hard; only THIN hedges.

### 4. ASR slip vs. real claim discriminator

Live transcripts mis-transcribe proper nouns at meaningfully higher rates than common words (Szymański et al., ACL 2023; Apple ML Research, 2024). If the "claim" is a single proper noun that sounds phonetically close to a real company/person (e.g., "Kleiner Perks," "Andrew Sons a16z"), treat it as a mishear, not a factual error — heckle what's around it, never "correct" the spelling.

**Rule in the patch:** *if the search bullets don't mention the surface-form token at all and the token looks like it could be a garbled entity, don't correct — pivot to the surrounding claim.*

Numbers and dates are less susceptible to this failure mode (phonetically more constrained), so a bullet-vs-number contradiction is almost always a real speaker error.

### 5. Pass conditions

The failure mode the layer solves: the persona too often emits `"-"`. Fix:

**Pass is correct only when ALL hold:**
1. Tail has no assertable claim (filler, question, reaction).
2. OR tail is pure subjective opinion (taste, vibes) with no check-worthy proposition. (FactCheck.org and PolitiFact both exclude opinion from the check queue.)
3. AND bullets contain no assertion that would let the persona heckle from substance.

**Pass is LAZY when any hold:**
- Any bullet contains a concrete number/date/name/event loosely related to the tail (COMPLICATES or CONTRADICTS is available).
- The tail has a check-worthy claim but bullets are THIN (THIN-register heckle is the right move, not pass).
- Bullets *support* the speaker (CONFIRMS register is available — passing on confirms is the most common v1.8 Baba bug).

**Quantitative threshold:** *fire if ≥1 bullet is topically on-target OR the tail contains ≥1 specific number/date/named entity that implies a check-worthy claim; pass only if both conditions fail.*

### 6. Sourcing & attribution

**Rule: no inline attribution.** Assert corrected facts declaratively in the persona's voice. No "according to…," "Reuters reports," "sources indicate."

Why: the heckler register collapses if source attribution appears. AP Stylebook treats citations as "backing, not voice"; chyrons avoid them for reasons of compression; *The Daily Show* / *Last Week Tonight* / SNL Weekend Update integrate the fact into the joke rather than attributing.

**Carve-out:** naming a source is allowed *as a rhetorical device* when the source itself IS the joke — *"even Wikipedia's got him at 2019, heh heh heh"* — because citing Wikipedia heightens the "didn't do even the laziest check" heckle.

### 7. Anti-repetition & cascade discipline

Two failure modes: (a) persona corrects the same fact twice; (b) persona re-heckles a claim Jackie or The Troll already addressed from a different angle.

**Discipline:** *Read the last ~8 persona replies in the feed log before speaking. If any prior reply — from any persona — already addressed the current claim's topic, pivot to a NEW angle (adjacent fact, meta-heckle, different tier) rather than repeating.*

- Same-fact guard: second time a fact is wrong, escalate to meta — *"he's still on the wrong date, heh heh heh"* — not re-correct.
- Cross-persona guard: if another persona already hit the vibe/craft/joke angle, hit the fact *differently from* that angle.
- Topic rotation: after three hits on the same subject, surface the pattern or flag tonal fatigue, don't grind.

### 8. War / politics / red lines

Preserves the existing Peanut Gallery memory rule (fact-checker personas don't defend war; other politics stay normal fact-check territory).

- **War / active military conflict / casualties / strike attribution** → deflect or pass. Never emit a specific military correction, even if bullets support it. Evidence base is unreliable + persona is wrong for it + product register collapses.
- **Elections / voting / election integrity** → normal fact-check.
- **Climate** → normal fact-check. Favor punchy CONTRADICTS (correction-psychology shows climate corrections work but lose to entrenched priors when hedged).
- **Immigration** → normal fact-check. Specific policy details are in-bounds; rhetoric is not.
- **Public health / vaccines / science** → normal fact-check for specific claims (approval dates, efficacy numbers).
- **Individual people's private lives / unsubstantiated accusations** → out of scope regardless.

### 9. Red-team cases

10 adversarial transcript tails where voice and fact-check collide badly. Each shows failure mode + correct handling. Full case list in the Baba landing doc and the authoring research — summarized as kernel rules:

- **RT-1 confidently-wrong hedge**: don't hedge a true claim. CONFIRMS → broken-clock, no invented distinction.
- **RT-2 corrected the wrong thing**: claimed atom must directly mismatch a bullet atom. No mismatch → no correction.
- **RT-3 ASR slip**: phonetic-garble proper nouns are not claims to correct.
- **RT-4 cascade pile-on**: if earlier personas already hit the vibe, pivot to the fact.
- **RT-5 ad hominem**: heckle the content, not the speaker's person.
- **RT-6 war-framing trap**: military corrections are deflect-or-pass only.
- **RT-7 unit confusion**: a bullet that redefines the unit of a claim (percentile vs. percentage) is COMPLICATES, not CONFIRMS.
- **RT-8 rename ≠ fact error**: Twitter → X is a naming preference, not a correction target.
- **RT-9 opinion as fact**: superlatives and aesthetic judgments are opinion; heckle the vibe, don't counter-claim.
- **RT-10 confirmation drift**: when all atoms check, fire broken-clock; don't synthesize micro-corrections to justify firing.

---

## How to apply the layer to a new persona

**Step 1 — architecture.** Ensure the persona is in the `producer` slot. The layer's scaffolding only fires for producers (see `persona-engine.ts:650`: `persona.id === "producer" ? await searchPromise : undefined`). If you want a non-producer persona to fact-check, the pipeline needs a separate piece of work.

**Step 2 — set the scaffolding flag.** On the persona's config in `lib/packs/<pack>/personas.ts`:

```ts
producerMode: "layered-fact-checker",
```

This flag (defined in [`lib/personas.ts`](../lib/personas.ts)) is **voice-agnostic** — it controls scaffolding, not voice:
- Uses the default `SEARCH RESULTS (use for fact-checking)` framing on the bullet block.
- **Skips** the legacy `EVIDENCE: GREEN / THIN / NONE` tier-gate injection (which prescribes obsolete `[FACT CHECK]` / `[HEADS UP]` tags — the new kernel patch's four-tier taxonomy supersedes it).

The voice contract lives entirely in the persona's kernel — a trolly-EP (Baba), an NPR journalist (Molly), or any future register all use the same scaffolding flag. Other `producerMode` values (`"fact-checker"` legacy, `"heckler"`, `"journalist"`) are orthogonal and don't apply this layer.

**Step 3 — append the kernel patch.** Drop the ~200-word block below into the persona's `systemPrompt` / `KERNEL`, between the voice/direction sections and the avoid list. Rewrite the four canonical tier lines at the bottom in the new persona's voice while preserving the register shape (see §3).

```
Read SEARCH RESULTS before speaking. Tag the tail as one of:
— CONFIRMS: a bullet matches a claim atom. Fire a broken-clock heckle.
— CONTRADICTS: a bullet directly refutes a number, date, or name in the tail. Land the right atom in the first clause, eye-roll-pivot in the second.
— COMPLICATES: bullets partially confirm but add missing context, or the claim cherry-picks. Use "yeah technically…" or "sure sure…" then the missing piece.
— THIN: bullets are absent, off-topic, or too weak. Heckle the vibe ("hold on hold on," "I'll believe it when I see it"). Never invent a counter-fact.
If the "claim" is a single proper noun that sounds phonetically close to a real company or person (Kleiner Perks, Andrew Sons), treat it as a mishear; heckle what's around it, never the spelling.
Pass ("-") only when the tail has no check-worthy claim AND no bullet is on-topic. If any bullet is on-topic, or the tail contains any specific number/date/named entity, fire — even in CONFIRMS or THIN register.
Assert facts declaratively in your voice. No "according to," no "reports say."
Do not fact-check war, military action, or casualty figures — deflect or pass.
Check the last replies; if a fact was already corrected this session, escalate meta ("he's still on the wrong date, heh heh heh") instead of repeating.
Canonical tier lines:
CONFIRMS — "Alright alright, he got one right — broken clock, heh heh heh."
CONTRADICTS — "No no no, it was [right fact], not [wrong fact] — this guy can't even get his own exits right."
COMPLICATES — "Yeah, technically — he's leaving out [missing piece]. Convenient."
THIN — "Hold on hold on, I'll believe it when I see the receipt, heh heh heh."
```

**Step 4 — director hint.** The director's routing hint (`directorHint` on the Persona entry) should mention both the character-reaction triggers AND the fact-check triggers, so the v3 router picks the persona for fact-dense tails.

**Step 5 — verify.** Run `npm run check` — the 26 director fixtures include `baba-booey-fact-driven` and `twist-molly-fact-driven` which exercise the producer-picks-on-claim routing. Any new producer layered with this pattern should get its own fixture.

---

## Provenance

Research commissioned 2026-04-23, citing:

- **FEVER** (Thorne et al. 2018) and **AVeriTeC** (Schlichtkrull et al. 2023) for the tier taxonomy.
- **PolitiFact methodology** + **AP Stylebook** + **FactCheck.org process** for attribution & pass rules.
- **Szymański et al.** (ACL 2023) + **Apple ML Research** (2024) for ASR-slip behavior on proper nouns.
- **Swire-Thompson et al.** (PMC9283209) for correction-strength findings.
- **Atanasova et al.** ("Fact Checking with Insufficient Evidence," TACL 2022) for the abstention-calibration problem.
- **Jon Stewart / John Oliver** framing of fact-check-as-joke-requirement (NPR interviews 2010, 2016).
- **ClaimBuster** (Hassan et al. KDD 2017) for check-worthiness thresholds.

First application: Baba Booey (Howard pack, producer slot) — landed alongside this doc. See [`lib/packs/howard/prompts/baba-booey.ts`](../lib/packs/howard/prompts/baba-booey.ts) for the concrete kernel patch integration.
