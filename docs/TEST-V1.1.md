# Peanut Gallery — v1.1 Test Guide

Run this end-to-end before publishing v1.1 to the Chrome Web Store and before `railway up` on the backend.

What changed in this batch:

- **Persona context rebalance** — transcript is now the primary signal (~90%); conversation log trimmed from 20 entries → thin self-check. Fixes personas repeating "$2.4M house" 8 turns in a row.
- **Audio routing for podcasters** — new passthrough toggle + output device picker. Lets OBS / Riverside / BlackHole / VB-Audio users avoid doubled audio.
- **Start/Stop state-machine fix** — START_RECORDING errors in the offscreen doc now propagate back to the side panel. Root cause of the "tap Start, nothing happens, need Stop+Start dance" bug.

## 0. Prep (5 min)

Backend running locally OR reachable at https://peanutgallery.live. If you're about to deploy to Railway, test against localhost first, then re-test against production after `railway up`.

- [ ] `npx tsc --noEmit` — clean
- [ ] In Chrome: `chrome://extensions/` → Developer mode on → Load unpacked → pick `extension/` folder
- [ ] Confirm the version badge in the side panel reads what you expect (`v1.0.6` pre-bump, `v1.1.0` after bump)
- [ ] Confirm Deepgram + Groq + Anthropic keys are filled; Brave optional
- [ ] Open a YouTube video you're familiar with (ideally one with claims you know are wrong — makes Baba easier to evaluate)

## 1. Happy path smoke test (2 min)

Baseline — if this fails, stop and debug before running the rest.

- [ ] Click the 🥜 icon on the YouTube tab → side panel opens
- [ ] Click "Start Listening"
- [ ] Status bar transitions: grey dot → green pulsing dot within ~2s
- [ ] Transcript text starts flowing within ~5s of audio actually playing
- [ ] At least 2 of the 4 personas produce a reaction within ~30s
- [ ] Click a persona avatar → that persona fires on demand
- [ ] Click 🔥 React → all 4 personas fire
- [ ] Click Stop → UI returns to setup view, dot goes grey

## 2. Start/Stop state bug (the repro you reported)

This is the bug we just fixed. If it reproduces, the fix didn't take.

- [ ] Land on a fresh YouTube tab. Side panel open, in idle state.
- [ ] **Tap "Start Listening" WITHOUT clicking the peanut icon first.** Expected: red error banner "No fresh capture session. Click the 🥜 icon…". Side panel stays in setup view.
- [ ] **Tap the 🥜 peanut icon in the toolbar.** No visible change in the panel; stream is stashed in background.
- [ ] **Tap "Start Listening" again.** Expected: capture starts cleanly — status dot goes green, transcript flows, personas react within ~30s. **Failure mode (old bug): status flips to "Waiting for audio…" but transcript stays blank forever, requires Stop+Start to recover.** If you see this, the fix didn't take.
- [ ] Variant: tap Stop, then without tapping peanut, tap Start immediately. Expected: error banner, NOT silent hang.

## 3. Persona context rebalance

The thing that had personas saying "$2.4 million house" in 8 straight turns. Test on content with a memorable specific claim — a price, a valuation, a founding year.

- [ ] Find a video segment that names a specific number ("Series B at $80M valuation", "raised $2.4M", "founded in 2012", etc.). Let Peanut Gallery run through it for ~90 seconds.
- [ ] **Watch how the personas refer to that number across turns.** Expected: the full literal ("$2.4 million house") appears maybe once or twice, then the personas shift to short references ("the house", "that price", "it"). Old behavior: the same literal phrase repeated every single turn.
- [ ] **Character tics should still be present** — the rebalance was supposed to preserve these:
  - [ ] Baba Booey uses "Technically…", "Right, so actually…", "Hold on, hold on…" occasionally
  - [ ] Jackie lands rule-of-three jokes, punchline word at the end
  - [ ] Fred drops [bracketed sound cues] like [record scratch], [sad trombone], [crickets]
  - [ ] The Troll names specific targets, ends with a twist
- [ ] **The transcript should be the clear driver.** If the video moves to a new topic, the personas should follow within 1–2 turns, not keep riffing on the old topic. This is the 90%-transcript rule working.

## 4. Audio routing — podcaster options

New section in setup panel. Defaults to pre-v1.1 behavior (passthrough ON, system default). Test that defaults still work AND that the new toggles work.

