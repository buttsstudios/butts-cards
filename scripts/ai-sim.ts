// Headless AI check: plays opponent levels against each other and against a random player.
// Run: npx tsx scripts/ai-sim.ts   (prints win rates; used for DESIGN.md difficulty numbers)
import { deal, aiPick, resolve, prizeWorth, Level, Rules, STANDARD_RULES, RIVALS, HAND_SIZE, Card, Prize } from '../lib/engine';

type Pol = Level | 'random';
function match(a: Pol, b: Pol, rules: Rules): number {
  const d = deal(Math.random);
  let A: Card[] = d.player, B: Card[] = d.opp; let sa = 0, sb = 0, pot = 0;
  for (let r = 0; r < HAND_SIZE; r++) {
    const prize: Prize = d.prizes[r]; const left = d.prizes.slice(r + 1);
    const ia = a === 'random' ? Math.floor(Math.random() * A.length) : aiPick(a, { mine: A, theirs: B, prize, pot, roundIndex: r, prizesLeft: left, myScore: sa, theirScore: sb, rules });
    const ib = b === 'random' ? Math.floor(Math.random() * B.length) : aiPick(b, { mine: B, theirs: A, prize, pot, roundIndex: r, prizesLeft: left, myScore: sb, theirScore: sa, rules });
    const res = resolve(A[ia], B[ib], prize, rules); const stake = prizeWorth(prize, r, rules) + pot;
    if (res.outcome === 'player') { sa += stake; pot = 0; } else if (res.outcome === 'opp') { sb += stake; pot = 0; } else pot = stake;
    A = A.filter((_, k) => k !== ia); B = B.filter((_, k) => k !== ib);
  }
  return Math.sign(sa - sb);
}
const N = Number(process.argv[2] || 400);
const pairs: [Pol, Pol][] = [['rookie', 'random'], ['sharp', 'random'], ['master', 'random'], ['sharp', 'rookie'], ['master', 'rookie'], ['master', 'sharp']];
for (const [a, b] of pairs) {
  let w = 0, l = 0, t = 0;
  for (let i = 0; i < N; i++) { const s = match(a, b, STANDARD_RULES); if (s > 0) w++; else if (s < 0) l++; else t++; }
  console.log(`${a.padEnd(7)} vs ${b.padEnd(7)}  win ${(100 * w / N).toFixed(0)}%  loss ${(100 * l / N).toFixed(0)}%  draw ${(100 * t / N).toFixed(0)}%`);
}
for (const rv of RIVALS) {
  let w = 0, l = 0;
  for (let i = 0; i < N / 2; i++) { const s = match(rv.level, 'sharp', rv.rules); if (s > 0) w++; else if (s < 0) l++; }
  console.log(`rival ${rv.name.padEnd(9)} (${rv.level}) vs sharp-player  rival wins ${(200 * w / N).toFixed(0)}%  loses ${(200 * l / N).toFixed(0)}%`);
}
