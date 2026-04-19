<!--
Thanks for shipping something. Keep this crisp — reviewers read fast.
-->

## What

One sentence on what this PR does. Paste a screenshot or a 10-second clip if UI changed.

## Why

Why now? Link the issue, the release plan, or the conversation that prompted this.

Closes #

## How

The non-obvious choices, the trade-offs, the things a reviewer would otherwise have to re-derive. "Why did you pick X over Y" belongs here, not in a comment thread two weeks from now.

## Testing

- [ ] `npm run check` passes locally
- [ ] Loaded the unpacked extension and verified the affected flow
- [ ] If persona / director changed: added or updated a director fixture (`scripts/test-director.ts`)
- [ ] If backend wire-spec changed: updated `docs/BUILD-YOUR-OWN-BACKEND.md` + version-bumped the wire protocol
- [ ] If manifest changed: justified every new permission in the PR description

## Risk / blast radius

Pick one: 🟢 trivial · 🟡 localized · 🔴 multi-system. Note any deployment ordering (server first? client first? feature flag?).

## Screenshots / trace (if UI or director)

<!-- before / after, or a trace panel snapshot -->