- [ ] Expand "Audio routing — podcaster options"
- [ ] Default state: passthrough checkbox checked, device dropdown = "System default"
- [ ] **Passthrough ON, default device** — you hear the video through your speakers/headphones as before. Unchanged from v1.0.x.
- [ ] **Toggle passthrough OFF mid-session.** Expected: audio goes silent in your ears within ~1s. Transcript KEEPS flowing. Personas KEEP reacting. This is the key proof that passthrough only controls playback, not capture.
- [ ] **Toggle passthrough ON again.** Audio resumes.
- [ ] **Device dropdown** — after the section is first opened, dropdown should populate with your actual output devices (may require having started capture once, or granted mic permission to the extension origin). If you only see "System default", that's expected on a fresh install until capture runs once.
- [ ] **Pick a different device mid-session.** Passthrough should route to that device live — no Stop/Start needed.
- [ ] **Pick a device, then unplug/disable it.** Expected: falls back silently to "System default", DevTools console logs a warning. No crash, no blank transcript.
- [ ] **Close and reopen the side panel** — passthrough + device selection should persist (chrome.storage.local).

### Optional — real podcaster stack (skip if you don't have one handy)

- [ ] **OBS with Desktop Audio source** — passthrough ON, OBS captures. Test recording has the clip audio. Flip passthrough OFF — OBS should NO longer have clip audio in the recording (because nothing's playing through speakers).
- [ ] **BlackHole 2ch (macOS)** — install it, pick it as the output device. Passthrough ON. Open Audacity/any recorder with BlackHole as input — should hear the clip there, NOT through speakers.

## 5. Error path surfacing

The start/stop fix propagates errors back that were previously silent. Validate each error is visible and actionable.

- [ ] **Invalid Deepgram key** — swap in a junk key, Start. Expected: red error banner with a specific message, NOT silent hang.
- [ ] **Backend unreachable** — point server URL at `http://localhost:9999` (nothing running). Start. Expected: error about connection refused or server unreachable; UI returns to setup view.
- [ ] **Stale streamId** — tap peanut, then wait 90 seconds (past the 60s TTL), then tap Start. Expected: "No fresh capture session" error, prompting you to tap peanut again.
- [ ] **Tab closed mid-capture** — close the YouTube tab. Expected: capture stops gracefully within a few seconds; side panel returns to idle. No orphan "Waiting for audio" state.

## 6. Backend deploy workflow (Railway)

The persona rebalance changes live in `lib/persona-engine.ts` and `lib/personas.ts` — those have to go out via `railway up`.

**Pre-flight:**

- [ ] `git status` — confirm the only uncommitted changes are the ones you intend to ship (lib/ for backend, extension/ for zip)
- [ ] If you have any untested v1.0.6 backend work in lib/ that ISN'T meant for v1.1, `git stash push -m "v1.0.6-wip" lib/path/to/file.ts` before deploying

**Deploy:**

- [ ] `railway up` from the repo root
- [ ] Wait for build to complete; watch the logs for errors
- [ ] Hit `https://peanutgallery.live` — landing page loads
- [ ] `curl https://peanutgallery.live/api/health` (or whatever health endpoint you have) returns 200

**Post-deploy smoke test:**

- [ ] Switch extension's Server URL field to `https://peanutgallery.live`
- [ ] Re-run §1 Happy path against production
- [ ] Re-spot-check §3 persona rebalance on a live video — verify the new behavior is what you saw locally

## 7. Chrome Web Store publish

Only after everything above is ✅.

- [ ] `extension/manifest.json` → version bumped to `1.1.0`
- [ ] `extension/sidepanel.html` → version badge updated to `v1.1.0`
- [ ] Extension zip built and sitting in the workspace folder
- [ ] Zip contents don't include `.DS_Store`, `*.swp`, or anything else unwanted
- [ ] Upload to CWS dashboard → fill in the v1.1 notes (passthrough toggle for podcasters, persona context rebalance, start/stop reliability)
- [ ] Once the CWS review is live, do ONE final end-to-end on the published extension — re-install from the store, not the unpacked dev build

## Rollback plan

If the v1.1 extension has a regression that lands users in a broken state:

- **Client:** CWS reviewers can be asked to pull the version, or you can ship a v1.1.1 with the single-file fix
- **Backend:** `railway` dashboard → "Deployments" → redeploy the last v1.0.5 commit, OR `git revert` the lib/ changes and `railway up` again

Persona rebalance is backend-only, so a client rollback doesn't fix persona behavior and a backend rollback doesn't affect the installed extension. Test both independently.
