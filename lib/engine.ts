// Card Battle engine: pure game logic + opponent AI. No DOM, no React.
//
// The game (see DESIGN.md): a prize card is turned up each round. Both sides pick one card from their hand at the
// same time; the higher power takes the prize's points. A card that matches the prize's suit gets +2 power. A tie
// sends the prize into a pot that the next round's winner also takes. Both hands hold the same six ranks (fair deal),
// and the opponent's hand is face up unless a house rule hides it. Six rounds, most points wins.
//
// Honesty: the opponent picks its card at the start of the round from public information only (its hand, your hand,
// the prize, the pot, the prizes still to come). It never reads the card you choose.

export type Suit = '♠' | '♥' | '♦' | '♣';
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export const SUIT_NAME: Record<Suit, string> = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
export const isRed = (s: Suit) => s === '♥' || s === '♦';

export interface Card { id: string; rank: number; suit: Suit }
export interface Prize { id: string; value: number; suit: Suit }

export type Level = 'rookie' | 'sharp' | 'master';
export const LEVELS: { id: Level; name: string; blurb: string; mult: number }[] = [
  { id: 'rookie', name: 'Rookie', blurb: 'Plays loose. Good for learning the rules.', mult: 1 },
  { id: 'sharp', name: 'Sharp', blurb: 'Reads the prize, dumps low cards on small prizes.', mult: 2 },
  { id: 'master', name: 'Master', blurb: 'Simulates the rest of the match before every card.', mult: 3 },
];

export interface Rules {
  suitBonus: number;       // power added when a card matches the prize suit (0 = off)
  hiddenHand: boolean;     // opponent hand face down for the player
  lowWinsClubs: boolean;   // on a ♣ prize, the LOWER power wins
  finalTriple: boolean;    // the last round's prize is worth triple
}
export const STANDARD_RULES: Rules = { suitBonus: 2, hiddenHand: false, lowWinsClubs: false, finalTriple: false };

export const HAND_SIZE = 6;
export const PRIZE_VALUES = [1, 2, 3, 4, 5, 6];

// ---------- seeded RNG (mulberry32), so the Daily Deal is the same for everyone on a date ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface Deal { player: Card[]; opp: Card[]; prizes: Prize[] }

/** Mirror deal: six distinct ranks, both hands get the same ranks with independent suits. */
export function deal(r: () => number): Deal {
  const ranks = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], r).slice(0, HAND_SIZE).sort((a, b) => a - b);
  const suit = () => SUITS[Math.floor(r() * 4)];
  const player = ranks.map((rank, i) => ({ id: `p${i}`, rank, suit: suit() }));
  const opp = ranks.map((rank, i) => ({ id: `o${i}`, rank, suit: suit() }));
  const prizes = shuffle(PRIZE_VALUES, r).map((value, i) => ({ id: `z${i}`, value, suit: suit() }));
  return { player, opp, prizes };
}

export function power(card: Card, prize: Prize, rules: Rules): number {
  return card.rank + (rules.suitBonus && card.suit === prize.suit ? rules.suitBonus : 0);
}

export function prizeWorth(prize: Prize, roundIndex: number, rules: Rules): number {
  return rules.finalTriple && roundIndex === HAND_SIZE - 1 ? prize.value * 3 : prize.value;
}

export type Outcome = 'player' | 'opp' | 'tie';
export function resolve(p: Card, o: Card, prize: Prize, rules: Rules): { outcome: Outcome; pp: number; op: number } {
  const pp = power(p, prize, rules);
  const op = power(o, prize, rules);
  if (pp === op) return { outcome: 'tie', pp, op };
  const lowWins = rules.lowWinsClubs && prize.suit === '♣';
  const playerWins = lowWins ? pp < op : pp > op;
  return { outcome: playerWins ? 'player' : 'opp', pp, op };
}

// ---------- AI ----------
export interface View {
  mine: Card[];            // the deciding side's hand
  theirs: Card[];          // the other side's hand (public)
  prize: Prize;
  pot: number;             // points carried from ties
  roundIndex: number;      // 0-based
  prizesLeft: Prize[];     // prizes not yet turned up (after this one); suit/order unknown to a fair player
  myScore: number;
  theirScore: number;
  rules: Rules;
}

const lowWinsFor = (v: View) => v.rules.lowWinsClubs && v.prize.suit === '♣';

/** Sharp heuristic: fight for prizes worth fighting for, with the cheapest card that does it; dump otherwise. */
function sharpPick(v: View, r: () => number, noise = 0.12): number {
  const stake = prizeWorth(v.prize, v.roundIndex, v.rules) + v.pot;
  const remainingVals = [stake, ...v.prizesLeft.map((z) => z.value)].sort((a, b) => b - a);
  const rankOfStake = remainingVals.indexOf(stake) / Math.max(1, remainingVals.length - 1); // 0 = biggest left
  const low = lowWinsFor(v);
  const eff = v.mine.map((c, i) => ({ i, p: power(c, v.prize, v.rules) }));
  const theirEff = v.theirs.map((c) => power(c, v.prize, v.rules));
  const theirBest = low ? Math.min(...theirEff) : Math.max(...theirEff);
  const beats = (p: number) => (low ? p < theirBest : p > theirBest);
  const order = eff.slice().sort((a, b) => (low ? b.p - a.p : a.p - b.p)); // weakest-for-this-prize first
  if (r() < noise) return eff[Math.floor(r() * eff.length)].i;
  if (rankOfStake <= 0.34) {
    const sure = order.filter((e) => beats(e.p));
    if (sure.length) return sure[0].i;              // cheapest guaranteed win
    return order[order.length - 1].i;               // strongest available, hope for a dodge
  }
  if (rankOfStake >= 0.67) return order[0].i;       // throw the weakest card on a small prize
  // middle prizes: play the median-strength card
  return order[Math.floor(order.length / 2)].i;
}

