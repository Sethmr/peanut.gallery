# TWiST Oracle — Private Notes

> **PRIVATE EXPLORATORY PLANNING.** Not part of the public roadmap. Not referenced in commits, changelogs, or version planning. Not in `ROADMAP.md`, not in `INDEX.md` source-of-truth, not in CWS listings. Jason shared the idea informally in a group chat and Seth is thinking it through here. Treat as napkin math until Seth explicitly moves it to the roadmap.

**Do not:** bump versions toward this, scaffold code for it, add it to commit messages, or cite it from other project docs. If a future session sees this file, the correct response is "noted, not acting on it."

---

## The seed

Jason Calacanis, in the TWIST NOTI GANG group chat, 2026-04-18:

> "Feel free to make a TWIST SML / oracle fam... imagine 2,400 episodes in one language model giving folks startup advice and deep links to clips!"

Context: Seth mentioned he'd trained a local persona model on Jason and his podcasts. Jason's reply is a verbal green light to go bigger — a knowledge layer on the full TWiST archive that can answer startup questions and deep-link to specific clips.

## Rough direction (if this ever becomes real)

**Front-end-first.** Any execution starts with UI work — an ask-mode interface, a clip-card component, deep-link presentation, history — built against a mock API. The front end should be backend-agnostic and demo-able on its own.

**Backend handled externally.** Corpus build, transcription, RAG pipeline, embeddings, vector DB, and any YouTube/licensing exposure would be owned by someone outside the Peanut Gallery project. We'd only plug in once their data or API is open-sourced. This keeps legal + cost + ops risk off the main project.

**Slots in after v1.6, not sooner.** Voice (v1.6) gives the oracle personas audio; Clip Share (v1.6) gives deep links a shareable format. Oracle only makes sense once those two land.

## Why it's interesting (when/if we come back to it)

- Turns Peanut Gallery into something useful between episodes, not just during them.
- Every answer drives a view on Jason's back catalog — distribution mechanic for TWiST, aligned incentive.
- The pack system already scopes this naturally: one oracle per pack with a corpus. Howard pack has no corpus (Stern archive is paywalled), TWiST pack could.
- Multi-persona response with cited clips is a differentiated UI surface — Dmooji, NotebookLM, and the rest don't do it.

## Why we're not building it now

- Backend is the expensive part (corpus, embeddings, vector DB, legal exposure around YouTube ToS + show copyright). Doing it right needs someone to own that.
- Jason's "feel free" is a verbal cue, not a license. Commercial distribution of transcripts needs a written agreement — out of scope for us.
- v1.5 canary, v1.6 Voice + Clip Share, and the Pack Lab direction are all ahead of this in priority.
- Shipping something half-built risks the TWiST relationship more than shipping nothing.

## Open threads

- If a collaborator ships the data/API, what does the plug-in look like? (Front-end spec lives privately; not committed anywhere public.)
- Does Jason want to be looped in before anything is shown? Probably yes — this is his archive.
- If we ever do build toward this, snippet length in responses caps at ~25 words per citation + a timestamped deep link. No full-transcript redistribution.

---

*Private notes. Last touched 2026-04-18. If this file is referenced from any public artifact (ROADMAP, CHANGELOG, CWS listing, commit message, session notes), something has gone wrong — remove the reference.*
