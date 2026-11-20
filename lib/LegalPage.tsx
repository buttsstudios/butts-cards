import { LEGAL } from "./legalContent";

export default function LegalPage({ kind, title, game, gameUrl }: { kind: "terms" | "refunds" | "privacy"; title: string; game: string; gameUrl: string }) {
  return (
    <main className="legal" id="main" tabIndex={-1}>
      <h1>{title}</h1>
      <div dangerouslySetInnerHTML={{ __html: LEGAL[kind] }} />
      <p className="legal-back"><a href={gameUrl}>Back to {game}</a></p>
    </main>
  );
}
