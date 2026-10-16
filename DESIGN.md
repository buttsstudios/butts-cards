# Card Battle: design notes

Branch `design/next-level-2026-10-16`, built on `style/studios-sections-2026-10-16` (which carries `fix/verify-purchase`
and `price/no-99`). Live at cards.buttsstudios.com is still the older `main`; nothing here is deployed.

## 1. Teardown of the version before this branch

| Area | What it was | Problem |
|---|---|---|
| Core loop | Pick one of 5 cards, opponent plays a **uniformly random** card, higher rank wins a point. | No decision matters. Against a random opponent every order of your 5 cards has the same expected result, so the game is a coin flip with extra clicks. |
| Feel | Instant state swap; the opponent card simply appears. | No anticipation, no reveal, no sense of who won the round. |
| Pacing | 5 clicks x 2 (select, then "Play Card"), then a dead end. | No rematch hook, no "one more". |
| Onboarding | Name wall before anything is visible, and after entering a name **no cards are dealt** ("Cards Left: 0"; the player must find "New Game"; seen in the live playtest); rules modal says "Win a round = card value in points. First to 5 cards loses!" | The rules text was wrong (a round is 1 point; nobody "loses at 5 cards"). The name gate blocks the first impression. |
| Juice | Hover lift only. No sound, no haptics, no score motion. | Nothing to tell the hand that it did something. |
| Difficulty | One level: random. | No curve, nothing to master. |
| Progression | None. Premium = "unlimited daily games". | Premium was also **broken**: `canPlay()` ignored premium, so a paying player still hit the daily wall. |
| Leaderboard | The live Firestore read fails ("Missing or insufficient permissions" in the playtest console) and the page shows "No scores yet - be the first!" | A false empty state. Now it says "Top scores are unavailable right now"; the Firestore rules for `scores` need a fix outside this repo. |
| Replay value | None beyond the leaderboard (which stores 1-5 point wins, so it saturates at 5). | |
| Accessibility | Cards are `div`s with click handlers; no keyboard, no labels, no live region. | Unplayable without a pointer; screen readers get nothing. |
| Mobile | Fixed 100x140 cards wrap to two rows on a phone; buttons are small. | Hand splits across rows; Play button far from the thumb. |
| Performance | Firebase/Firestore is imported on first paint for the leaderboard. | The largest chunk of JS loads before the player can do anything. |

## 2. The redesign

**One sentence:** each round a prize (1 to 6 points) is turned up, both players choose a card at the same moment, the
higher power takes the prize, and a tie pushes the prize into a pot for the next round.

This is the shape of Goofspiel (a classic simultaneous-bid card game), with three choices that make it ours and keep
it readable in a minute:

- **Mirror deal.** Both hands hold the same six ranks (suits differ). Every match is fair, and the opponent's face-up
  hand becomes a puzzle: "they still have the King, so my Queen can't take the 6 unless I'm on suit."
- **Suit bonus (+2).** A card matching the prize suit gets +2 power. This is what makes a 9 worth more than a Jack
  sometimes, and it is shown on every card as a live power number for the current prize, so nobody does arithmetic.
- **Pot on ties.** Ties carry the prize forward. Mirror ranks make ties common enough to create swingy, loud rounds.

Six rounds, 21 points on the table, about a minute a match.

**Honesty rule built into the engine:** the opponent picks its card at the start of the round from public information
only (its hand, your hand, the prize, pot and the prizes still to come). `lockOpponent()` is called before you choose,
and the UI shows its face-down card as "Locked" while you think. It never reads your card.

### Feel and feedback
- Round timeline (about 1.9 s, cut to near zero under `prefers-reduced-motion`): your card flies in, the locked
  opponent card flips (scaleX flip), power tags pop under both, the winner lifts with an accent outline, the loser
  dims, the score number bumps, round pips fill green/red/gold, the next prize deals in.
- Synthesized WebAudio sounds (no files to download): select tick, play swish, flip, round win/lose/tie, match win/lose,
  unlock. Mute toggle (also `M`), remembered in the browser. Short vibration on round and match wins where supported.
