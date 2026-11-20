import type { Metadata } from "next";
import LegalPage from "@/lib/LegalPage";

const URL_ = "https://buttsstudios.com/games/cards/refunds";
const TITLE = "Refund Policy · Card Battle · Butts Studios";
const DESC = "Card Battle refund policy: 14-day refunds on the one-time unlock, restores after lost browser data, and how to ask.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL_ },
  openGraph: { type: "website", url: URL_, title: TITLE, description: DESC, siteName: "Butts Studios", locale: "en_US", images: [{ url: "https://buttsstudios.com/games/cards/og-image.jpg", width: 1200, height: 630 }] },
};

export default function Page() {
  return <LegalPage kind="refunds" title="Refund Policy" game="Card Battle" gameUrl="https://buttsstudios.com/games/cards" />;
}
