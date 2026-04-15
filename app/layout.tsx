import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://peanutgallery.live";
const siteName = "Peanut Gallery";
const siteDescription =
  "4 AI personas inspired by the Howard Stern Show watch your podcast in real-time. A fact-checker, a sound effects guy, a comedy writer, and a cynical troll. Open source — self-host or use the hosted version.";
const siteImage = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Peanut Gallery — AI Podcast Sidebar",
    template: "%s | Peanut Gallery",
  },
  description: siteDescription,
  keywords: [
    "AI podcast",
    "podcast sidebar",
    "AI commentary",
    "real-time transcription",
    "Howard Stern",
    "podcast AI",
    "fact checker",
    "comedy writer",
    "open source",
    "This Week in Startups",
    "Jason Calacanis",
    "YouTube live",
    "AI writers room",
    "podcast tools",
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
    title: "Peanut Gallery — Your podcast's AI writers' room",
    description: siteDescription,
    images: [
      {
        url: siteImage,
        width: 1200,
        height: 630,
        alt: "Peanut Gallery — 4 AI personas react to your podcast in real-time",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Peanut Gallery — AI Podcast Sidebar",
    description: "4 AI personas watch your podcast and react in real-time. Fact-checker. Troll. Sound guy. Comedy writer. Open source.",
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
              description: siteDescription,
              url: siteUrl,
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
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
              softwareVersion: "1.0",
              license: "https://opensource.org/licenses/MIT",
              isAccessibleForFree: true,
              featureList: [
                "Real-time podcast transcription",
                "AI fact-checking with Brave Search",
                "4 AI personas react to podcast content",
                "Howard Stern Show inspired commentary",
                "Open source and self-hostable",
                "Bring your own API keys",
              ],
            }),
          }}
        />
        {children}
      </body>
    </html>
  );
}
