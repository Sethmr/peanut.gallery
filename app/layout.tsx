import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peanut Gallery — AI Podcast Sidebar",
  description:
    "4 AI personas inspired by the Howard Stern Show watch your podcast in real-time. A fact-checker, a sound effects guy, a comedy writer, and a cynical troll.",
  openGraph: {
    title: "Peanut Gallery",
    description: "Your podcast's AI writers' room.",
    url: "https://peanutgallery.live",
  },
  verification: {
    google: "tPDn6BgEArjAwga6-gCNYdRt55OjqtLKERkr66-WpZc",
  },
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
      <body className="min-h-screen bg-bg-primary antialiased">{children}</body>
    </html>
  );
}
