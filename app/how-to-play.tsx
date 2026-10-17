// "How to play": the fundamentals in plain sentences (Principal 2026-10-17). Closed on load, every visit; the
// "How to play" button next to the title (title screen and match screen) opens and closes it. Keep it in step with
// lib/engine.ts and lib/auth.ts.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { DAILY_PLAYS } from '@/lib/auth';

export default function HowToPlay({ headingLevel = 3, about = false }: { headingLevel?: 2 | 3; about?: boolean }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="howto">
      <H>The goal</H>
      <p>Win more points than your opponent over six rounds. Each round, a prize worth 1 to 6 points sits in the middle of the table. Whoever plays the stronger card takes the prize.</p>

      <H>How to play</H>
      <p>You choose which card to play each round. Tap or click a card to pick it, then tap it again or press Play. On a keyboard, press 1 to 6 to pick a card, or use the arrow keys, then press Enter.</p>
      <p>Your opponent picks at the same time and never sees your card. A card&rsquo;s strength is its rank, from 2 (weakest) up to Ace (strongest). A card that matches the prize&rsquo;s suit gets 2 extra. The small number on each card shows its strength for this prize. Each card can be played only once.</p>

      <H>What things cost</H>
      <p>There are no coins or lives. Without Premium you get {DAILY_PLAYS} matches a day, and the count starts over each day. The Daily Deal counts as one of them. Your first guided match does not count.</p>
      <p>Premium is a one-time payment of $3. It gives you unlimited matches, the Master opponent, rivals 2 to 6 on the rival ladder, and the card backs you win from them. It unlocks in the browser you paid in.</p>

      <H>How you earn</H>
      <p>You win a prize&rsquo;s points when your card is stronger. If you tie, the prize goes into a pot, and whoever wins the next round takes the pot too. When you win a match, your score is your points times the opponent&rsquo;s level: Rookie times 1, Sharp times 2, Master times 3. You can post a winning score to Top scores, and beating a rival earns you that rival&rsquo;s card back.</p>
      <p>Points and scores have no cash value. You cannot win money in this game.</p>

      <H>The challenge</H>
      <p>You both hold the same six ranks, so a big card spent on a small prize is gone for the rest of the match. Harder opponents plan ahead. Each rival adds one house rule, such as a triple-value last prize, a face-down hand, or low cards winning on clubs. You lose the match if your opponent ends with more points.</p>

      <H>Quick tip</H>
      <p>Save your highest cards for the biggest prizes, and throw your lowest cards at the small ones.</p>

      {about && (
        <details className="about">
          <summary>Read more about Card Battle</summary>
          <p>Quick match lets you pick an opponent: Rookie plays loosely, Sharp reads the prize, and Master works out the rest of the match before every card. The Daily Deal is one shuffled deal shared by every player today, played against Sharp.</p>
          <p>The rival ladder has six rivals. Beat one to face the next. Rival 1 is open to everyone. Your record, card backs and ladder progress are saved in this browser.</p>
        </details>
      )}
    </div>
  );
}

/** Open state for the How to play panel: closed on load (opens only for an explicit #how-to-play link), Esc closes it
 *  before the game's own keys see it, and focus moves into the panel on open and back to the button on close. */
export function useHowto() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => { if (window.location.hash === '#how-to-play') setOpen(true); }, []);
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpen.current) btnRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopImmediatePropagation(); setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return { open, setOpen, btnRef, panelRef, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

export type Howto = ReturnType<typeof useHowto>;

export function HowToButton({ howto, className = 'btn btn-secondary' }: { howto: Howto; className?: string }) {
  return (
    <button ref={howto.btnRef} type="button" className={className} aria-expanded={howto.open} aria-controls="how-to-play" onClick={howto.toggle}>
      How to play
    </button>
  );
}

export function HowToPanel({ howto, about = false, children }: { howto: Howto; about?: boolean; children?: ReactNode }) {
  return (
    <section className="htp" id="how-to-play" aria-labelledby="htp-title" tabIndex={-1} hidden={!howto.open}
      ref={howto.panelRef as RefObject<HTMLElement>}>
      <div className="htp-head">
        <h2 id="htp-title">How to play</h2>
        <button type="button" className="btn btn-secondary btn-small" onClick={howto.close}>Hide</button>
      </div>
      <HowToPlay about={about} />
      {children}
    </section>
  );
}
