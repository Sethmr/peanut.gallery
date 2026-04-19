# Security Policy

## Supported versions

The latest minor version on the Chrome Web Store is the supported line. Older builds are not patched — auto-update handles the majority of installs within ~2 weeks of a release.

| Version | Status |
|---------|--------|
| 1.5.x   | ✅ supported (current) |
| 1.4.x   | 🟡 bug-fix only until 1.5 hits 95% rollout |
| < 1.4   | ❌ unsupported |

## Reporting a vulnerability

If you think you've found something security-sensitive, **please do not open a public issue**.

Email: `security@peanutgallery.live`
Alternate: DM [@sethrininger](https://x.com/sethrininger) on X with a short "please email me about a security issue" and we'll take it private.

What to include:

- A focused description of the issue and the affected surface (extension, hosted backend at `api.peanutgallery.live`, or the wire protocol).
- Clear reproduction steps. A non-working repro is still useful — say so.
- Your assessment of impact (data exposure, account takeover, supply-chain risk, etc.).
- Whether you want public credit when the fix ships (happy to, on request).

We'll acknowledge within 48 hours, aim for a first fix or mitigation inside 7 days for high-severity, and coordinate disclosure with you.

## Scope

In scope:

- The Chrome extension (`extension/` in this repo).
- The reference Next.js backend (`app/api/*`) — whether you're running the hosted instance at `api.peanutgallery.live` or self-hosting.
- The build + release pipeline in this repo.

Out of scope:

- Vulnerabilities in upstream providers (Anthropic, xAI, Deepgram, Brave) — please report those to the upstream vendor. We'll plumb mitigations once they've acknowledged.
- Third-party persona packs distributed outside this repo.
- Social-engineering attempts, physical attacks, or anything that requires compromising a user's machine first.

## What we do well, by design

- Your API keys live in `chrome.storage.local` on your machine. The extension never logs them to the server and the hosted backend never persists them beyond the request that needs them.
- Audio is streamed, transcribed, and discarded. No audio, transcript, or persona output is written to server-side storage on the hosted backend.
- No user accounts. No session cookies. Nothing to exfiltrate cross-site.

If you find a gap between these claims and the code, that's exactly the kind of report we want.
