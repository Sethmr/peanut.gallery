# BUILD-YOUR-OWN-BACKEND.md

> **Audience:** an AI coding assistant (Claude, GPT, Cursor, etc.) or a human
> developer who wants to build a backend that the Peanut Gallery Chrome
> extension can point at. This document is the **canonical wire spec**. Follow
> it exactly and the official Chrome extension will talk to your server with
> zero changes on the extension side.
>
> **What you are building:** a drop-in replacement for the Next.js reference
> backend in [`app/api/`](../app/api) of this repo. You do NOT have to use
> Next.js, Node, TypeScript, or the reference code. Pick any stack. The only
> thing that matters is that your server honors the contracts in this doc.
>
> **Companion docs:**
> — [`SELF-HOST-INSTALL.md`](SELF-HOST-INSTALL.md) — how to run the reference
>   backend locally (if you just want to self-host without rebuilding).
> — [`CONTEXT.md`](CONTEXT.md) — the canonical project context.
> — [`extension/README.md`](../extension/README.md) — what the extension is
>   doing on the other side of the wire.

---

## Contents

1. [Non-negotiables (read first)](#non-negotiables-read-first)
2. [Compatibility contract](#compatibility-contract)
3. [Endpoint specs](#endpoint-specs)
4. [SSE event protocol](#sse-event-protocol)
5. [Audio format (browser mode)](#audio-format-browser-mode)
6. [Provider integrations](#provider-integrations)
7. [Director + cascade rules](#director--cascade-rules)
8. [Persona prompts and voice rules](#persona-prompts-and-voice-rules)
9. [Required environment variables](#required-environment-variables)
10. [Build phases (use this as your task list)](#build-phases-use-this-as-your-task-list)
11. [Acceptance tests — how to prove compatibility](#acceptance-tests--how-to-prove-compatibility)
12. [Things that WILL break the extension](#things-that-will-break-the-extension)

---

## Non-negotiables (read first)

These are the rules a compatible backend must honor. If any of them are wrong,
the extension will either hang, 400, or silently drop events. Every one of
them is verified by the acceptance tests at the bottom of this doc.

1. **HTTPS, with valid CORS.** The extension calls you from a
   `chrome-extension://...` origin. You MUST answer preflight `OPTIONS`
   requests with the CORS headers listed in [Endpoint specs](#endpoint-specs).
2. **SSE response from `POST /api/transcribe`.** Content-Type
   `text/event-stream`, no buffering, `X-Session-Id` header present, and
   `X-Session-Id` exposed via `Access-Control-Expose-Headers`.
3. **Audio is PCM, 16-bit, mono, 16 kHz, little-endian, base64-encoded,
   sent as `PATCH /api/transcribe`** with `{sessionId, action: "audio_chunk",
   audio: "<base64>"}`. Chunk size ≈ 250 ms. Anything else and Deepgram
   will reject the frames.
4. **The four persona IDs are `producer`, `troll`, `soundfx`, `joker`.**
   These are hard-coded into the extension UI. You can add more, but you
   CANNOT rename these.
5. **All API keys may come in via request headers,** not just env:
   `X-Deepgram-Key`, `X-Anthropic-Key`, `X-XAI-Key`, `X-Brave-Key`. Honor
   whichever is set per-request; fall back to env only if the header is
   missing. The extension also sends `X-Search-Engine` (`brave` | `xai`) to
   pick the Producer's fact-check backend per session.
6. **`/api/health` returns a 200 JSON health payload when healthy, 503 when
   degraded.** Monitoring and the extension both rely on this shape.
7. **Never log API keys.** Log request IDs, persona IDs, and transcript
   lengths — never the secrets themselves.
8. **`X-Install-Id` is an advisory header** sent by the extension on every
   `POST /api/transcribe`. It's a UUID the extension persists in
   `chrome.storage.local` on first launch. You don't have to do anything
   with it — but if you want to meter shared demo-key usage per install
   (see `lib/free-tier-limiter.ts` in the reference backend for one
   approach), this is the identifier to key on. Your CORS
   `Access-Control-Allow-Headers` MUST include it; otherwise the browser
   strips it on preflight. Return **HTTP 402** with
   `{ error, code: "TRIAL_EXHAUSTED", retryAfterMs, resetAt }` when a
   limit is hit — the official extension recognises that code and opens
   its keys accordion automatically.

If you're implementing this with an AI coding assistant, copy-paste those
eight points into its rules/system prompt first. They are the ones that
matter most.

---

## Compatibility contract

The Chrome extension does all of the following against your server:

| Method   | Path                         | Purpose                                       |
| -------- | ---------------------------- | --------------------------------------------- |
| `GET`    | `/api/health`                | Liveness + key configuration check            |
| `OPTIONS`| `/api/transcribe`            | CORS preflight                                |
| `POST`   | `/api/transcribe`            | Start a session, open SSE stream              |
| `PATCH`  | `/api/transcribe`            | Feed audio chunks, trigger personas, etc.     |
| `DELETE` | `/api/transcribe`            | Stop a session                                |
| `POST`   | `/api/personas`              | (Optional) Fire all personas against a string |

If all six behave exactly as specified, the extension works. You do not need
`/api/personas` for the extension itself — it's only used by the legacy
reference web app (`/watch` on the self-hosted backend) and by the internal
test scripts.

---

## Endpoint specs

### `GET /api/health`

**Request:** none.

**Response (healthy, status 200):**

```json
{
  "status": "healthy",
  "server": true,
  "keys": {
    "deepgram": true,
    "anthropic": true,
    "xai": true,
    "brave_search": false
  },
  "binaries": {
    "yt-dlp":  { "found": true, "path": "/usr/local/bin/yt-dlp" },
    "ffmpeg":  { "found": true, "path": "/usr/local/bin/ffmpeg" }
  }
}
```

**Response (degraded, status 503):** same shape, with `status: "degraded"`
and the offending keys/binaries reported as `false` / `{ "found": false }`.

Rules:

- `keys` reflects env vars only (not per-request header keys).
- `binaries` is allowed to be empty `{}` if your implementation doesn't use
  yt-dlp/ffmpeg (e.g. extension-only deployments).
- `brave_search` is allowed to be `false` without triggering `degraded` —
  it's optional (only required when `SEARCH_ENGINE=brave`). The server
  needs `deepgram` plus at least one of `anthropic` / `xai` to be healthy.

### `OPTIONS /api/transcribe`

Must return status `204` and these headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Deepgram-Key, X-Anthropic-Key, X-XAI-Key, X-Brave-Key, X-Search-Engine, X-Install-Id
Access-Control-Expose-Headers: X-Session-Id
Access-Control-Max-Age: 86400
```

Every other response from this route MUST include the same `Access-Control-*`
headers — not just `OPTIONS`.

### `POST /api/transcribe`

**Request body (JSON):**

```json
{
  "url": "https://www.youtube.com/watch?v=...",   // or "browser-mode" placeholder
  "mode": "browser",                              // "browser" | undefined (server mode)
  "isLive": false                                 // hint only; server may re-detect
}
```

**Request headers (all optional if env is set):**

```
X-Deepgram-Key:   <key>
X-Anthropic-Key:  <key>   // Claude Haiku — powers Producer + Joker. Required unless xAI is set.
X-XAI-Key:        <key>   // xAI Grok 4.1 Fast — powers Troll + Sound FX. Required unless Anthropic is set.
X-Brave-Key:      <key>   // required when X-Search-Engine=brave; ignored otherwise
X-Search-Engine:  brave | xai   // default: brave. Picks Producer's fact-check backend.
X-Install-Id:     <uuid>  // per-installation id. Advisory; used by the
                          // hosted backend for per-install rate limiting.
                          // Safe to ignore on self-hosted instances.
```

**Validation:**

- If no Deepgram key OR no LLM key (neither Anthropic nor xAI set, from
  either header or env), return `400 { "error": "Missing required API keys. ..." }`.
  Do **not** 500.
- When `X-Search-Engine=brave` (or omitted, since brave is default), a Brave
  key is also required if the server is expected to fact-check. Missing it
  should silently disable Brave search rather than 400 the whole session.
- If `url` is missing, return `400 { "error": "Missing YouTube URL" }`.
- If you're running a hosted backend with shared demo keys and you want to
  meter per-install usage, return `402` with
  `{ error, code: "TRIAL_EXHAUSTED", quotaMinutes, windowHours, retryAfterMs, resetAt }`
  when a quota is exhausted. The official extension recognises
  `TRIAL_EXHAUSTED` and opens its API-keys accordion automatically.

**Response:**

- Status `200`.
- `Content-Type: text/event-stream`.
- `Cache-Control: no-cache, no-transform`.
- `Connection: keep-alive`.
- `X-Session-Id: <string>` (extension reads this off the response headers to
  route future `PATCH`/`DELETE` calls).
- Body: an SSE stream. See [SSE event protocol](#sse-event-protocol).

The stream stays open until the client disconnects (`AbortSignal`) or the
pipeline emits `status: stopped`.

### `PATCH /api/transcribe`

**Request body (JSON):**

```json
{
  "sessionId": "<from X-Session-Id>",
  "action":    "audio_chunk" | "force_fire" | "fire_persona" | "pause" | "resume",
  // action-specific:
  "audio":       "<base64>",     // audio_chunk only
  "personaId":   "producer",      // fire_persona only
  "forceReact":  true             // optional on force_fire
}
```

**Responses:**

| Action         | Success                                                           | Errors                                 |
|----------------|-------------------------------------------------------------------|----------------------------------------|
| `audio_chunk`  | `200 { "ok": true }`                                              | `400 { "error": "Missing audio data" }`|
| `force_fire`   | `200 { "fired": true, "forceReact": <bool> }`                     |                                        |
| `fire_persona` | `200 { "fired": true, "personaId": "<id>" }`                      | `404 unknown persona`                  |
| `pause`/`resume` | `200 { "ok": true, "deprecated": "silence is auto-detected" }` | (intentional no-op)                    |
| anything else  | `400 { "error": "Invalid action" }`                               |                                        |
| unknown session| `404 { "error": "Session not found" }`                            |                                        |

`pause` and `resume` must stay as successful no-ops — older extension builds
still in the wild send them, and breaking backward compatibility would silently
freeze those users.

### `DELETE /api/transcribe`

**Request body:** `{ "sessionId": "<id>" }`.

**Responses:**

- `200 { "stopped": true }` on success.
- `404 { "error": "Session not found" }` if the session isn't known.

After this call, tear down everything: Deepgram connection, any subprocess,
the persona interval, and remove the session from the session map.

### `POST /api/personas` *(optional — web-app convenience only)*

**Request body:** `{ "transcript": "<string>" }`.

**Response:** an SSE stream that fires all four personas and emits
`persona` / `persona_done` / `status` / `error` events. No sessionId needed.

---

## SSE event protocol

Every event is a standard SSE frame:

```
event: <name>
data: <json>

```

(Blank line terminator, single newline between `event:` and `data:`.)

### Event types

| Event          | When                                        | Data shape                                          |
|----------------|---------------------------------------------|-----------------------------------------------------|
| `transcript`   | Deepgram returned text                      | `{ text, isFinal, timestamp }`                      |
| `persona`      | Streaming token chunk from a persona        | `{ personaId, text }` — `text` is a partial delta   |
| `persona_done` | Persona finished streaming                  | `{ personaId }`                                     |
| `status`       | Pipeline lifecycle / state change           | `{ status, ...extras }` (see table below)           |
| `error`        | Recoverable or fatal error                  | `{ message }`                                       |

### `status` sub-values (extension branches on these)

| status                 | Extras                        | Meaning                                           |
|------------------------|-------------------------------|---------------------------------------------------|
| `started`              | `sessionId`                   | Pipeline created                                  |
| `deepgram_connected`   |                               | Transcription WS open                             |
| `live_detected`        | `isLive: boolean`             | Server decided live vs. recorded                  |
| `detail`               | `message: string`             | Human-readable status line                        |
| `personas_firing`      | optional `personaId`          | Cascade in progress                               |
| `personas_complete`    |                               | Cascade done                                      |
| `stopped`              |                               | Session ended; stream can close                   |
| `deepgram_disconnected`|                               | WS closed (reconnect attempt likely)              |

Clients that receive an unknown `status` MUST ignore it safely. Never rename
an existing one — add new ones only.

### `persona` streaming semantics

- The server pushes **deltas** (new tokens only), not the full accumulated
  text. Clients concatenate deltas in order.
- `personaId` is one of `producer | troll | soundfx | joker`. No other IDs.
- The server may interleave deltas from different personas in the same
  cascade; clients keyed on `personaId` must route correctly.
- Close out each persona with exactly one `persona_done` event.

---

## Audio format (browser mode)

The extension captures tab audio with `chrome.tabCapture`, downsamples in an
offscreen document, and POSTs it to you. Requirements:

- **Encoding:** PCM, signed 16-bit, little-endian (`s16le`).
- **Channels:** mono (1).
- **Sample rate:** 16 kHz (16000).
- **Chunk cadence:** one `PATCH` per ~250 ms of audio (approximately 8000
  bytes per chunk before base64).
- **Transport:** each chunk is base64-encoded and sent as
  `PATCH /api/transcribe` with body `{sessionId, action: "audio_chunk",
  audio: "<base64>"}`.

**Forwarding to Deepgram:** open a WebSocket to
`wss://api.deepgram.com/v1/listen` with the query:

```
encoding=linear16
sample_rate=16000
channels=1
model=nova-3
smart_format=true
interim_results=true
endpointing=300
```

Authenticate with `Authorization: Token <deepgram-key>`. Forward each incoming
PCM chunk verbatim. Send a Deepgram keepalive (`{"type":"KeepAlive"}`) every
5–10 s of silence to prevent idle disconnect.

Treat Deepgram messages with `type: "Results"` and `is_final: true` as a
transcript chunk; emit them as an SSE `transcript` event.

---

## Provider integrations

### Deepgram Nova-3 (transcription) — required

- WebSocket: `wss://api.deepgram.com/v1/listen`
- Auth: `Authorization: Token <key>` header on the upgrade request.
- Model: `nova-3`.
- Target latency: <300 ms.

### xAI Grok (troll + soundfx slots) — required

- Endpoint: `POST https://api.x.ai/v1/chat/completions`
- Auth: `Authorization: Bearer <key>`.
- Model: `grok-4-1-fast-non-reasoning` for both troll and soundfx. The
  non-reasoning variant is deliberate — reflexive output is what makes the
  voices land; reasoning mode kills the timing.
- Streaming: `stream: true`. Emit deltas into `persona` SSE events as they
  arrive.
- Wrap each stream in an abort signal with a **25s** budget. Anything slower
  and the user has already given up on that response.
- If no xAI key is configured, `troll` and `soundfx` stay silent — emit
  `persona_done` immediately. Do not error. (Note: the reference backend
  previously ran these slots on Groq Llama; v1.4 migrated off. Any backend
  that still reads `GROQ_API_KEY` / `X-Groq-Key` is stale and will not match
  the extension's current header set.)

### Anthropic (producer + joker slots) — required (unless xAI is also missing)

- SDK: `@anthropic-ai/sdk` or direct `POST https://api.anthropic.com/v1/messages`
- Auth: `x-api-key: <key>`, `anthropic-version: 2023-06-01`.
- Model: `claude-3-5-haiku-latest`.
- Wrap each stream in a **25s** abort budget (same as xAI).
- If no Anthropic key is configured, `producer` and `joker` stay silent —
  return `persona_done` immediately without any `persona` events for those IDs
  during their turn. Do not error.
- The server needs at least one of Anthropic/xAI; if both are missing
  reject the session with `400 Missing required API keys`.

### Search engines (fact-checking) — one required when fact-checking is on

The Producer slot picks up either **Brave Search** or **xAI Live Search**
depending on the `X-Search-Engine` header (defaults to `brave`). If no search
engine is reachable, the Producer still runs — it just relies on the model's
training knowledge. Never fail the pipeline on a missing search key. Search
failures emit the `search_*` pipeline events documented in
[`DEBUGGING.md`](DEBUGGING.md); the Producer still fires.

**Brave Search** (default; `X-Search-Engine: brave`)

- Endpoint: `GET https://api.search.brave.com/res/v1/web/search?q=<encoded>`
- Auth: `X-Subscription-Token: <key>`.
- Abort budget: **5s**. Queued per claim; up to 3 claims per round.

**xAI Live Search** (`X-Search-Engine: xai`)

- Uses the same `X-XAI-Key`. Call
  `POST https://api.x.ai/v1/chat/completions` with
  `search_parameters: { mode: "on", sources: [{ type: "web" }], max_search_results: 5, return_citations: true }`
  to get the Producer a search snippet and citations in one round-trip.
  No separate search signup.
- Abort budget: **8s**. Typically slower than Brave because the LLM round-trip
  is inside the search call.

**Important**: the Producer's **force-react tap** (user clicks Baba's avatar or
the 🔥 button) should skip the pre-stream search entirely. The tap wants a
fast reaction more than a sourced one; blocking on a 5–8s search on a tap
visibly strands the spinner.

---

## Director + cascade rules

The Director picks WHO speaks. It runs every 5 seconds on the server while a
session is open. It does NOT call an LLM — it's pure pattern matching +
randomness. This keeps latency and cost down.

**Scoring for each persona:**

```
score = baseline
      + 2 * pattern_matches     // strong signals (regex hits)
      + 1 * keyword_matches     // weak signals
      + dry_spell_boost         // +1 per cycle they haven't fired, cap at +5
      - recency_penalty         // 0..4 based on how recent their last firing is
```

Use the patterns in [`lib/director.ts`](../lib/director.ts) as the reference —
every persona has a `patterns: RegExp[]` (hits worth 2) and
`keywords: RegExp[]` (hits worth 1). A dry-spell boost prevents any one
persona from monopolizing the mic; a recency penalty prevents the same
persona firing twice in a row.

**Cascade dice:**

- Primary persona: always fires (0 ms delay).
- Second persona: 50% chance, 2–3 s delay.
- Third persona: 35% chance, 2–3 s delay.
- Fourth persona: 20% chance, 2–3 s delay.
- On a **silence trigger** (transcript has been quiet ≥ 18 s), cap the
  cascade at 1–2 personas so dead air gets one crisp reaction, not a 4-way
  pile-on.

**Force-react burst:** when the PATCH action is `force_fire` with
`forceReact: true`, skip the Director entirely and fire all four personas in
parallel. This is what the 🔥 button in the side panel does — the user
always gets visible reactions.

---

## Persona prompts and voice rules

The reference prompts live in [`lib/personas.ts`](../lib/personas.ts). You
don't have to copy them verbatim, but you MUST keep the voice identifiable:

- **Baba Booey (producer)** — fact-checker. Short corrections with sources
  when possible. Stern-Show production-booth energy.
- **The Troll (troll)** — cynical, low-effort dunks. Says what the audience
  is thinking but won't type. ~1–2 sentences.
- **Fred Norris (soundfx)** — bracketed sound-effect cues (`[record scratch]`,
  `[sad trombone]`) plus the occasional razor-sharp one-liner.
- **Jackie Martling (joker)** — setup-punchline jokes. Observational comedy.
  Groaner puns are on-brand.

Every persona can "pass" by returning a single `-` character, which clients
render as "no reaction". On a force-react burst (see above), personas are
told explicitly NOT to pass — and if they pass anyway, the reference backend
substitutes a short archetype-keyed fallback string and emits it as the
persona's response (logged as `force_react_fallback` at warn level). This
is the v1.4 safety net that guarantees taps never produce an empty bubble.
Any compatible backend should implement the same guard on force-react paths.

### Optional: `directorHint` (v1.5+)

If your backend implements **Smart Director v2** (the LLM-assisted router
gated by `ENABLE_SMART_DIRECTOR`), each persona may carry an optional
one-sentence `directorHint` string — roughly 15 tokens — describing when
this specific voice at this slot should fire. The routing LLM sees each
persona's `id`, `name`, `role`, and (if present) `directorHint` every
tick. Hints disambiguate same-slot voices across packs (e.g. Stern's
Jackie at `joker` is rapid-fire one-liners; TWiST's Alex at `joker` is a
numerate data-joke comedian).

Hints are optional. Backends that omit them still route correctly — the
router falls back to `role` alone. Backends that don't implement the
Smart Director at all can ignore the field entirely. Token impact is
~60 tokens total per routing call (4 personas × ~15 tokens), which fits
inside the 400ms routing budget with room to spare.

See [`lib/personas.ts`](../lib/personas.ts) for the full `Persona`
interface and [`lib/packs/howard/personas.ts`](../lib/packs/howard/personas.ts)
for example hints.

---

## Required environment variables

| Var                       | Required?                         | Purpose                                   |
|---------------------------|-----------------------------------|-------------------------------------------|
| `DEEPGRAM_API_KEY`        | ✅                                | Transcription (fallback if header absent) |
| `ANTHROPIC_API_KEY`       | ✅ (unless `XAI_API_KEY` is set)  | Producer + Joker (Claude Haiku)           |
| `XAI_API_KEY`             | ✅ (unless `ANTHROPIC_API_KEY`)   | Troll + Sound FX (Grok 4.1 Fast); also powers Live Search |
| `SEARCH_ENGINE`           | Optional (default `brave`)        | `brave` \| `xai` — picks Producer's fact-check backend |
| `BRAVE_SEARCH_API_KEY`    | Only when `SEARCH_ENGINE=brave`   | Brave Search REST API                     |
| `ENABLE_SMART_DIRECTOR`   | Optional (v1.5+, default off)     | `true` turns on LLM-assisted routing (Claude Haiku, 400ms budget) per director tick; falls back to the rule-based scorer on timeout. Requires `ANTHROPIC_API_KEY`. |
| `YT_DLP_COOKIES_FILE`     | Optional                          | Server-mode YouTube URL path              |
| `YT_DLP_COOKIE_BROWSER`   | Optional                          | Server-mode YouTube URL path              |
| `YT_DLP_PLAYER_CLIENT`    | Optional                          | Server-mode YouTube URL path              |

If your server only supports browser-mode (recommended for new backends —
it's how the extension works), you can ignore everything yt-dlp related.

See [`.env.example`](../.env.example) for the exact names.

---

## Build phases (use this as your task list)

If you're feeding this spec to an AI coding assistant, ask it to work in these
phases and verify each one before moving on. That gives you cheap early
failure signals and prevents spending tokens on work that only breaks at the
end.

### Phase 1 — Scaffold + CORS

1. Init a project in your chosen stack.
2. Implement `OPTIONS /api/transcribe` returning the correct CORS headers.
3. Implement `GET /api/health` returning the health JSON (degraded is fine
   at this stage — just prove the shape is right).
4. **Verify:** `curl -sI -X OPTIONS <server>/api/transcribe` shows all five
   `Access-Control-*` headers and a 204.

### Phase 2 — Session + SSE plumbing

1. Implement `POST /api/transcribe` that creates a session, returns
   `X-Session-Id`, opens an SSE stream, and sends `status: started` then
   `status: stopped` after 30 s.
2. Implement `DELETE /api/transcribe` that ends a session.
3. **Verify:** `curl -N -X POST <server>/api/transcribe -H 'Content-Type:
   application/json' -d '{"url":"x","mode":"browser"}'` emits an SSE frame,
   and the response includes an `X-Session-Id` header.

### Phase 3 — Deepgram audio path

1. Implement `PATCH /api/transcribe` with `action: "audio_chunk"`.
2. Open a Deepgram WebSocket on session start.
3. Forward PCM chunks to Deepgram; emit `transcript` SSE events on final
   results.
4. Send KeepAlive pings on idle.
5. **Verify:** use the reference test script
   [`scripts/test-transcription.ts`](../scripts/test-transcription.ts) or
   feed any 16 kHz mono PCM file and confirm `transcript` events stream back.

### Phase 4 — Personas + Director

1. Implement the four persona prompt builders (see
   [`lib/personas.ts`](../lib/personas.ts)).
2. Implement provider streaming for xAI and Anthropic.
3. Implement the Director scoring function and the cascade dice.
4. On a 5 s interval, run the Director against the recent transcript and
   stream `persona` / `persona_done` events.
5. **Verify:** `scripts/test-personas.ts` or manually POST to
   `/api/personas` with a transcript — you should see 0–4 personas stream.

### Phase 5 — Force-react + fire-persona + Brave

1. Implement `PATCH action: "force_fire"` (director bypass when
   `forceReact: true`).
2. Implement `PATCH action: "fire_persona"` (queue a specific persona).
3. Implement the search-engine branch for the Producer's fact-check pipeline:
   Brave REST when `X-Search-Engine=brave`, xAI Live Search when
   `X-Search-Engine=xai`. Both emit the same claim/citation payload into
   the Producer's context.
4. **Verify:** with the real Chrome extension pointed at your server, play a
   YouTube video; click the 🔥 button; all four personas should fire.

### Phase 6 — Hardening

1. Reconnect logic for Deepgram (exponential backoff).
2. AbortSignal cleanup on client disconnect.
3. Per-session rate guards (e.g., cap at one cascade every 5 s).
4. Log redaction (never log the key itself).
5. **Verify:** run [`scripts/file-v1.1-issues.sh`](../scripts/file-v1.1-issues.sh)
   or the acceptance tests in the next section.

---

## Acceptance tests — how to prove compatibility

Run these from a shell. Replace `$SRV` with your server's base URL (e.g.
`http://localhost:3000`). A fully compatible backend passes every one.

```bash
# 1. CORS preflight
curl -sI -X OPTIONS "$SRV/api/transcribe" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: X-Deepgram-Key, X-Anthropic-Key, X-XAI-Key, X-Search-Engine' \
  -H 'Origin: chrome-extension://abcdef' \
  | grep -i 'access-control'
# → Must include Allow-Origin, Allow-Methods, Allow-Headers, Expose-Headers.

# 2. Health check
curl -s "$SRV/api/health" | jq '.status, .keys.deepgram, .keys.anthropic, .keys.xai'
# → "healthy" | "degraded", booleans present.

# 3. Missing-key error shape
curl -s -X POST "$SRV/api/transcribe" \
  -H 'Content-Type: application/json' \
  -d '{"url":"x","mode":"browser"}' \
  | jq .
# If the server env has no keys and no headers are set:
# → 400 { "error": "Missing required API keys. ..." }

# 4. SSE stream opens and emits `started`
curl -sN -X POST "$SRV/api/transcribe" \
  -H 'Content-Type: application/json' \
  -H 'X-Deepgram-Key: <key>' \
  -H 'X-Anthropic-Key: <key>' \
  -H 'X-XAI-Key: <key>' \
  -d '{"url":"https://youtube.com/watch?v=xxx","mode":"browser"}' \
  | head -n 4
# → event: status
# → data: {"status":"started","sessionId":"..."}

# 5. X-Session-Id header is present and exposed
curl -sI -X POST "$SRV/api/transcribe" \
  -H 'Content-Type: application/json' \
  -H 'X-Deepgram-Key: <key>' \
  -H 'X-Anthropic-Key: <key>' \
  -H 'X-XAI-Key: <key>' \
  -d '{"url":"x","mode":"browser"}' \
  | grep -iE 'x-session-id|access-control-expose'
# → Both headers present.

# 6. Unknown session returns 404
curl -s -X PATCH "$SRV/api/transcribe" \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"does-not-exist","action":"force_fire"}' \
  | jq .
# → { "error": "Session not found" }

# 7. Deprecated pause/resume is a no-op, not an error
curl -s -X PATCH "$SRV/api/transcribe" \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<real-session-id>","action":"pause"}' \
  | jq .
# → { "ok": true, "deprecated": "silence is auto-detected" }

# 8. End-to-end — point the real extension at your server.
# Load the extension (extension/ folder) unpacked in Chrome, change the
# Backend server field to your URL, open any YouTube video, click Start
# Listening. Transcript should appear within ~5 s. Persona reactions should
# start within ~15 s of audible speech.
```

If 1–7 pass and 8 produces reactions, your backend is compatible. Ship it.

---

## Things that WILL break the extension

A short list of mistakes that look fine but silently break compatibility.
If you're instructing an AI to build this, feed this list into its rules:

- Returning the full accumulated persona text on every chunk instead of just
  the delta — the UI will render duplicated, exponentially-growing output.
- Sending `persona_done` without first sending any `persona` events — the UI
  renders an empty bubble. On "pass" either send `{text: "-"}` once then
  `persona_done`, or send a single `persona` with a pass marker and
  `persona_done`.
- Using a different sample rate or bit depth — Deepgram will accept the WS
  but transcripts will be garbage.
- Stripping CORS headers from non-OPTIONS responses — preflight passes,
  real requests fail.
- Forgetting `X-Session-Id` or not listing it in `Access-Control-Expose-Headers`
  — the extension can't read the session ID off the response.
- Blocking on the Brave Search call — when Brave 429s, a blocking
  implementation stalls the whole cascade for 30 s. Always fire-and-forget
  with a 3 s timeout.
- Swallowing Deepgram errors silently — if transcription dies, emit an SSE
  `error` event so the UI can show the red banner.
- Persisting audio. Transcribe and discard. Logging a transcript is fine
  for debugging, persisting raw audio is not.
- Using stale persona IDs. The four IDs are `producer`, `troll`, `soundfx`,
  `joker`. Anything else is dropped by the side-panel router.

---

## License & attribution

The reference backend is MIT-licensed. Your compatible backend can be under
any license you want; you are not required to open-source it. If you do, a
link back to [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery)
is appreciated but not required.
