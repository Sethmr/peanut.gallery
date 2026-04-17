# Peanut Gallery — Podcaster Audio Setup

Practical guide for running Peanut Gallery alongside common podcast recording stacks without audio doubling, echo, or a YouTube clip bleeding into your main mix.

## TL;DR

Open the side panel → **Audio routing — podcaster options** and decide:

1. **Passthrough** — do you want to hear the captured tab audio through the extension?
2. **Output device** — if yes, which output device should the passthrough play to?

Default (passthrough ON, system default) matches the pre-v1.1 behavior and is correct for casual listening. For recording workflows, see below.

## How the capture works

Peanut Gallery uses `chrome.tabCapture` to grab the audio from the active YouTube tab. Chrome mutes the tab when `tabCapture` is active, so by default the extension routes the captured stream back to your system default output device so you still hear the video. That re-routed audio is what your recording software may or may not pick up, depending on your setup.

Two dials matter:

- **Passthrough** (on/off) — whether the extension plays the captured audio at all. When off, the tab is captured silently and no audio reaches your speakers from Peanut Gallery. Use this when a different process is already responsible for playing the audio (recording software, virtual cable, second browser, etc.).
- **Output device** — when passthrough is on, which device hears it. Use this to route passthrough to a monitor-only output your recording rig does not capture, or to pipe it directly into a virtual cable so it shows up on a specific input in your recording software.

Peanut Gallery still sends mono 16 kHz PCM to Deepgram for transcription regardless of passthrough setting — the personas will keep reacting either way.

## Setups

### OBS Studio (macOS / Windows)

OBS can capture desktop audio directly. Two common patterns:

**You want the YouTube clip in your recording.** Passthrough ON, output device = System default (or whichever device OBS is capturing via "Desktop Audio"). Nothing else to do.

**You don't want the clip in your recording but you still want to hear it.** Passthrough ON, output device = a monitor-only device OBS is not capturing — for example, a separate headphone output or a virtual cable routed to your monitor bus but not to the Desktop Audio source. If you only have one output, turn Passthrough OFF and play the YouTube tab in a second window OBS can't see (or use OBS's Browser Source with "control audio via OBS" to take Peanut Gallery out of the loop entirely).

**You want transcription only, no video audio in the mix.** Passthrough OFF. Peanut Gallery stays silent but still transcribes; your guests won't hear the clip.

### Riverside.fm

Riverside records locally via the browser and captures the microphone, not desktop audio. By default your YouTube tab audio **does not** get recorded on Riverside — it only records mic tracks.

- Passthrough ON, System default is typically fine. Guests won't hear it unless you share the tab via Riverside's "Share your screen" with audio.
- If you do share the screen with audio, Riverside captures the tab audio itself — turn Peanut Gallery's Passthrough OFF to avoid a double copy playing through your speakers and bleeding back into your mic.

### SquadCast

Same logic as Riverside — records the mic, not desktop audio, unless you explicitly share screen + audio. Defaults work; toggle Passthrough OFF if SquadCast is already playing the tab for you.

### Zencastr

Web-based, records local mic tracks. Same advice as Riverside / SquadCast.

### Zoom / Google Meet / Teams

These call apps capture mic by default, not system audio. If you use "Share screen with sound" they'll capture tab audio themselves — set Peanut Gallery Passthrough OFF so it doesn't play in your ears as well and bleed back through the mic.

### BlackHole / Loopback (macOS)

Virtual audio cables let you route Peanut Gallery's passthrough to a specific "device" that other apps can then read as an input.

- Install BlackHole 2ch (free) or Loopback (paid).
- In Peanut Gallery, set Output device = BlackHole 2ch.
- In your recording software, select BlackHole 2ch as the audio input.
- If you also want to hear the audio yourself, use Loopback or the built-in macOS Multi-Output Device to mirror BlackHole to your headphones. Or use a Loopback "Pass-Thru" device.

### VB-Audio Voicemeeter / VB-Cable (Windows)

Same pattern as BlackHole:

- Install VB-Cable (free) or Voicemeeter Banana/Potato (donationware).
- Peanut Gallery Output device = CABLE Input (VB-Audio Virtual Cable) or a Voicemeeter input strip.
- OBS / Audacity / etc. record from CABLE Output or the Voicemeeter virtual ASIO device.
- For monitoring, mirror the signal to your physical output inside Voicemeeter.

### RODECaster Pro II

The RODECaster is a hardware mixer. Point your computer's USB output at a specific channel on the RODECaster and you can mix / monitor / record the YouTube audio as its own fader.

- Peanut Gallery Output device = RODECaster Pro II (or the specific input it exposes — "USB Chat", "USB Main", etc. depending on config).
- On the board, assign that USB input to a channel and decide whether it goes to your show mix, your mix-minus, and your headphones.
- Passthrough ON. The RODECaster handles who hears what.

### GoXLR / GoXLR Mini

TC Helicon's gaming / streaming mixer exposes virtual inputs on Windows (System, Chat, Music, Sample, Game, etc.).

- Peanut Gallery Output device = one of the virtual inputs (Music or System are common).
- Route that channel to your headphones and/or broadcast mix in the GoXLR app.
- Passthrough ON.

### Elgato Wave XLR

Wave XLR + Wave Link gives you up to 9 virtual inputs.

- Peanut Gallery Output device = Wave Link input (System, Browser, Voice Chat, etc.).
- Mix it into your monitor and/or stream feed inside Wave Link.
- Passthrough ON.

## What Peanut Gallery does NOT do

- **Does not intercept your microphone.** The extension only taps the active YouTube tab. Your mic is never read, recorded, or sent anywhere.
- **Does not resample or touch your system audio config.** It asks the browser for an output sink, nothing more.
- **Does not force stereo** — the passthrough path is currently mono because the capture path is mono. A future release will preserve stereo for the passthrough while keeping the capture mono for Deepgram.

## Troubleshooting

- **"I toggled passthrough off but still hear audio"** — Chrome's default tab-capture mute is already in effect when Peanut Gallery captures. If you still hear the tab, another tool (OBS, a duplicate tab, BlackHole monitoring) is playing it. Silence that source.
- **"Device dropdown only shows 'System default'"** — expand the Audio section and start capture once; Chrome only populates device names after media permission is active. Or grant microphone permission to the extension's origin once.
- **"Audio went silent after I picked a device"** — that device may not exist (unplugged headphones, closed virtual cable). Switch back to "System default" and the extension will log a warning in DevTools and fall back gracefully.
- **"Personas stopped reacting when passthrough is off"** — they shouldn't. Passthrough only controls what you hear; transcription runs unchanged. If personas go silent, check the side panel status bar and browser DevTools console for a different issue.

## Developer notes

The implementation is in `extension/offscreen.js`:

- A `GainNode` sits between the `ScriptProcessor` and `AudioContext.destination`. The processor must stay connected to destination or `onaudioprocess` stops firing — the gain simply mutes the path when passthrough is off without breaking capture.
- `AudioContext.setSinkId()` handles output device routing. Falls back silently if unsupported (< Chrome 110) or if the device is unknown.
- Settings are live-updatable via an `UPDATE_AUDIO_SETTINGS` message from the side panel; no need to stop and restart capture when you toggle.
