import type { Metadata } from "next";
import "./studios-section.css";
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
  themeColor: "#050707",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-section="games">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* bs:bar */}
        <div className="bs-bar" role="banner"><div className="bs-bar-in"><a className="bs-mark" href="https://buttsstudios.com/" aria-label="Butts Studios home"><svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="12"><rect x="10" y="10" width="80" height="80"/><path d="M10 10 L90 90 M90 10 L10 90"/></g></svg><span>Butts Studios</span></a><span className="bs-crumb"><span className="bs-sep">/</span><a className="bs-sec" href="https://buttsstudios.com/games.html"><i className="bs-dot" />Games</a><span className="bs-sep">/</span><span className="bs-here">Card Battle</span></span><div className="bs-nav" role="navigation" aria-label="Butts Studios sections"><a href="https://buttsstudios.com/books.html">Books</a><a href="https://buttsstudios.com/video.html">Video</a><a href="https://buttsstudios.com/games.html" aria-current="true">Games</a></div></div></div>
        {children}
        {/* bs:foot */}
        <div className="bs-foot" role="contentinfo"><div className="bs-foot-in"><div><a className="bs-mark" href="https://buttsstudios.com/" aria-label="Butts Studios home"><svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="12"><rect x="10" y="10" width="80" height="80"/><path d="M10 10 L90 90 M90 10 L10 90"/></g></svg><span>Butts Studios</span></a><div className="bs-foot-line">Made of story.</div></div><div className="bs-foot-cols" role="navigation" aria-label="Butts Studios"><a href="https://buttsstudios.com/books.html">Books</a><a href="https://buttsstudios.com/video.html">Video</a><a href="https://buttsstudios.com/games.html" aria-current="true">Games</a><a href="https://buttsstudios.com/">Studio</a><a href="https://www.instagram.com/buttsstudios/" target="_blank" rel="noopener">Instagram</a></div></div><div className="bs-foot-base"><span>© 2026 Butts Studios</span><span className="bs-legal"><a href="https://buttsstudios.com/terms.html">Terms</a><a href="https://buttsstudios.com/refunds.html">Refunds</a><a href="https://buttsstudios.com/privacy.html">Privacy</a></span></div></div>
      </body>
    </html>
  );
}
