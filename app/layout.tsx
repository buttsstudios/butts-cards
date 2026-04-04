import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Battle - Strategic Card Game",
  description: "A strategic card game - beat your opponent with higher cards",
  metadataBase: new URL("https://cards.buttsstudios.com"),
  openGraph: {
    type: "website",
    url: "https://cards.buttsstudios.com",
    title: "Card Battle - Strategic Card Game",
    description: "A strategic card game - beat your opponent with higher cards",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Card Battle Game",
      },
    ],
    siteName: "Butts Studios",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@buttsstudios",
    creator: "@buttsstudios",
    title: "Card Battle - Strategic Card Game",
    description: "A strategic card game - beat your opponent with higher cards",
    images: ["/og-image.png"],
  },
  themeColor: "#9C27B0",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
