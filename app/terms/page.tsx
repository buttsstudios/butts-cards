import type { Metadata } from "next";
import LegalPage from "@/lib/LegalPage";

const URL_ = "https://buttsstudios.com/games/cards/terms";
const TITLE = "Terms of Use · Card Battle · Butts Studios";
const DESC = "The terms for using Card Battle, the browser game from Butts Studios, including how the one-time unlock purchase works.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL_ },
  openGraph: { type: "website", url: URL_, title: TITLE, description: DESC, siteName: "Butts Studios", locale: "en_US", images: [{ url: "https://buttsstudios.com/games/cards/og-image.jpg", width: 1200, height: 630 }] },
};

export default function Page() {
  return <LegalPage kind="terms" title="Terms of Use" game="Card Battle" gameUrl="https://buttsstudios.com/games/cards" />;
}
