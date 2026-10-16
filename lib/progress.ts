// Local progress: stats, ladder, card backs, tutorial flag. Stored in this browser only.
const KEY = 'butts_cards_progress_v1';

export interface Progress {
  played: number; wins: number; losses: number; ties: number;
  streak: number; bestStreak: number; bestScore: number;
  byLevel: Record<string, { played: number; wins: number }>;
  ladder: number;          // index of the highest rival unlocked (0 = only the first)
  ladderBeaten: string[];  // rival ids beaten
  back: string;            // selected card back
  tutorialDone: boolean;
  dailyDone: string;       // date of the last Daily Deal finished
  dailyBest: number;
}

const blank = (): Progress => ({
  played: 0, wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0, bestScore: 0,
  byLevel: {}, ladder: 0, ladderBeaten: [], back: 'plain', tutorialDone: false, dailyDone: '', dailyBest: 0,
});

export function loadProgress(): Progress {
  if (typeof window === 'undefined') return blank();
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
export function saveProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

export function recordMatch(p: Progress, level: string, result: 'win' | 'loss' | 'tie', score: number): Progress {
  const n = { ...p, byLevel: { ...p.byLevel } };
  n.played++;
  if (result === 'win') { n.wins++; n.streak++; } else { n.streak = 0; }
  if (result === 'loss') n.losses++;
  if (result === 'tie') n.ties++;
  n.bestStreak = Math.max(n.bestStreak, n.streak);
  n.bestScore = Math.max(n.bestScore, score);
  const b = n.byLevel[level] || { played: 0, wins: 0 };
  n.byLevel[level] = { played: b.played + 1, wins: b.wins + (result === 'win' ? 1 : 0) };
  return n;
}

export const BACKS: { id: string; name: string }[] = [
  { id: 'plain', name: 'Studio' },
  { id: 'grid', name: 'Grid' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'dots', name: 'Dots' },
  { id: 'chevron', name: 'Chevron' },
  { id: 'cross', name: 'Cross' },
  { id: 'gold', name: 'Gold' },
];
