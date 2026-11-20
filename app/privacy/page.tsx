import type { Metadata } from "next";
import LegalPage from "@/lib/LegalPage";

const URL_ = "https://buttsstudios.com/games/cards/privacy";
const TITLE = "Privacy Policy · Card Battle · Butts Studios";
const DESC = "What Card Battle stores and shares: no cookies of its own, a signed unlock token after purchase, and optional leaderboard names.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL_ },
  openGraph: { type: "website", url: URL_, title: TITLE, description: DESC, siteName: "Butts Studios", locale: "en_US" },
};

export default function Page() {
  return <LegalPage kind="privacy" title="Privacy Policy" game="Card Battle" gameUrl="https://buttsstudios.com/games/cards" />;
}
