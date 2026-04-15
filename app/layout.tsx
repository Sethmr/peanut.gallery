import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Peanut Gallery — AI Podcast Sidebar",
  description:
    "4 AI personas watch your live show and react in real-time. A stern producer, a cynical troll, a chaos agent, and a joke writer.",
  openGraph: {
    title: "Peanut Gallery",
    description: "Your podcast's AI writers' room.",
    url: "https://peanutgallery.live",
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
