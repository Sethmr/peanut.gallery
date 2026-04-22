import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Peanut Gallery handles your audio, API keys, transcript, and subscription data. Audio streamed and discarded, keys never written to disk, minimal subscription state, no ads, no data sale, no third-party analytics in the extension.",
  alternates: { canonical: "https://peanutgallery.live/privacy" },
};

const lastUpdated = "April 21, 2026";
const publishedTerms = "https://www.peanutgallery.live/terms/";

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://peanutgallery.live",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Privacy Policy",
      item: "https://peanutgallery.live/privacy",
    },
  ],
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg-primary text-[#e5e5e5]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[#3b82f6] hover:underline">
          &larr; Back to peanutgallery.live
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#a0a0a0] mb-10">
          Last updated: {lastUpdated} &middot; Draft pending legal review
        </p>

        <div className="mt-2 mb-8 p-4 border border-[#3b82f6]/40 rounded bg-[#3b82f6]/5 text-sm leading-relaxed">
          <strong className="text-white">United States only.</strong> Peanut
          Gallery Plus and the Demo allowance on our hosted keys are offered
          only to users in the United States. The Extension is globally
          available under MIT; if you&rsquo;re outside the U.S., please use
          My-Keys Mode or self-host &mdash; see the{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/SELF-HOST-FOR-INTERNATIONAL-USERS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            fork-and-self-host guide
          </a>
          .
        </div>

        <section className="space-y-4 leading-relaxed">
          <p>
            Peanut Gallery is a Chrome extension, a hosted backend at{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              api.peanutgallery.live
            </code>
            , a marketing site at{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              www.peanutgallery.live
            </code>
            , and an optional $8/month subscription called Peanut Gallery Plus.
            This policy describes what data the Service handles, what we store,
            and for how long. It reads alongside our{" "}
            <a
              href={publishedTerms}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Terms of Service
            </a>
            .
          </p>
        </section>

        <h2 className="text-xl font-semibold mt-10 mb-3">Short answer</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Your audio is streamed through a transcription provider and
            discarded. We never write an audio file.
          </li>
          <li>
            Your live transcript exists in backend memory during your session
            and is not persisted. Snippets you{" "}
            <em>actively</em> upvote, downvote, pin, or quote-card are logged
            to improve the personas &mdash; see the Feedback section below.
          </li>
          <li>
            If you use your own API keys (&ldquo;My-Keys Mode&rdquo;), they
            travel as per-request headers and are never written to our disk.
          </li>
          <li>
            No advertising, no data sale, no third-party analytics in the
            Extension. The marketing website uses Google Analytics for
            aggregate page-view counts &mdash; disclosed below.
          </li>
          <li>
            The only data we store long-term about a paying user is: email,
            license key, Stripe subscription ID, and a weekly usage counter
            measured in milliseconds.
          </li>
          <li>
            Recording-consent laws are your responsibility. The Extension can
            be pointed at any browser tab you grant it. Many U.S. states and
            most of Europe require all-party consent to record private
            conversations.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          The three operating modes
        </h2>
        <p className="leading-relaxed mb-3">
          Before the details below, it helps to know which mode you&rsquo;re
          in. You pick at runtime in the Extension&rsquo;s Backend &amp; keys
          drawer:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            <strong>Demo Mode</strong> &mdash; 15 minutes of free transcription
            on our API keys, one-time per install. Gated by a per-installation
            UUID (<code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">installId</code>)
            generated locally.
          </li>
          <li>
            <strong>My-Keys Mode</strong> (BYOK) &mdash; you supply your own
            API keys. We forward them per-request to the providers and never
            store them server-side.
          </li>
          <li>
            <strong>Peanut Gallery Plus</strong> &mdash; $8/month subscription,
            16 hours a week on our keys. Requires an email (for license-key
            delivery) and produces a license key of the form{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              pg-xxxx-xxxx-xxxx
            </code>
            .
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What the Extension keeps on your device
        </h2>
        <p className="leading-relaxed mb-3">
          The Extension writes to{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            chrome.storage.local
          </code>
          , which Chrome persists on your disk. Nothing there leaves your
          browser unless you trigger it:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Your chosen backend URL, your pasted API keys (if any), your
            persona pack, theme, response-rate dial, sensitivity level, and
            per-persona mute list.
          </li>
          <li>
            Your per-install UUID (<code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">installId</code>)
            &mdash; used to meter the Demo trial.
          </li>
          <li>
            Your Plus license key and backend-mode preferences, if you
            subscribed.
          </li>
          <li>
            Up to 50 prior sessions&rsquo; metadata, sampled transcript tails
            (capped at 4,000 characters per session), and the persona reactions
            for each &mdash; groundwork for the v2.0 &ldquo;Past
            sessions&rdquo; feature. LRU-evicted at 50.
          </li>
          <li>
            Per-session upvotes / downvotes / pinned entry, plus UI state
            (tutorial seen, debug panel open).
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What the backend receives and keeps
        </h2>
        <p className="leading-relaxed mb-3">
          The hosted backend at{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            api.peanutgallery.live
          </code>{" "}
          is a stateless API behind a session ID. When you stream a session it
          handles:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            <strong>Audio</strong> &mdash; received as PCM, forwarded to the
            transcription provider, discarded. Nothing written to disk.
          </li>
          <li>
            <strong>Live transcript</strong> &mdash; held in memory during the
            session, routed to the Director and personas, discarded on session
            end.
          </li>
          <li>
            <strong>Your API keys (My-Keys Mode)</strong> &mdash; forwarded
            per-request to the providers, redacted from every log line, never
            persisted.
          </li>
          <li>
            <strong>Your install ID (Demo Mode)</strong> &mdash; kept in
            memory to meter the 15-minute trial. Resets when the backend
            process redeploys in the current phase; moves to database in a
            future phase.
          </li>
          <li>
            <strong>Your email, license key, and Stripe subscription ID
            (Plus Mode only)</strong> &mdash; persisted so we can validate your
            key, recover it if you lose it, and manage billing. Retained for
            the life of your subscription plus 12 months, then deleted.
          </li>
          <li>
            <strong>Your weekly usage counter (Plus Mode only)</strong> &mdash;
            milliseconds of hosted transcription per rolling 7-day window.
            Retained for 30 days for cap enforcement.
          </li>
          <li>
            <strong>Operational logs</strong> &mdash; request IDs, session IDs,
            persona IDs, response times, error events. 30-day retention.
            Redacted of keys; never include complete transcripts or audio.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Feedback on persona reactions
        </h2>
        <p className="leading-relaxed mb-3">
          When you click the menu on a persona reaction and choose upvote,
          downvote, pin, or quote-card, we log that action to{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            /api/feedback
          </code>
          . Each log entry contains the action, the persona, the pack, the
          reaction text, the transcript tail (~500 characters) that informed
          the reaction, your install ID, and a timestamp. We retain these for
          90 days.
        </p>
        <p className="leading-relaxed mb-3">
          We use them to improve the personas&rsquo; prompts, the
          Director&rsquo;s routing, and the session-recall highlight picker.
          Feedback is keyed to the pseudonymous install ID only &mdash; we
          don&rsquo;t tie votes to your email or license key.
        </p>
        <p className="leading-relaxed mb-3">
          <strong>Opting out:</strong> today, either self-host the backend
          with{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            DISABLE_FEEDBACK_LOGGING=true
          </code>{" "}
          or don&rsquo;t interact with the feed menu. A user-facing opt-out
          toggle in the Extension is on the roadmap and should ship before the
          first public paid launch.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Third-party providers
        </h2>
        <p className="leading-relaxed mb-3">
          When the Service calls a third party on your behalf, that
          provider&rsquo;s terms and privacy practices apply. Current
          subprocessors:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            <a
              href="https://deepgram.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Deepgram
            </a>{" "}
            &mdash; speech-to-text streaming.
          </li>
          <li>
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Anthropic (Claude)
            </a>{" "}
            &mdash; Producer and Joker persona inference.
          </li>
          <li>
            <a
              href="https://x.ai/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              xAI (Grok)
            </a>{" "}
            &mdash; Troll and Sound FX persona inference, optional live search.
          </li>
          <li>
            <a
              href="https://brave.com/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Brave Search
            </a>{" "}
            &mdash; fact-check search queries.
          </li>
          <li>
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Stripe
            </a>{" "}
            &mdash; payment processing (Plus only). Stripe collects card
            details directly; we never see them.
          </li>
          <li>
            <a
              href="https://railway.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Railway
            </a>{" "}
            &mdash; backend hosting.
          </li>
          <li>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Vercel
            </a>{" "}
            &mdash; Next.js application hosting where used.
          </li>
          <li>
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              GitHub Pages
            </a>{" "}
            &mdash; marketing-site hosting.
          </li>
          <li>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Google Analytics
            </a>{" "}
            &mdash; aggregate page-view metrics on the marketing site only
            (not in the Extension).
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Marketing-site analytics
        </h2>
        <p className="leading-relaxed">
          The marketing site at{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            www.peanutgallery.live
          </code>{" "}
          loads Google Analytics (property{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            G-3R9CK4LRGF
          </code>
          ) to measure aggregate page views. GA receives your IP address, user
          agent, referring URL, and page-view events, and sets cookies or
          equivalent local-storage identifiers. We use the data only in
          aggregate. We do not enable Google Signals, remarketing, or any
          advertising features. The Extension itself does not load any
          analytics library.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Retention summary</h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4">Data</th>
                <th className="text-left py-2 pr-4">Retention</th>
              </tr>
            </thead>
            <tbody className="leading-relaxed">
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Audio bytes</td>
                <td className="py-2">In-memory, during session only</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Live transcript</td>
                <td className="py-2">In-memory, during session only</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Voted / pinned / quote-carded snippets</td>
                <td className="py-2">90 days</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">API keys (BYOK)</td>
                <td className="py-2">Never stored</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Install ID</td>
                <td className="py-2">Backend process lifetime (Phase 1)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Email + license key (Plus)</td>
                <td className="py-2">Subscription + 12 months</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Weekly usage counter (Plus)</td>
                <td className="py-2">30 days</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Operational logs</td>
                <td className="py-2">30 days</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4">Payment records</td>
                <td className="py-2">Per Stripe&rsquo;s policy</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Marketing-site analytics</td>
                <td className="py-2">Per Google Analytics retention</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold mt-10 mb-3">Your rights</h2>
        <p className="leading-relaxed mb-3">
          Wherever you live, you have the right to know what we hold, correct
          it, delete it, port it, object to certain processing, and complain
          to a data-protection authority. Under U.S. state privacy laws
          (CCPA/CPRA, Virginia, Colorado, Connecticut, and equivalents) you
          also have the right to opt out of &ldquo;sale&rdquo; and
          &ldquo;sharing&rdquo; of personal information. We do not sell or
          share personal information in the senses those laws define.
        </p>
        <p className="leading-relaxed">
          To exercise any of these rights, email{" "}
          <a
            href="mailto:privacy@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            privacy@peanutgallery.live
          </a>
          . We may ask you to verify your identity before we act (for example,
          by confirming the email tied to your Stripe subscription). We
          respond within the timeframes required by law &mdash; typically 45
          days under U.S. state privacy laws and one month under GDPR.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          International data transfers
        </h2>
        <p className="leading-relaxed">
          The hosted backend is in the United States. If you use the Service
          from outside the U.S., your audio, transcript, and (for Plus) email
          and license key pass through U.S.-based infrastructure. Where
          applicable, we rely on the European Commission&rsquo;s Standard
          Contractual Clauses, the U.K. International Data Transfer Addendum,
          and (where participating) the EU&ndash;U.S. Data Privacy Framework.
          If that&rsquo;s not acceptable for your situation, use My-Keys Mode
          or self-host the backend in a region of your choice.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Children</h2>
        <p className="leading-relaxed">
          Peanut Gallery is not directed at children under 13 (16 in some EU
          member states). We do not knowingly collect personal information
          from children under those ages. If you&rsquo;re a parent and believe
          a child under the relevant age has subscribed or otherwise given us
          data, email{" "}
          <a
            href="mailto:privacy@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            privacy@peanutgallery.live
          </a>{" "}
          and we&rsquo;ll refund, delete, and revoke.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Security</h2>
        <p className="leading-relaxed">
          HTTPS for all backend traffic, keys redacted from logs, Stripe
          handles all payment data, structured per-request timeouts on every
          upstream call, narrow content-script scope (
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            peanutgallery.live
          </code>{" "}
          subdomains only). Responsible disclosure at{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/.github/SECURITY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            SECURITY.md
          </a>{" "}
          or{" "}
          <a
            href="mailto:security@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            security@peanutgallery.live
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Recording consent</h2>
        <p className="leading-relaxed">
          The Extension can be pointed at any browser tab you grant access to.
          Recording-consent laws are jurisdiction-specific. U.S. states
          including California, Florida, Illinois, Maryland, Massachusetts,
          Montana, New Hampshire, Nevada, Pennsylvania, and Washington require
          all-party consent for private conversations. The EU, UK, and many
          other jurisdictions impose equivalent or stricter rules. You are
          solely responsible for obtaining any consent required before
          directing the Extension at audio &mdash; this applies to live calls,
          conferences, voicemail, ambient room audio, and private streams.
          See{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/legal/TERMS-OF-SERVICE.md#51-audio-capture-and-recording-consent-laws"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            Terms of Service &sect; 5.1
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Changes to this policy
        </h2>
        <p className="leading-relaxed">
          Material changes affecting Plus subscribers get at least 30
          days&rsquo; email notice and a pro-rata refund window. Non-material
          changes (clarifications, typos, provider substitutions that
          don&rsquo;t alter data handling) are effective on the updated
          &ldquo;Last updated&rdquo; date.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Contact</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Privacy questions and data-subject requests:{" "}
            <a
              href="mailto:privacy@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              privacy@peanutgallery.live
            </a>
          </li>
          <li>
            Legal, billing, DMCA:{" "}
            <a
              href="mailto:legal@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              legal@peanutgallery.live
            </a>
          </li>
          <li>
            Security reports:{" "}
            <a
              href="mailto:security@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              security@peanutgallery.live
            </a>
          </li>
        </ul>

        <div className="mt-14 pt-8 border-t border-white/10 text-sm text-[#808080]">
          Peanut Gallery is MIT-licensed open-source software. Every line of
          how it handles your data is auditable at{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            github.com/Sethmr/peanut.gallery
          </a>
          . The full-length, counsel-review draft lives at{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/legal/PRIVACY-POLICY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            docs/legal/PRIVACY-POLICY.md
          </a>
          .
        </div>
      </div>
    </main>
  );
}
