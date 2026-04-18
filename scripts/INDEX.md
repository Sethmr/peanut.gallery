# `scripts/` — Dev + test + release scripts

Parent: [`../INDEX.md`](../INDEX.md).

## Test harnesses

| File | Run via | Purpose |
|---|---|---|
| [`test-director.ts`](test-director.ts) | `npm run test:director` (optionally `-- --pack <id>`) | 14 fixtures × 50 runs each. Distribution + structural assertions on the Director. Gated by husky pre-commit. Must stay green. Fixture dir: [`fixtures/director/`](fixtures/director/). |
| [`test-personas.ts`](test-personas.ts) | `npx tsx scripts/test-personas.ts` | Dev-only smoke test for `PersonaEngine`. Requires env keys (Deepgram + Anthropic + xAI). Not in CI. |
| [`test-transcription.ts`](test-transcription.ts) | `npx tsx scripts/test-transcription.ts` | Standalone Deepgram WebSocket smoke. Useful when debugging silent transcriber failures. |
| [`file-v1.1-issues.sh`](file-v1.1-issues.sh) | `bash scripts/file-v1.1-issues.sh` | Historical — files `docs/DEBUGGING.md` ISSUE-00X entries interactively. Mostly unused now. |

## Release script

| File | Run via | Purpose |
|---|---|---|
| [`pack-extension.sh`](pack-extension.sh) | `bash scripts/pack-extension.sh` | Zips `extension/` into `releases/peanut-gallery-v<manifest.version>.zip`. CWS upload artifact. **Sandbox workaround:** in the Cowork sandbox, `rm -f` on the existing zip sometimes returns EPERM; workaround is to zip into `/tmp` first, then `cp` over. |

## Fixture directory

[`fixtures/director/`](fixtures/director/) — JSON fixtures for the director harness. Each has `pack` (howard|twist), `transcript`, `personaState`, plus expected-distribution assertions. 10 Howard + 4 TWiST = 14 total. See the fixture headers for the schema.

## Adding a new fixture

1. Copy an existing fixture with similar intent.
2. Set `pack` to the target pack id.
3. Fill in `transcript` + `personaState` for the scenario.
4. Set `expected` distributions (min/max ratios per persona across 50 runs).
5. Run `npm run test:director -- --pack <your-pack>` and tune until stable.
