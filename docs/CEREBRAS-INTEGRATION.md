# Cerebras shadow integration — step-by-step

One-time setup to enable the Cerebras Llama 3.1 8B shadow router for the Smart Director v3 canary. Reads with `director_v3_shadow_compare` telemetry after real traffic; kill switch is one env-var flip.

All code is already wired. This doc is the *operational* setup.

---

## Prereqs
- The canary is only useful alongside `ENABLE_SMART_DIRECTOR_V2=true` on the hosted backend. If you're still on rule-based Director, skip Cerebras — nothing to shadow against.
- Railway CLI installed locally (or use the web dashboard), OR shell access to whatever host runs `/api/transcribe`.

---

## Step 1 — Sign up + generate a key

1. Go to **[cloud.cerebras.ai](https://cloud.cerebras.ai)**.
2. Sign up with a GitHub / Google / email account. No waitlist.
3. Dashboard → **API Keys** → **Create New Key**.
4. Name it `peanut-gallery-shadow`. Copy the key (starts with `csk-`). You'll only see it once.

The free tier is rate-limited (~30 RPM / 6k TPM). That's plenty for a shadow run: the Director fires once every ~15–22 s, so ~4 requests/minute per session. If you hit 429s, upgrade to the paid self-serve tier (pay-as-you-go, ~$0.10/M blended — see pricing discussion in chat).

---

## Step 2 — Local dev (optional, for testing before hosted)

Add to `.env.local` in the chrome-extension directory:

```bash
CEREBRAS_API_KEY=csk-your-key-here
ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true
ENABLE_SMART_DIRECTOR_V2=true            # needed so there's something to shadow against
ANTHROPIC_API_KEY=sk-ant-...             # needed for the v3 Haiku primary path
```

Then `npm run dev` and open a session. The first tick should log `llm_director_v3_pick` with `provider: "cerebras"` in `logs/pipeline-debug.jsonl`.

Sanity check without starting a session:

```bash
curl -sS https://api.cerebras.ai/v1/chat/completions \
  -H "Authorization: Bearer $CEREBRAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8b","max_tokens":20,"messages":[{"role":"user","content":"say ok"}]}' \
  | python3 -m json.tool
```

Expect a JSON response with `choices[0].message.content`. If you get 401, the key is wrong. If you get 404 on the model, their slug changed — tell me and I'll bump `lib/director-llm-v3-cerebras.ts`'s `CEREBRAS_MODEL` constant.

---

## Step 3 — Hosted (Railway)

Via Railway CLI:

```bash
railway variables set CEREBRAS_API_KEY=csk-your-key-here
railway variables set ENABLE_SMART_DIRECTOR_V3_CEREBRAS=true
railway variables set ENABLE_SMART_DIRECTOR_V2=true       # if not already on
railway up                                                 # redeploy
```

Or via the Railway web dashboard: project → **Variables** → **New Variable** × 3.

Self-hosters: same vars on their own host. Or clients can pass `X-Cerebras-Key` header per-request (the code handles both).

---

## Step 4 — Verify it's firing

After any session has run even 30 seconds:

```bash
# on the host running Peanut Gallery
grep -c '"event":"llm_director_v3_pick"' logs/pipeline-debug.jsonl
grep -c '"event":"director_v3_shadow_compare"' logs/pipeline-debug.jsonl
```

Both should be > 0. If `llm_director_v3_pick` is zero, Cerebras isn't being called — check the env vars are actually set in the running process (`railway variables`).

---

## Step 5 — Read the data after a real canary window

After ~48 h of hosted sessions:

```bash
npm run analyze:director-v3
```

Look at the **Fast-provider shadow** section. You want:
- **Agreement rate** (Haiku pick vs Cerebras pick) — ≥ 85 % means they're interchangeable
- **p95 latency** — Cerebras should be 3–5× faster than Haiku
- **Timeout rate** — < 2 %

If agreement is high AND Cerebras is consistently faster, you have the data to justify a future swap. If agreement is low, read the disagreement rationales (the analyzer samples them) — the root cause is usually a prompt-calibration thing, not a model-capability thing.

---

## Step 6 — Rollback (zero-risk)

Kill the shadow any time:

```bash
railway variables delete ENABLE_SMART_DIRECTOR_V3_CEREBRAS
railway up
```

Cerebras stops getting called on the next tick. Haiku continues routing. No state to clean up — the shadow never touched user-facing traffic.

---

## Cost expectations

| Traffic | Cerebras cost | Notes |
|---|---|---|
| 48 h canary, 100 sessions | ~$2 | Decision-data run; this is what you pay once to learn if Cerebras is viable |
| 1k sessions/month shadow'd | ~$20/mo | If you keep the shadow on indefinitely for ongoing A/B |
| 10k sessions/month shadow'd | ~$200/mo | Scale point where you'd decide to either swap primary OR disable shadow |

These assume 400 ticks/session × 500 tokens/tick at Cerebras's blended rate. Shadow cost is in addition to Haiku — if you swap primary to Cerebras later, Haiku cost goes away.

---

## What to do if you decide Cerebras wins

Not this ticket. Open a follow-up ticket to make Cerebras the primary v3 router (retiring the Haiku call). The code shape is already there — `lib/director-llm-v3-cerebras.ts` currently returns a shadow-only pick; making it primary is a small route.ts change. Data-gated: don't do it until the canary telemetry says "Cerebras ≥ Haiku on agreement AND faster."

---

## Troubleshooting

**401 on curl sanity check** — Key is wrong / copied with whitespace / was revoked. Regenerate.

**429 rate-limited in production** — Either upgrade Cerebras tier, OR back off the shadow (it's optional, not load-bearing).

**`director_v3_shadow_compare` events never appear** — Check that `ENABLE_SMART_DIRECTOR_V2=true` is ALSO set. The shadow only fires when the main v3 Haiku path fires.

**Agreement rate dramatically low (< 60 %)** — Likely the v3 prompt isn't porting cleanly. File a ticket; we'd re-tune the shadow prompt or fall back to v2-prompt shadow (which is also still wired; `ENABLE_SMART_DIRECTOR_V3_CEREBRAS` vs `ENABLE_SMART_DIRECTOR_V3_CEREBRAS_V3PROMPT` control them independently).

**Cerebras deprecates `llama3.1-8b`** — Edit `CEREBRAS_MODEL` in `lib/director-llm-v3-cerebras.ts` + `lib/director-llm-v3-cerebras-v3prompt.ts` to the replacement slug. 2 lines.
