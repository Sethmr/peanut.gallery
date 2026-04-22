# `scripts/` — Dev + test + release scripts

Parent: [`../INDEX.md`](../INDEX.md).

## Test harnesses (wired into `npm run check` gate)

| File | Run via | Purpose |
|---|---|---|
| [`test-director.ts`](test-director.ts) | `npm run test:director` (optionally `-- --pack <id>`) | 26 fixtures × 50 runs each. Distribution + structural assertions on the Director. Gated by husky pre-commit. Must stay green. Fixture dir: [`fixtures/director/`](fixtures/director/). |
| [`test-director-llm-v2.ts`](test-director-llm-v2.ts) | `npm run test:director-v2` | 15 unit assertions on v3 router helpers — `applyStickyPenalty`, `computeUnstableTailLen`, SILENT handling. |
| [`test-semantic-cache.ts`](test-semantic-cache.ts) | `npm run test:semantic-cache` | 18 assertions on the embedding-cosine primitives (edge cases, symmetry, zero-vector handling). |
| [`test-claim-detector.ts`](test-claim-detector.ts) | `npm run test:claim-detector` | 62 assertions (post-#120 hardening). Spoken-number normalization, structured attribution, funding-round patterns, compound-claim bonus, strict-vs-loose mode parity. |
| [`test-highlight-picker.ts`](test-highlight-picker.ts) | `npm run test:highlight-picker` | 30 assertions on SET-24 smart highlight picker — pin-wins, upvote shortlist, rule-based fallback, LLM fallback. |
| [`test-subscription-store.ts`](test-subscription-store.ts) | `npm run test:subscription-store` | 252 assertions (SET-25). Key generator + checksum tamper detection, `MemorySubscriptionStore` + `SqliteSubscriptionStore` parity, Phase-1 env-whitelist back-compat. |
| [`test-stripe-webhook.ts`](test-stripe-webhook.ts) | `npm run test:stripe-webhook` | 21 assertions (SET-26). Signature verification happy path + every rejection reason (MISSING_SECRET, MISSING_HEADER, MALFORMED_HEADER, TIMESTAMP_SKEW, NO_SIGNATURE_MATCH) + custom tolerance + multi-`v1` key rotation. |

## Dev-only harnesses (not in CI)

| File | Run via | Purpose |
|---|---|---|
| [`test-personas.ts`](test-personas.ts) | `npx tsx scripts/test-personas.ts` | Dev-only smoke test for `PersonaEngine`. Requires env keys (Deepgram + Anthropic + xAI). Not in CI. |
| [`test-transcription.ts`](test-transcription.ts) | `npx tsx scripts/test-transcription.ts` | Standalone Deepgram WebSocket smoke. Useful when debugging silent transcriber failures. |
| [`analyze-director-v3-canary.ts`](analyze-director-v3-canary.ts) | `npm run analyze:director-v3` | Post-canary telemetry analysis: rule-vs-LLM agreement, SILENT-pick frequency, per-shadow-provider latency. Run against `logs/pipeline-debug.jsonl` after the v3 canary flips have accumulated ≥48h of traffic. |

## Release + ops

| File | Run via | Purpose |
|---|---|---|
| [`pack-extension.sh`](pack-extension.sh) | `bash scripts/pack-extension.sh` | Zips `extension/` into `releases/peanut-gallery-v<manifest.version>.zip`. CWS upload artifact. **Sandbox workaround:** in the Cowork sandbox, `rm -f` on the existing zip sometimes returns EPERM; workaround is to zip into `/tmp` first, then `cp` over. |
| [`subscription-issue.ts`](subscription-issue.ts) | `npm run subscription:issue -- --email alice@example.com` | Admin CLI for hand-issuing Plus license keys. Writes to the SQLite store, prints the key. `--dry-run` exercises the generator without touching the store. Used pre-Stripe + for ops follow-up when webhook email delivery fails. |

## Daemon (Linear → Claude kickoff pipeline)

| File | Purpose |
|---|---|
| [`linear-daemon.ts`](linear-daemon.ts) | macOS launchd agent. Polls Linear every 30s for `ai@manugames.com`-assigned Todo tickets + GitHub `@claude` comments on open `claude/*` PRs. Spawns `claude -p ...` in `.claude/worktrees/claude-<slug>/`. |
| [`install-linear-daemon.sh`](install-linear-daemon.sh) | One-shot installer: writes `~/.config/peanut-gallery/daemon.env` (mode 600), installs the `.plist` under `~/Library/LaunchAgents/`, `launchctl load`. |
| [`uninstall-linear-daemon.sh`](uninstall-linear-daemon.sh) | Companion. Leaves the env file unless `--purge`. |

## Historical

| File | Purpose |
|---|---|
| [`file-v1.1-issues.sh`](file-v1.1-issues.sh) | Historical — files `docs/DEBUGGING.md` ISSUE-00X entries interactively. Mostly unused now. |
| [`file-community-issues.sh`](file-community-issues.sh) | Historical — bulk-files stock "good first issue" templates on a fresh repo. Ran once at community-bootstrap time. |

## Fixture directory

[`fixtures/director/`](fixtures/director/) — JSON fixtures for the director harness. Each has `pack` (howard|twist), `transcript`, `personaState`, plus expected-distribution assertions. **26 fixtures** as of 2026-04-22 (one added in #120 for the producer-claim-density boost). See the fixture headers for the schema.

## Adding a new fixture

1. Copy an existing fixture with similar intent.
2. Set `pack` to the target pack id.
3. Fill in `transcript` + `personaState` for the scenario.
4. Set `expected` distributions (min/max ratios per persona across 50 runs).
5. Run `npm run test:director -- --pack <your-pack>` and tune until stable.
