import Link from "next/link";
import type { Metadata } from "next";

const cwsUrl =
  "https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh";
const githubUrl = "https://github.com/Sethmr/peanut.gallery";

export const metadata: Metadata = {
  title: "Install the Peanut Gallery Chrome Extension",
  description:
    "Install Peanut Gallery for Chrome — the free, open-source YouTube AI sidebar. Four AI personas react to any YouTube video in real time from Chrome's native side panel.",
  alternates: { canonical: "https://peanutgallery.live/install" },
  openGraph: {
    title: "Install the Peanut Gallery Chrome Extension",
    description:
      "Free Chrome extension. AI writers' room for any YouTube video. Fact-checker, comedy writer, sound effects guy, cynical troll.",
    url: "https://peanutgallery.live/install",
    type: "website",
  },
};

export default function InstallPage() {
  return (
    <main className="min-h-screen bg-bg-primary text-[#e5e5e5]">
      <div className="max-w-[820px] mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[#3b82f6] hover:underline">
          &larr; peanutgallery.live
        </Link>

        <h1 className="text-4xl sm:text-5xl font-bold mt-6 mb-4">
          Install the Peanut Gallery Chrome Extension
        </h1>

        <p className="text-lg text-[#a0a0a0] mb-8">
          The free, open-source AI writers&apos; room for YouTube. Add it to
          Chrome in one click and watch any YouTube video with four AI personas
          reacting in real time from Chrome&apos;s native side panel.
        </p>

        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href={cwsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-[#3b82f6] px-6 py-3 font-semibold text-white hover:bg-[#2563eb] transition"
          >
            Add to Chrome &rarr;
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[#333] px-6 py-3 font-semibold hover:border-[#555] transition"
          >
            View on GitHub
          </a>
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">
            What is Peanut Gallery?
          </h2>
          <p className="text-[#c0c0c0] leading-relaxed mb-4">
            Peanut Gallery is a Chrome extension that adds a live AI sidebar to
            any YouTube video. Instead of watching alone, you watch with a
            writers&apos; room of four AI personas inspired by the Howard Stern
            Show staff: a fact-checker who catches misstatements mid-sentence, a
            comedy writer dropping setup-punchline one-liners, a sound effects
            guy with timed cues, and a cynical troll saying what the audience
            is thinking.
          </p>
          <p className="text-[#c0c0c0] leading-relaxed">
            It works on any YouTube video — podcasts, interviews, livestreams,
            lectures, music, keynotes, news clips, anything with audio. The
            extension captures tab audio silently through Chrome&apos;s{" "}
            <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm">
              tabCapture
            </code>{" "}
            API (the same one Otter.ai and Fireflies use), so there&apos;s no
            screen-share picker, no playback interference, and nothing for
            YouTube to detect.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">How to install</h2>
          <ol className="list-decimal pl-6 space-y-2 text-[#c0c0c0] leading-relaxed">
            <li>
              Click{" "}
              <a
                href={cwsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                Add to Chrome
              </a>{" "}
              on the Chrome Web Store.
            </li>
            <li>
              Accept the permissions prompt (tab capture, side panel, storage).
            </li>
            <li>Open any YouTube video.</li>
            <li>
              Click the 🥜 Peanut Gallery icon in the Chrome toolbar to open the
              side panel.
            </li>
            <li>
              Click <strong>Start Listening</strong>. The four personas begin
              reacting in real time.
            </li>
          </ol>
          <p className="mt-4 text-[#c0c0c0] leading-relaxed">
            <strong className="text-[#86efac]">Free to try while we grow.</strong>{" "}
            No API keys required right now — the hosted backend covers casual use
            on our dime. When that changes, you can drop in your own free-tier
            keys (every provider has one), self-host the reference backend, or
            rebuild the backend in whatever stack you prefer.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">Self-host or build your own backend</h2>
          <p className="text-[#c0c0c0] leading-relaxed mb-4">
            Peanut Gallery is MIT-licensed and fully open source. If you want
            full privacy, unlimited use, or a branded fork, you have three
            paths:
          </p>
          <ul className="space-y-2 text-[#c0c0c0] leading-relaxed mb-4">
            <li>
              <strong>Bring your own API keys.</strong> Paste them into the
              side panel — they live in browser storage and are forwarded
              directly to each provider on every request.
            </li>
            <li>
              <strong>Run the reference backend locally or on Railway.</strong>{" "}
              Clone the repo, run <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm">./setup.sh</code>, point the extension at <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm">http://localhost:3000</code>. See the{" "}
              <a
                href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/SELF-HOST-INSTALL.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                self-host install guide
              </a>
              .
            </li>
            <li>
              <strong>Build your own backend from scratch.</strong> The extension
              talks to any server that follows the wire spec. Pick any stack —
              Go, Rust, Python, Elixir, Bun — then implement the six endpoints
              described in the{" "}
              <a
                href="https://github.com/Sethmr/peanut.gallery/blob/main/docs/BUILD-YOUR-OWN-BACKEND.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                build-your-own-backend spec
              </a>
              . A copy-paste prompt in the README lets Claude or Cursor
              scaffold it for you.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">Features</h2>
          <ul className="space-y-2 text-[#c0c0c0] leading-relaxed">
            <li>
              <strong>Native Chrome side panel.</strong> The gallery lives next
              to the video, not on top of it. No tab switching.
            </li>
            <li>
              <strong>Real-time YouTube transcription.</strong> Deepgram Nova-3
              transcribes tab audio in under 300ms.
            </li>
            <li>
              <strong>Live fact-checking.</strong> Claims are cross-referenced
              against Brave Search while the video plays.
            </li>
            <li>
              <strong>Four AI personas.</strong> Director logic picks the best
              persona per moment; others cascade with staggered delays.
            </li>
            <li>
              <strong>Silent tab capture.</strong> No screen-share picker. Zero
              playback interference.
            </li>
            <li>
              <strong>Bring your own API keys.</strong> Deepgram,
              Anthropic, xAI, Brave — all have free tiers.
            </li>
            <li>
              <strong>Open source, MIT licensed.</strong> Self-host, fork, or
              swap providers freely.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">Requirements</h2>
          <p className="text-[#c0c0c0] leading-relaxed">
            Google Chrome 116 or later (Side Panel API required). Works on any
            desktop platform — Windows, macOS, Linux, ChromeOS. Does not
            currently support Firefox, Safari, or mobile Chrome because those
            browsers don&apos;t implement{" "}
            <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm">
              chrome.tabCapture
            </code>
            .
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-3">Privacy</h2>
          <p className="text-[#c0c0c0] leading-relaxed">
            Your audio is transcribed in real time and discarded. If you use the
            hosted backend, API keys live in browser storage and are forwarded
            on each request — never logged, never persisted. If you self-host,
            nothing leaves your machine except the transcription stream. See
            the full <Link href="/privacy" className="text-[#3b82f6] hover:underline">privacy policy</Link>.
          </p>
        </section>

        <div className="flex flex-wrap gap-3 pt-4 border-t border-[#222]">
          <a
            href={cwsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-[#3b82f6] px-6 py-3 font-semibold text-white hover:bg-[#2563eb] transition"
          >
            Add Peanut Gallery to Chrome &rarr;
          </a>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-[#333] px-6 py-3 font-semibold hover:border-[#555] transition"
          >
            Back to the demo
          </Link>
        </div>
      </div>
    </main>
  );
}
