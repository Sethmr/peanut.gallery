# Peanut Gallery — Terms of Service

> **⚠ DRAFT — not legal advice.** This document is a starting draft for Seth to review with counsel before relying on it. It's calibrated for a small, free, open-source consumer browser extension. It is NOT a template to copy into any other product without a lawyer's sign-off. Treat every claim and carve-out as revisable.

**Last updated:** 2026-06-03 (draft)
**Effective:** _not yet effective_
**Contact:** `<TBD — a support email Seth owns>`

---

## 1. What Peanut Gallery is

Peanut Gallery is a free Chrome extension (and the backend that supports it) that listens to audio in your current browser tab and overlays live reactions from four AI personas. It's maintained by Seth Rininger ("**we**", "**us**") as an open-source project at [github.com/Sethmr/peanut.gallery](https://github.com/Sethmr/peanut.gallery).

There are two ways to use it:

- **Demo** — a free, one-time 15-minute trial on our shared API keys.
- **My keys (BYOK)** — you provide your own provider API keys (Deepgram, Anthropic, xAI, etc.); we charge you nothing and never store them.

Peanut Gallery is **free**. There is no paid tier, no subscription, and no payment processing. You can also self-host the open-source backend entirely on your own keys. These Terms ("**Terms**") cover all of the above. If you disagree with anything here, don't use the product.

## 2. Accounts and identity

We deliberately do **not** run an account system. The privacy posture is "keys in your browser, not our database."

- **Demo mode** assigns a random "install ID" to your extension on first run, stored only in your browser. We don't know who you are.
- **My keys mode** sends your API keys per request; we never store them.

We don't collect your name, email, or a login. There is nothing to sign up for.

## 3. The free trial (Demo mode)

New installations get 15 minutes of hosted transcription + persona reactions on our shared API keys, **one time, lifetime per install**. After that, provide your own API keys (or self-host) to keep using hosted features. Clearing your browser data resets the install ID — we treat that as expected and don't try to prevent it.

## 4. What Peanut Gallery is not

- **Not legal, medical, or financial advice.** The personas are entertainment. Their "fact-checks" are real-time search snippets + model output — treat them like a smart friend riffing alongside you, not a verified source.
- **Not a recording tool.** The extension streams tab audio to the backend for live transcription and discards it. We don't save audio files, nor let you.
- **Not an account-backed product.** There's no account page and no stored profile.
- **Not ad-supported, ever.** No ads in the app, on the site, or anywhere. If that ever changed, it would require a new version of these Terms.

## 5. Your responsibilities

- Use the product for lawful purposes. Don't aim the personas at content that is itself illegal (e.g. circumventing a platform's rights management, surveilling someone's private broadcasts).
- Respect the content you're listening to. The reactions are for you; if you re-share them, attribute where warranted.
- Don't abuse the shared demo keys. Resetting your install ID to retry the trial is fine (we designed for it); scripted enumeration to mint infinite trials is not.

## 6. Our responsibilities

- We try to keep the hosted backend running. We don't promise 100% uptime; there is no SLA.
- We honor the posture in our [Privacy Policy](PRIVACY-POLICY.md). Material changes are published at an updated "Last updated" date.
- We don't sell, lease, or share your data with third parties. See the Privacy Policy.

## 7. Intellectual property, parody & no affiliation

- **An unofficial fan project.** Peanut Gallery is an independent, open-source project created as **parody, homage, and commentary** on talk- and podcast-style formats — including shows such as *This Week in Startups* and the *Howard Stern Show*. It is **not** affiliated with, endorsed by, sponsored by, or licensed from those shows, their hosts, guests, networks, or producers. Where real names, shows, or marks appear on our website or in our marketing, they are used **nominatively** — to identify the works that inspired the project and as parody/commentary — and remain the property of their respective owners.
- **The AI personas are generic archetypes.** The personas shipped in the product (a fact-checker, a host, a sound-effects sideman, a comedy writer, and the like) are written as **generic archetypes**. They are designed **not** to impersonate, speak as, or reproduce the words of any specific real person, and the product does **not** ship verbatim transcripts or other substantial copyrighted material from any show. If you ask a persona whether it is a specific real person, it will tell you it is an AI parody.
- **Code & prompts:** Peanut Gallery's source code and persona system prompts are original work of the project, licensed under [MIT](../../LICENSE). You can read, fork, and run them yourself.
- **Your reactions:** The text the personas produce in your session is yours to use; normal fair-use rules apply to anything it quotes. We claim no ownership of the output.

## 8. Third-party services

Peanut Gallery depends on external APIs; their outages are our outages:

- **Deepgram** (transcription)
- **Anthropic** (Claude Haiku for the Director + personas)
- **xAI** (Grok for the troll + sound-FX slots, and optional Live Search for fact-checks)
- **Railway** (backend hosting — subject to change if we move infra)

We don't negotiate these providers' terms on your behalf; when a provider changes its rules, our usage is subject to those changes. There is **no payment processor** — Peanut Gallery does not charge you.

## 9. Changes to these Terms

We can update these Terms. Changes are effective on publication at the updated "Last updated" date. If we ever introduce a material new data flow (for example, a paid tier — not currently offered), we'll describe it here before it takes effect.

## 10. Liability

Peanut Gallery is provided "as is." To the extent permitted by law, we disclaim all warranties and limit our aggregate liability to USD $0 — the product is free.

## 11. Governing law and disputes

**<TBD — Seth's jurisdiction.>** Seth picks the governing law + dispute-resolution venue with counsel.

## 12. Contact

Questions, security reports, or "I found a bug in the Terms" notes: `<TBD — support email>`. Security reports: also see [`SECURITY.md`](../../.github/SECURITY.md).

---

*End of draft. See the pairing [Privacy Policy](PRIVACY-POLICY.md) for data-handling specifics.*
