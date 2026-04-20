import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://peanutgallery.live";
const siteName = "Peanut Gallery";
const siteDescription =
  "Free Chrome extension that adds 4 AI personas — each one an illustrated peanut mascot — to any YouTube video. A fact-checker, comedy writer, sound effects guy, and cynical troll react in real-time from Chrome's native side panel. Open source, MIT licensed.";
const siteImage = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Peanut Gallery — AI writers' room for YouTube (Chrome extension)",
    template: "%s | Peanut Gallery",
  },
  description: siteDescription,
  keywords: [
    "YouTube Chrome extension",
    "AI Chrome extension",
    "YouTube AI sidebar",
    "AI commentary YouTube",
    "YouTube fact checker",
    "real-time AI reactions",
    "Chrome side panel extension",
    "AI reacts to YouTube",
    "live YouTube transcription",
    "YouTube AI assistant",
    "Howard Stern writers room",
    "AI writers room",
    "peanut gallery",
    "AI peanut mascots",
    "illustrated AI personas",
    "open source Chrome extension",
    "This Week in Startups",
    "Jason Calacanis",
    "Deepgram",
    "Claude",
    "xAI Grok",
  ],
  authors: [{ name: "Seth Rininger", url: "https://sethrininger.dev" }],
  creator: "Seth Rininger",
  publisher: "Seth Rininger",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName,
    title: "Peanut Gallery — AI writers' room for YouTube (Chrome extension)",
    description: siteDescription,
    images: [
      {
        url: siteImage,
        width: 1200,
        height: 630,
        alt: "Peanut Gallery — 4 illustrated peanut mascot personas react to any YouTube video in real-time",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peanut Gallery — AI writers' room for YouTube",
    description: "Chrome extension. 4 AI personas react to any YouTube video in real-time from the side panel. Fact-checker. Troll. Sound guy. Comedy writer. Open source.",
    images: [siteImage],
    creator: "@SethRininger",
  },
  verification: {
    google: "tPDn6BgEArjAwga6-gCNYdRt55OjqtLKERkr66-WpZc",
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-3R9CK4LRGF" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-3R9CK4LRGF');
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg-primary antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Peanut Gallery",
              alternateName: "Peanut Gallery Chrome Extension",
              description: siteDescription,
              url: siteUrl,
              downloadUrl:
                "https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh",
              installUrl:
                "https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh",
              applicationCategory: "BrowserApplication",
              applicationSubCategory: "BrowserExtension",
              operatingSystem: "Chrome",
              browserRequirements: "Requires Google Chrome 116+ (Side Panel API)",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                "@id": `${siteUrl}/#seth`,
                name: "Seth Rininger",
                url: "https://sethrininger.dev",
              },
              publisher: {
                "@type": "Organization",
                "@id": `${siteUrl}/#organization`,
                name: siteName,
                url: siteUrl,
              },
              screenshot: siteImage,
              softwareVersion: "1.5.3",
              license: "https://opensource.org/licenses/MIT",
              isAccessibleForFree: true,
              featureList: [
                "Real-time YouTube audio transcription",
                "AI fact-checking with Brave Search",
                "4 AI personas react to any YouTube video",
                "Illustrated peanut mascots for every persona (v1.5.3)",
                "Two persona packs: Howard Stern staff and This Week in Startups lineup",
                "Native Chrome side panel (no tab switching)",
                "Silent tab capture (no screen-share picker)",
                "First-run guided tour",
                "Open source and self-hostable",
                "Bring your own API keys",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What is Peanut Gallery?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Peanut Gallery is a free, open-source Chrome extension that adds an AI writers' room to any YouTube video. Four AI personas — a fact-checker, a comedy writer, a sound effects guy, and a cynical troll — watch the video with you in real time from Chrome's native side panel.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is Peanut Gallery free?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. The Chrome extension is free, the source code is MIT-licensed on GitHub, and you can self-host the backend. You can bring your own API keys (Deepgram, Anthropic, xAI, optional Brave Search) or use the hosted backend at peanutgallery.live.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does YouTube detect or block Peanut Gallery?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No. Peanut Gallery uses chrome.tabCapture — the same API Otter.ai and Fireflies use — to capture tab audio silently. There's no screen-share picker, no playback interference, and YouTube has no way to detect it.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does it work on any YouTube video?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. It works on any YouTube video — podcasts, interviews, lectures, livestreams, music, anything with audio. It was originally built for This Week in Startups, but it's not tied to any specific channel.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What AI models does Peanut Gallery use?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Deepgram Nova-3 for real-time transcription, Claude Haiku (Anthropic) for the fact-checker and comedy writer, xAI Grok 4.1 Fast (non-reasoning) for the cynical troll and sound effects guy, and either Brave Search or xAI Live Search for live fact verification — viewer's choice.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How much does it cost to run?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Roughly $1.15 in API costs per two-hour YouTube video if you bring your own keys. All providers have free tiers that cover casual use.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Is Peanut Gallery open source?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Full source code is available at github.com/Sethmr/peanut.gallery under the MIT License. You can self-host the server for full privacy or fork and modify the personas.",
                  },
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": `${siteUrl}/#organization`,
                name: siteName,
                alternateName: "Peanut Gallery — AI writers' room for YouTube",
                url: siteUrl,
                logo: {
                  "@type": "ImageObject",
                  url: `${siteUrl}/icon-512.png`,
                  width: 512,
                  height: 512,
                },
                description:
                  "Peanut Gallery is a free, open-source Chrome extension that adds a live AI writers' room to any YouTube video — four personas react in real time from Chrome's native side panel.",
                founder: {
                  "@type": "Person",
                  "@id": `${siteUrl}/#seth`,
                },
                foundingDate: "2026-04",
                sameAs: [
                  "https://github.com/Sethmr/peanut.gallery",
                  "https://chromewebstore.google.com/detail/peanut-gallery/jjlpinlhfiheegiddmddkgfialcknagh",
                ],
              },
              {
                "@context": "https://schema.org",
                "@type": "Person",
                "@id": `${siteUrl}/#seth`,
                name: "Seth Rininger",
                givenName: "Seth",
                familyName: "Rininger",
                url: "https://sethrininger.dev",
                jobTitle: "Creator of Peanut Gallery",
                description:
                  "Full-stack engineer; creator of Peanut Gallery, the open-source Chrome extension that adds four live AI personas to any YouTube video. Built to win Jason Calacanis's $5k This Week in Startups bounty.",
                sameAs: [
                  "https://github.com/Sethmr",
                  "https://x.com/SethRininger",
                  "https://sethrininger.dev",
                ],
                worksFor: {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                },
                knowsAbout: [
                  "Chrome Extensions",
                  "Next.js",
                  "AI agents",
                  "Real-time transcription",
                  "YouTube developer platform",
                ],
              },
              {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: "Peanut Gallery v1.5 walkthrough — Smart Director v2, narrated by the builder",
                description:
                  "Seth walks through Peanut Gallery v1.5's Smart Director v2 — how the LLM-assisted router picks a persona, the 400ms race against the rule-based fallback, and what changed since v1.4. Recorded with voice-over by the builder.",
                thumbnailUrl: "https://i.ytimg.com/vi/WPyknI7-N5U/maxresdefault.jpg",
                uploadDate: "2026-04-18T00:00:00Z",
                contentUrl: "https://www.youtube.com/watch?v=WPyknI7-N5U",
                embedUrl: "https://www.youtube.com/embed/WPyknI7-N5U",
                publisher: {
                  "@type": "Person",
                  name: "Seth Rininger",
                  url: "https://sethrininger.dev",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: "Peanut Gallery — product demo",
                description:
                  "Two-minute walkthrough of the Peanut Gallery Chrome extension reacting to a YouTube video in real time from the side panel.",
                thumbnailUrl: "https://i.ytimg.com/vi/UcpUBcp8TRc/maxresdefault.jpg",
                uploadDate: "2026-04-17T00:00:00Z",
                contentUrl: "https://www.youtube.com/watch?v=UcpUBcp8TRc",
                embedUrl: "https://www.youtube.com/embed/UcpUBcp8TRc",
                publisher: {
                  "@type": "Person",
                  name: "Seth Rininger",
                  url: "https://sethrininger.dev",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                name: "Jason Calacanis & Lon Harris — $5k bounty announcement",
                description:
                  "The This Week in Startups challenge that inspired Peanut Gallery: build a live AI sidebar with four personas that reacts to YouTube in real time.",
                thumbnailUrl: "https://i.ytimg.com/vi/xHdwcCfuy4Y/maxresdefault.jpg",
                uploadDate: "2026-04-15T00:00:00Z",
                contentUrl: "https://www.youtube.com/watch?v=xHdwcCfuy4Y",
                embedUrl: "https://www.youtube.com/embed/xHdwcCfuy4Y",
                publisher: {
                  "@type": "Organization",
                  name: "This Week in Startups",
                  url: "https://thisweekinstartups.com",
                },
              },
            ]),
          }}
        />
        {children}
      </body>
    </html>
  );
}
