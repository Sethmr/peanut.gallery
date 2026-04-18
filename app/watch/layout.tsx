import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Peanut Gallery — Reference Web App (try the Chrome extension)",
  description:
    "The original Peanut Gallery web-app prototype. For real-time AI reactions to any YouTube video, install the Chrome extension — free, open source, MIT licensed.",
  alternates: { canonical: "https://peanutgallery.live/watch" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Peanut Gallery — Reference Web App",
    description:
      "The original web-app prototype that became the Chrome extension. Paste a YouTube URL to see the persona pipeline run in a single tab.",
    url: "https://peanutgallery.live/watch",
    type: "website",
  },
};

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
      name: "Reference Web App",
      item: "https://peanutgallery.live/watch",
    },
  ],
};

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
