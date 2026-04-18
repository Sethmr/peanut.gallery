import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Peanut Gallery handles your audio, API keys, and session data. Short answer: your keys stay on your machine, audio is transcribed in real-time and discarded, nothing is logged.",
  alternates: { canonical: "https://peanutgallery.live/privacy" },
};

const lastUpdated = "April 17, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg-primary text-[#e5e5e5]">
      <div className="max-w-[720px] mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-[#3b82f6] hover:underline"
        >
          &larr; Back to peanutgallery.live
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#a0a0a0] mb-10">
          Last updated: {lastUpdated}
        </p>

        <section className="space-y-4 leading-relaxed">
          <p>
            Peanut Gallery is a Chrome extension and companion web app that
            listens to the audio of the tab you&rsquo;re currently on, transcribes
            it in real-time, and streams AI persona reactions back to a native
            Chrome side panel (or a web page, if you&rsquo;re using the reference
            web app). This policy describes what happens to the data involved.
          </p>
        </section>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What the extension collects
        </h2>
        <p className="leading-relaxed mb-3">
          The extension only captures audio when you explicitly click{" "}
          <strong>Start Listening</strong> from the side panel. Specifically:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            <strong>Tab audio</strong>, via the standard{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              chrome.tabCapture
            </code>{" "}
            API &mdash; the same API used by Otter.ai, Fireflies, and other
            transcription tools. Capture stops the moment you click{" "}
            <strong>Stop</strong> or close the tab. No audio is recorded to
            disk.
          </li>
          <li>
            <strong>API keys you type into the side panel</strong> (Deepgram,
            Anthropic, xAI, optionally Brave Search). These are stored
            locally via{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              chrome.storage.local
            </code>{" "}
            so you don&rsquo;t have to retype them every session. They are sent
            to the server you configure (your own local server by default) via
            request headers so it can call those providers on your behalf.
            They are never uploaded to anyone else.
          </li>
          <li>
            <strong>The URL and title of the tab you&rsquo;re capturing from</strong>
            , passed to the server for display purposes only.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What the server does with it
        </h2>
        <p className="leading-relaxed mb-3">
          When you run the server locally (the default,{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            npm run dev
          </code>
          ), the extension streams 16kHz PCM audio chunks to{" "}
          <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
            http://localhost:3000
          </code>
          . Your keys never leave your machine. The server then:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Forwards audio to Deepgram for real-time transcription.
          </li>
          <li>
            Sends short transcript windows to Claude (Anthropic), xAI Grok,
            and your chosen search engine (Brave Search or xAI Live Search)
            to generate persona reactions and fact-checks.
          </li>
          <li>
            Streams results back to your browser via Server-Sent Events (SSE).
          </li>
          <li>
            Discards the session entirely when you click Stop or the tab
            closes. Transcripts and responses are held in memory during the
            session and are not written to disk, not logged, and not
            persisted.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          When you use the hosted web app at peanutgallery.live
        </h2>
        <p className="leading-relaxed mb-3">
          The web app at peanutgallery.live is a reference implementation that
          lets you paste a YouTube URL instead of running locally. When you use
          it:
        </p>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>
            Your API keys are sent to the server in request headers, forwarded
            to the relevant providers (Deepgram / Anthropic / xAI / Brave)
            on that single request, and <strong>discarded at session end</strong>.
            They are never logged or persisted.
          </li>
          <li>
            Audio is extracted from the YouTube URL server-side using{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              yt-dlp
            </code>{" "}
            and{" "}
            <code className="px-1 py-0.5 rounded bg-white/5 text-[0.85em]">
              ffmpeg
            </code>
            , transcribed, and discarded. Nothing is cached.
          </li>
          <li>
            You can audit the exact handling in the transcribe route on
            GitHub:{" "}
            <a
              href="https://github.com/Sethmr/peanut.gallery/blob/main/app/api/transcribe/route.ts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              app/api/transcribe/route.ts
            </a>
            .
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Third-party services
        </h2>
        <p className="leading-relaxed mb-3">
          When Peanut Gallery calls a third-party AI provider on your behalf,
          data handling is governed by that provider&rsquo;s terms:
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
            &mdash; speech-to-text.
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
            &mdash; persona responses.
          </li>
          <li>
            <a
              href="https://x.ai/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b82f6] hover:underline"
            >
              xAI
            </a>{" "}
            &mdash; Grok persona responses and optional Live Search fact-checks.
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
            &mdash; live fact-checking queries.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          Analytics
        </h2>
        <p className="leading-relaxed">
          The landing page at peanutgallery.live uses Google Analytics to
          measure aggregate page visits. No personally identifying information
          is collected beyond the standard request metadata (IP, user agent,
          referrer) that Google Analytics receives. The Chrome extension does
          not include any analytics.
        </p>

        <h2 className="text-xl font-semibold mt-10 mb-3">
          What Peanut Gallery doesn&rsquo;t do
        </h2>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>We don&rsquo;t have user accounts. There&rsquo;s nothing to sign up for.</li>
          <li>We don&rsquo;t log or store your audio, transcripts, or API keys.</li>
          <li>We don&rsquo;t sell data. There&rsquo;s nothing to sell.</li>
          <li>
            We don&rsquo;t run background capture. The extension only listens
            while you&rsquo;re actively in a session you started.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-10 mb-3">Contact</h2>
        <p className="leading-relaxed">
          Questions? Open an issue on{" "}
          <a
            href="https://github.com/Sethmr/peanut.gallery/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline"
          >
            GitHub
          </a>{" "}
          or email{" "}
          <a
            href="mailto:seth@manugames.com"
            className="text-[#3b82f6] hover:underline"
          >
            seth@manugames.com
          </a>
          .
        </p>

        <div className="mt-14 pt-8 border-t border-white/10 text-sm text-[#808080]">
          Peanut Gallery is MIT licensed open-source software. You can audit
          every line of how it handles your data at{" "}
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