function rookiePick(v: View, r: () => number): number {
  if (r() < 0.55) return Math.floor(r() * v.mine.length);
  return sharpPick(v, r, 0.3);
}

/** Master: Monte Carlo over the rest of the match. The other side is modelled as a noisy Sharp player. */
function masterPick(v: View, r: () => number, sims = 160): number {
  if (v.mine.length === 1) return 0;
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i < v.mine.length; i++) {
    let total = 0;
    for (let s = 0; s < sims; s++) total += rollout(v, i, r);
    const avg = total / sims;
    if (avg > bestScore) { bestScore = avg; best = i; }
  }
  return best;
}

/** One simulated finish of the match after `mine[i]` is played; returns (my - their) final margin, with a win bonus. */
function rollout(v: View, i: number, r: () => number): number {
  let mine = v.mine.slice(), theirs = v.theirs.slice();
  let my = v.myScore, th = v.theirScore, pot = v.pot;
  let prize = v.prize, roundIndex = v.roundIndex;
  let left = shuffle(v.prizesLeft, r).map((z) => ({ ...z, suit: SUITS[Math.floor(r() * 4)] as Suit }));
  let myIdx = i;
  for (;;) {
    const theirView: View = { mine: theirs, theirs: mine, prize, pot, roundIndex, prizesLeft: left, myScore: th, theirScore: my, rules: v.rules };
    const thIdx = r() < 0.25 ? Math.floor(r() * theirs.length) : sharpPick(theirView, r, 0.15);
    const res = resolve(mine[myIdx], theirs[thIdx], prize, v.rules);
    const stake = prizeWorth(prize, roundIndex, v.rules) + pot;
    if (res.outcome === 'player') { my += stake; pot = 0; } else if (res.outcome === 'opp') { th += stake; pot = 0; } else pot = stake;
    mine = mine.filter((_, k) => k !== myIdx);
    theirs = theirs.filter((_, k) => k !== thIdx);
    if (!mine.length || !left.length) break;
    prize = left[0]; left = left.slice(1); roundIndex++;
    const myView: View = { mine, theirs, prize, pot, roundIndex, prizesLeft: left, myScore: my, theirScore: th, rules: v.rules };
    myIdx = sharpPick(myView, r, 0.1);
  }
  const margin = my - th;
  return margin + (margin > 0 ? 6 : margin < 0 ? -6 : 0);
}

export function aiPick(level: Level, v: View, r: () => number = Math.random): number {
  if (level === 'rookie') return rookiePick(v, r);
  if (level === 'sharp') return sharpPick(v, r);
  return masterPick(v, r);
}

// ---------- Rivals (the ladder) ----------
export interface Rival {
  id: string; name: string; level: Level; rules: Rules; ruleName: string; ruleText: string; back: string;
}
export const RIVALS: Rival[] = [
  { id: 'dot', name: 'Dot', level: 'rookie', rules: STANDARD_RULES, ruleName: 'House rules',
    ruleText: 'Standard match. Learn the table.', back: 'grid' },
  { id: 'pike', name: 'Pike', level: 'sharp', rules: { ...STANDARD_RULES, finalTriple: true }, ruleName: 'Last call',
    ruleText: 'The sixth prize is worth triple. Save something.', back: 'stripe' },
  { id: 'marrow', name: 'Marrow', level: 'sharp', rules: { ...STANDARD_RULES, hiddenHand: true }, ruleName: 'Closed hand',
    ruleText: "Marrow's hand stays face down. Count the ranks: they mirror yours.", back: 'dots' },
  { id: 'vesper', name: 'Vesper', level: 'master', rules: { ...STANDARD_RULES, lowWinsClubs: true }, ruleName: 'Low clubs',
    ruleText: 'On a ♣ prize, the lower power wins.', back: 'chevron' },
  { id: 'hollis', name: 'Hollis', level: 'master', rules: { ...STANDARD_RULES, suitBonus: 4 }, ruleName: 'Heavy suits',
    ruleText: 'Matching the prize suit adds +4, not +2.', back: 'cross' },
  { id: 'house', name: 'The House', level: 'master',
    rules: { suitBonus: 2, hiddenHand: true, lowWinsClubs: true, finalTriple: true }, ruleName: 'Everything',
    ruleText: 'Closed hand, low clubs and a triple last prize, all at once.', back: 'gold' },
];
