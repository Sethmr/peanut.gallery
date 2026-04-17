import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://peanutgallery.live";
const siteName = "Peanut Gallery";
const siteDescription =
  "Free Chrome extension that adds 4 AI personas to any YouTube video — a fact-checker, comedy writer, sound effects guy, and cynical troll react in real-time from Chrome's native side panel. Open source, MIT licensed.";
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
    "open source Chrome extension",
    "This Week in Startups",
    "Jason Calacanis",
    "Deepgram",
    "Claude",
    "Groq",
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
        alt: "Peanut Gallery — 4 AI personas react to any YouTube video in real-time",
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
                name: "Seth Rininger",
                url: "https://sethrininger.dev",
              },
              screenshot: siteImage,
              softwareVersion: "1.0.6",
              license: "https://opensource.org/licenses/MIT",
              isAccessibleForFree: true,
              featureList: [
                "Real-time YouTube audio transcription",
                "AI fact-checking with Brave Search",
                "4 AI personas react to any YouTube video",
                "Native Chrome side panel (no tab switching)",
                "Silent tab capture (no screen-share picker)",
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
                    text: "Yes. The Chrome extension is free, the source code is MIT-licensed on GitHub, and you can self-host the backend. You can bring your own API keys (Deepgram, Groq, Anthropic, Brave Search) or use the hosted backend at peanutgallery.live.",
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
                    text: "Deepgram Nova-3 for real-time transcription, Claude Haiku for the fact-checker and comedy writer, Groq-hosted Llama 70B and 8B for the cynical troll and sound effects guy, and Brave Search API for live fact verification.",
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
                "@type": "VideoObject",
                name: "Peanut Gallery — product demo",
                description:
                  "Two-minute walkthrough of the Peanut Gallery Chrome extension reacting to a YouTube video in real time from the side panel.",
                thumbnailUrl: "https://i.ytimg.com/vi/UcpUBcp8TRc/maxresdefault.jpg",
                uploadDate: "2026-04-17",
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
                uploadDate: "2026-04-15",
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
