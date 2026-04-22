import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for the Peanut Gallery Chrome extension, hosted backend, marketing site, and Peanut Gallery Plus subscription. United States only.",
  alternates: { canonical: "https://peanutgallery.live/terms" },
};

const lastUpdated = "April 21, 2026";
const publishedPrivacy = "https://www.peanutgallery.live/privacy/";

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
      name: "Terms of Service",
      item: "https://peanutgallery.live/terms",
    },
  ],
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-[#a0a0a0] mb-10">
          Last updated: {lastUpdated} &middot; Draft pending legal review
        </p>

        <div className="mt-2 mb-8 p-4 border border-[#3b82f6]/40 rounded bg-[#3b82f6]/5 text-sm leading-relaxed">
          <strong className="text-white">United States only.</strong> Peanut
          Gallery Plus and the Demo allowance on our hosted keys are offered
          only to users in the United States. The Extension is globally
          available under the MIT license; users outside the U.S. should use
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
            These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) govern
            your use of the Peanut Gallery Chrome extension, the hosted
            backend at{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              api.peanutgallery.live
            </code>
            , the marketing site at{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              www.peanutgallery.live
            </code>
            , and the optional Peanut Gallery Plus subscription (together, the
            &ldquo;<strong>Service</strong>&rdquo;). They read alongside our{" "}
            <a
              href={publishedPrivacy}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              Privacy Policy
            </a>
            , which is incorporated by reference. The Service is provided by
            Seth Rininger, a sole proprietor in North Carolina, U.S.A.
            (&ldquo;<strong>we</strong>&rdquo;, &ldquo;<strong>us</strong>
            &rdquo;).
          </p>
          <p>
            If you only read three things, read the sections on Acceptable
            Use, the AI Output Disclaimer, and Limitation of Liability &mdash;
            those sections change what you can use the Service for and what
            you can recover from us if something goes wrong.
          </p>
        </section>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Three ways to use the Service
        </h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            <strong>Demo</strong> &mdash; free 15-minute one-off trial on our
            shared API keys. U.S. users only.
          </li>
          <li>
            <strong>My-Keys Mode</strong> (BYOK) &mdash; you provide your own
            API keys to the providers. No Peanut Gallery charges. Globally
            available.
          </li>
          <li>
            <strong>Peanut Gallery Plus</strong> &mdash; $8/month subscription
            through Stripe, 16 hours/week of hosted transcription. U.S.
            billing addresses only.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Acceptance and eligibility
        </h2>
        <p className="leading-relaxed">
          You accept these Terms by installing or running the Extension, by
          calling the hosted backend, or by creating a Plus subscription. You
          must be at least 13 years old to use the Extension and at least 18
          years old (or the age of majority in your jurisdiction) to subscribe
          to Plus. You must not be on any U.S., U.K., E.U., or U.N. sanctions
          list, and you must not use the Service in a sanctioned jurisdiction.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Acceptable use &mdash; recording-consent laws are your responsibility
        </h2>
        <p className="leading-relaxed mb-3">
          The Extension can capture audio from any browser tab you authorize.
          Several U.S. states &mdash; including{" "}
          <strong>
            California, Florida, Illinois, Maryland, Massachusetts, Montana,
            New Hampshire, Nevada, Pennsylvania, and Washington
          </strong>{" "}
          &mdash; require all-party consent to record private conversations.
          You are solely responsible for obtaining any consent required before
          directing the Extension at audio &mdash; live calls, conferences,
          voicemail, ambient room audio, private streams.
        </p>
        <p className="leading-relaxed mb-3">
          You further agree not to use the Service to:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Capture, transcribe, or process any audio you are not legally
            entitled to process.
          </li>
          <li>
            Direct the Extension at audio of any identifiable child under 13,
            harass or surveil any person, or produce content sexualizing or
            harming any minor.
          </li>
          <li>
            Violate any rights-holder&rsquo;s copyright, circumvent DRM, or
            redistribute persona output as if it were a real statement by a
            person whose voice was captured.
          </li>
          <li>
            Abuse the Demo allowance through scripted trial-resetting,
            bypass Stripe webhooks, or redistribute / resell a Plus license
            key.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Peanut Gallery Plus
        </h2>
        <p className="leading-relaxed mb-3">
          Plus is $8.00 USD per month (plus applicable sales tax), billed
          through Stripe on an auto-renewing monthly cycle. Plus includes 16
          hours of hosted transcription per rolling 7-day period. Sessions in
          progress when you cross the cap continue to their natural end; new
          sessions cannot start until the oldest used time rolls off.
        </p>
        <p className="leading-relaxed mb-3">
          <strong>Pro-rata refund on request, no questions asked</strong>, for
          the current billing period &mdash; email{" "}
          <a
            href="mailto:legal@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            legal@peanutgallery.live
          </a>
          . Cancel anytime through the Stripe customer portal (linked from
          the Extension&rsquo;s Manage button). After cancellation, your
          subscription remains active through the end of the billing period.
          We will not pro-rate cancellations except for the refund above or
          for a material adverse change we introduce to Plus.
        </p>
        <p className="leading-relaxed">
          By creating a Plus subscription you represent that your billing
          address is in the United States. We may refund and terminate any
          subscription whose billing address is outside the U.S.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          AI output disclaimer
        </h2>
        <p className="leading-relaxed">
          <strong>All persona output is AI-generated and may be inaccurate,
          misleading, fabricated, biased, offensive, or wrong.</strong> The
          Service uses third-party large-language-model providers and a
          third-party search provider and may misattribute statements,
          produce confident-sounding &ldquo;fact-checks&rdquo; that are not
          factual, repeat errors in the transcript or search results, or fail
          in ways unique to streaming AI. You are responsible for verifying
          persona output before relying on it for any purpose, and for any
          consequences of redistributing it. Label redistributed output as
          AI-generated commentary, not as a quote from any real person.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What the Service is not
        </h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Not legal, medical, financial, tax, or professional advice of any
            kind.
          </li>
          <li>
            Not a verified news source. Persona fact-checks may be wrong.
          </li>
          <li>
            Not a recording or archiving service. We do not save audio files.
          </li>
          <li>
            Not a traditional account-backed service. There is no account
            page; your license key and install ID are the entire stored state
            of our relationship.
          </li>
          <li>Not ad-supported.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Intellectual property
        </h2>
        <p className="leading-relaxed mb-3">
          The Extension&rsquo;s source code is licensed under the{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            MIT License
          </a>
          . The Peanut Gallery name and mascot artwork are reserved.
        </p>
        <p className="leading-relaxed mb-3">
          The persona packs are <strong>inspired by</strong>, but not
          licensed from, public figures &mdash; currently the Howard Stern
          Show on-air crew and the <em>This Week in Startups</em> hosts. We
          make no claim of ownership over those individuals&rsquo; names,
          voices, likenesses, or personalities. The persona system prompts
          are original text authored by us. If you are a public figure (or
          representative of one) whose name appears and you want it removed,
          email{" "}
          <a
            href="mailto:legal@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            legal@peanutgallery.live
          </a>
          . We respond promptly and in good faith.
        </p>
        <p className="leading-relaxed">
          Feedback you submit (in-Extension upvotes, downvotes, pins,
          quote-cards; bug reports; support emails; pull requests) is
          licensed to us non-exclusively, worldwide, royalty-free, to
          incorporate into the Service. You retain ownership of your
          feedback.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Warranty disclaimer</h2>
        <p className="leading-relaxed">
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo;, WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND
          TO THE FULLEST EXTENT PERMITTED BY LAW. We disclaim all warranties,
          express or implied, including merchantability, fitness for a
          particular purpose, and non-infringement. We do not warrant that
          the Service will be uninterrupted, timely, secure, error-free, or
          that persona output will be accurate.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Limitation of liability
        </h2>
        <p className="leading-relaxed">
          TO THE FULLEST EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, EXEMPLARY, SPECIAL, OR
          PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, GOODWILL, OR
          DATA. OUR AGGREGATE LIABILITY WILL NOT EXCEED THE GREATER OF (a)
          THE AMOUNT YOU HAVE PAID US IN THE TWELVE MONTHS PRECEDING THE
          CLAIM OR (b) $100 USD. Some jurisdictions don&rsquo;t allow these
          limitations; where that&rsquo;s true, our liability is limited to
          the greatest extent permitted by law.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Indemnification</h2>
        <p className="leading-relaxed">
          You will defend, indemnify, and hold us harmless from third-party
          claims arising out of your use of the Service, your violation of
          these Terms (especially the Acceptable Use section), your
          violation of any law or third-party right (including intellectual
          property, privacy, publicity, and recording-consent rights), any
          audio or content you direct the Extension to process, or your
          redistribution of persona output.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Governing law and disputes
        </h2>
        <p className="leading-relaxed">
          These Terms are governed by the laws of the State of North
          Carolina, U.S.A., without regard to conflict-of-laws principles.
          Any dispute must be brought exclusively in the state or federal
          courts sitting in <strong>Macon County, North Carolina</strong>,
          and you and we consent to personal jurisdiction and venue in those
          courts. Before filing any action, you and we agree to attempt
          informal resolution for 60 days by emailing{" "}
          <a
            href="mailto:legal@peanutgallery.live"
            className="text-[#3b82f6] hover:underline"
          >
            legal@peanutgallery.live
          </a>
          . Small-claims court is preserved. To the fullest extent permitted
          by law, you and we waive any right to trial by jury.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Changes to these Terms
        </h2>
        <p className="leading-relaxed">
          For material changes affecting Plus subscribers (price, cap,
          billing cadence, refund mechanics, data handling), we will email
          active subscribers at least 30 days before the change takes effect
          and allow cancellation with a pro-rata refund. Non-material
          changes are effective on the updated &ldquo;Last updated&rdquo;
          date.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">Contact</h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            General / billing / legal:{" "}
            <a
              href="mailto:legal@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              legal@peanutgallery.live
            </a>
          </li>
          <li>
            Security disclosures:{" "}
            <a
              href="mailto:security@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              security@peanutgallery.live
            </a>
          </li>
          <li>
            Urgent:{" "}
            <a
              href="mailto:seth@peanutgallery.live"
              className="text-[#3b82f6] hover:underline"
            >
              seth@peanutgallery.live
            </a>{" "}
            with <code>[urgent]</code> in the subject.
          </li>
        </ul>

        <div className="mt-14 pt-8 border-t border-white/10 text-sm text-[#808080]">
          The full-length counsel-review draft of these Terms lives at{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/legal/TERMS-OF-SERVICE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            docs/legal/TERMS-OF-SERVICE.md
          </a>
          . The source code is MIT-licensed at{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            github.com/Sethmr/peanut.gallery
          </a>
          .
        </div>
      </div>
    </main>
  );
}