- Play button names the card ("Play Q♠"); tapping a selected card again plays it.

### Onboarding
- No name wall. The title screen shows the table at a glance and one line: "Six cards each. Six prizes. You both choose at once."
- The first match is guided against Rookie and **does not use a daily play**. A coach line changes each round for the
  first four rounds (prize, suit bonus, mirror hands, pot).
- Rules modal rewritten to match the actual game. "Still to come" chips show the prize values left, so card-counting
  is a visible skill, not a memory test.
- A name is asked only when you choose to post a win to Top scores.

### Opponents and difficulty curve
Headless self-play (`npx tsx scripts/ai-sim.ts 300` on xps, 300 matches per pairing):

| Matchup | Win | Loss |
|---|---|---|
| Rookie vs random | 59% | 40% |
| Sharp vs random | 73% | 26% |
| Master vs random | 79% | 20% |
| Sharp vs Rookie | 67% | 33% |
| Master vs Rookie | 81% | 18% |
| Master vs Sharp | 91% | 9% |

- **Rookie**: mostly loose, sometimes sensible. For learning.
- **Sharp**: fights for the biggest prizes left with the cheapest card that is sure to win; dumps its weakest card on small prizes.
- **Master** (Premium): for each card in hand, runs 160 simulated finishes of the match (unknown prize order and
  suits re-sampled, you modelled as a noisy Sharp player) and plays the best average margin. About 30 ms per decision.

### Progression (what Premium is for)
Everyone gets: Rookie and Sharp quick matches, the Daily Deal (the same seeded deal for every player that day), the
first rival on the ladder, stats (matches, win %, streak, best streak, best score), card back selection.

**Premium, $3 one-time, unlocked in this browser after a verified Stripe payment:**
1. No daily limit (5 plays a day otherwise; the guided first match is not counted).
2. Master opponent.
3. The full **Rival ladder**: five more rivals, each with a house rule that changes strategy, not just difficulty:
   Pike (sixth prize worth triple), Marrow (closed hand), Vesper (low wins on club prizes), Hollis (+4 suit bonus),
   The House (all of the above). Beat one to open the next.
4. A card back for each rival beaten (CSS patterns, no image downloads).

Self-play of each rival against a Sharp-strength player: Dot 31%, Pike 43%, Marrow 46%, Vesper 85%, Hollis 85%,
The House 78% rival wins. The ladder has a clear wall at Vesper, where the Master AI arrives.

Leaderboard score = points won x opponent level (Rookie 1, Sharp 2, Master 3), so Top scores rewards harder opponents.

### Accessibility
Cards are real `<button>`s with labels ("Q of spades, power 14. Key 3."), `aria-pressed` on the selection, keyboard
play (1-6, arrows, Enter, R rematch, M mute), visible focus rings, a polite live region for round results, suits are
symbols as well as color, motion respects `prefers-reduced-motion`.

### Mobile
Card widths derive from the viewport so six cards fit in one row at 360 px; table slots scale with `vw`; a full-width
48 px Play button sits under the hand; `touch-action: manipulation` removes double-tap zoom delay; inputs are 16 px
(no iOS zoom).

### Performance
Firebase is now a dynamic import, loaded only when Top scores is shown or a score is posted, so the game shell paints
without Firestore. Sounds are synthesized; card backs are CSS gradients.

## 3. Kept intact
- `/api/verify-purchase` and the `session_id` flow from `fix/verify-purchase-2026-10-15`: premium unlocks only after a
  server-verified paid session. No URL flag.
- `$3` and the `__NEW_PAYMENT_LINK_CARDS_3__` placeholder from `price/no-99-2026-10-15` (the staged deploy script
  substitutes it).
- The shared Studios bar and footer (`studios-section.css`, games accent), radius <= 4px, full borders only, no pills.

## 4. Not done / next
- Progress lives in this browser (stated in the Premium modal). Cross-device sync would need accounts.
- Daily Deal scores are local; a per-day board would need a Firestore collection and rules.
- Card art is typographic. A commissioned face set would lift it further.
