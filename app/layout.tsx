import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butts Cards - Strategic Card Game",
  description: "A strategic card game with unique mechanics and competitive multiplayer modes.",
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
