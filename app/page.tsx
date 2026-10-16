'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  login as authLogin,
  getPlayerName,
  isPremium,
  getDailyTries,
  canPlay,
  setPremium,
  decrementTries,
  DAILY_PLAYS,
} from '@/lib/auth';
import {
  Card, Prize, Level, Rules, LEVELS, RIVALS, STANDARD_RULES, HAND_SIZE, RANK_LABEL, SUIT_NAME,
  isRed, deal, rng, seedFromString, power, prizeWorth, resolve, aiPick, Outcome,
} from '@/lib/engine';
import { sfx, buzz, initSfx, isMuted, setMuted } from '@/lib/sfx';
import { Progress, loadProgress, saveProgress, recordMatch, BACKS } from '@/lib/progress';

interface Score { id: string; playerName: string; score: number }

type Mode = { kind: 'quick'; level: Level } | { kind: 'daily' } | { kind: 'rival'; index: number };
type Phase = 'choose' | 'reveal' | 'result' | 'over';
interface RoundLog { p: Card; o: Card; prize: Prize; outcome: Outcome; stake: number; pp: number; op: number }

const today = () => new Date().toISOString().split('T')[0];
const levelOf = (m: Mode): Level => (m.kind === 'quick' ? m.level : m.kind === 'daily' ? 'sharp' : RIVALS[m.index].level);
const rulesOf = (m: Mode): Rules => (m.kind === 'rival' ? RIVALS[m.index].rules : STANDARD_RULES);
const oppName = (m: Mode) => (m.kind === 'rival' ? RIVALS[m.index].name : m.kind === 'daily' ? 'Daily Deal' : LEVELS.find((l) => l.id === m.level)!.name);
const multOf = (l: Level) => LEVELS.find((x) => x.id === l)!.mult;
const pts = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

const COACH = [
  'The prize is in the middle. Pick a card: the higher power takes its points.',
  'A card that matches the prize suit gets +2 power. The small number on each card is its power for this prize.',
  'Their hand holds the same six ranks as yours. Spend big cards on big prizes, throw small ones away.',
  'A tie sends the prize to the pot. The next round’s winner takes the pot too.',
];

function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function CardFace({ card, prize, rules, small }: { card: Card; prize?: Prize; rules?: Rules; small?: boolean }) {
  const bonus = prize && rules && rules.suitBonus && card.suit === prize.suit ? rules.suitBonus : 0;
  return (
    <span className={`face ${isRed(card.suit) ? 'red' : ''} ${small ? 'sm' : ''}`}>
      <span className="idx">{RANK_LABEL[card.rank]}<br />{card.suit}</span>
      <span className="pip" aria-hidden="true">{card.suit}</span>
      {prize && rules && (
        <span className={`pow ${bonus ? 'boosted' : ''}`} aria-hidden="true">
          {power(card, prize, rules)}{bonus ? <em>+{bonus}</em> : null}
        </span>
      )}
    </span>
  );
}

export default function CardBattle() {
  // --- account / gate (premium verification from fix/verify-purchase is kept as is) ---
  const [playerName, setPlayerName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [dailyTries, setDailyTries] = useState(DAILY_PLAYS);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [muted, setMutedState] = useState(false);

  // --- screens / modals ---
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [showHelp, setShowHelp] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Score[] | null | 'error'>(null);
  const [posted, setPosted] = useState<'idle' | 'posting' | 'done' | 'error'>('idle');
  const [toast, setToast] = useState('');

  // --- match ---
  const [mode, setMode] = useState<Mode>({ kind: 'quick', level: 'rookie' });
  const [pHand, setPHand] = useState<Card[]>([]);
  const [oHand, setOHand] = useState<Card[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [pot, setPot] = useState(0);
  const [pScore, setPScore] = useState(0);
  const [oScore, setOScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [oppPick, setOppPick] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('choose');
  const [played, setPlayed] = useState<{ p: Card; o: Card } | null>(null);
  const [last, setLast] = useState<RoundLog | null>(null);
  const [log, setLog] = useState<RoundLog[]>([]);
  const [message, setMessage] = useState('');
  const [bump, setBump] = useState<'p' | 'o' | null>(null);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const [counted, setCounted] = useState(false);   // this match has used a daily play
  const [tutorial, setTutorial] = useState(false);

  const timers = useRef<number[]>([]);
  const aiRng = useRef<() => number>(Math.random);
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, reducedMotion() ? Math.min(ms, 150) : ms)); };

  const level = levelOf(mode);
  const rules = rulesOf(mode);
  const prize = prizes[roundIndex];
  const premium = isPremiumUser;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      fetch(`/api/verify-purchase?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d && d.premium === true) {
            setPremium(true);
            setIsPremiumUser(true);
            setToast('Premium unlocked in this browser.');
            sfx.unlock();
          }
        })
        .catch(() => {});
    }
    initSfx();
    setMutedState(isMuted());
    setPlayerName(getPlayerName());
    setNameDraft(getPlayerName());
    setDailyTries(getDailyTries());
    setIsPremiumUser(isPremium());
    setProgress(loadProgress());
    return clearTimers;
  }, []);

  // Firebase loads only when the leaderboard is shown or a score is posted (keeps the first load small).
  const loadLeaderboard = useCallback(async () => {
    const { getLeaderboard } = await import('@/lib/firebase');
    const rows = await getLeaderboard();
    setLeaderboard(rows === null ? 'error' : (rows as Score[]));
  }, []);
  useEffect(() => { if (screen === 'title') loadLeaderboard(); }, [screen, loadLeaderboard]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const commitProgress = (n: Progress) => { saveProgress(n); setProgress(n); };

  // ---------- match flow ----------
  const lockOpponent = (m: Mode, mine: Card[], theirs: Card[], prz: Prize[], ri: number, potV: number, ps: number, os: number) => {
    // The opponent decides from public information only; the player's choice is not an input.
    const idx = aiPick(levelOf(m), {
      mine: theirs, theirs: mine, prize: prz[ri], pot: potV, roundIndex: ri,
      prizesLeft: prz.slice(ri + 1), myScore: os, theirScore: ps, rules: rulesOf(m),
    }, aiRng.current);
    setOppPick(idx);
  };

  const startMatch = (m: Mode) => {
    const prog = progress || loadProgress();
    const isTutorial = !prog.tutorialDone;
    if (!premium && !isTutorial && !canPlay()) { setShowPaywall(true); return; }
    clearTimers();
    // The guided match is offered once: leaving it part-way does not make it repeatable.
    if (isTutorial) commitProgress({ ...prog, tutorialDone: true });
    const seeded = m.kind === 'daily';
    const r = seeded ? rng(seedFromString('cards-daily-' + today())) : Math.random;
    aiRng.current = seeded ? rng(seedFromString('cards-daily-ai-' + today())) : Math.random;
    const d = deal(r);
    setMode(m); setPHand(d.player); setOHand(d.opp); setPrizes(d.prizes);
    setRoundIndex(0); setPot(0); setPScore(0); setOScore(0); setSelected(null);
    setPlayed(null); setLast(null); setLog([]); setUnlocked(null); setPosted('idle'); setBump(null);
    setCounted(false); setTutorial(isTutorial); setPhase('choose');
    setMessage(isTutorial ? COACH[0] : 'Pick a card. Your opponent has already locked in.');
    setScreen('game');
    lockOpponent(m, d.player, d.opp, d.prizes, 0, 0, 0, 0);
  };

  const playCard = (forced?: number) => {
    const i = forced ?? selected;
    if (phase !== 'choose' || i === null || oppPick === null || !prize) {
      if (phase === 'choose') setMessage('Pick a card first.');
      return;
    }
    if (!counted && !tutorial && !premium) { decrementTries(); setDailyTries(getDailyTries()); setCounted(true); }
    const oi = oppPick;
    const p = pHand[i]; const o = oHand[oi];
    const res = resolve(p, o, prize, rules);
    const stake = prizeWorth(prize, roundIndex, rules) + pot;
    const entry: RoundLog = { p, o, prize, outcome: res.outcome, stake, pp: res.pp, op: res.op };
    const remainingP = pHand.filter((_, k) => k !== i);
    const remainingO = oHand.filter((_, k) => k !== oi);
    setPlayed({ p, o }); setSelected(null); setPhase('reveal'); setLast(null);
    setPHand(remainingP); setOHand(remainingO);
    sfx.play();

    later(() => sfx.flip(), 380);
    later(() => {
      setLast(entry); setPhase('result');
      const newP = pScore + (res.outcome === 'player' ? stake : 0);
      const newO = oScore + (res.outcome === 'opp' ? stake : 0);
      const newPot = res.outcome === 'tie' ? stake : 0;
      if (res.outcome === 'player') { sfx.win(); buzz(25); setBump('p'); setMessage(`You take ${pts(stake)}.`); }
      else if (res.outcome === 'opp') { sfx.lose(); setBump('o'); setMessage(`${oppName(mode)} takes ${pts(stake)}.`); }
      else { sfx.tie(); setMessage(`Tie at ${res.pp}. ${pts(stake)} to the pot.`); }
      setPScore(newP); setOScore(newO); setPot(newPot);
      setLog((l) => [...l, entry]);
      later(() => setBump(null), 450);

      const next = roundIndex + 1;
      later(() => {
        setPlayed(null); setLast(null);
        if (next >= HAND_SIZE) { finish(newP, newO); return; }
        setRoundIndex(next); setPhase('choose');
        lockOpponent(mode, remainingP, remainingO, prizes, next, newPot, newP, newO);
        setMessage(tutorial && COACH[next] ? COACH[next]
          : newPot ? `Pot of ${newPot}. This round is worth ${newPot + prizeWorth(prizes[next], next, rules)}.`
          : 'Pick your next card.');
      }, 1100);
    }, 760);
  };

  const select = (i: number) => {
    if (phase !== 'choose') return;
    if (selected === i) { playCard(i); return; }   // tap the selected card again to play it
    setSelected(i); sfx.select();
  };

  const finish = (ps: number, os: number) => {
    setPhase('over');
    const result = ps > os ? 'win' : ps < os ? 'loss' : 'tie';
    const score = result === 'win' ? ps * multOf(level) : 0;
    if (result === 'win') { sfx.matchWin(); buzz([30, 60, 30]); } else if (result === 'loss') sfx.matchLose(); else sfx.tie();
    setMessage(result === 'win' ? `You win ${ps} to ${os}.` : result === 'loss' ? `${oppName(mode)} wins ${os} to ${ps}.` : `Draw, ${ps} all.`);
    let n = recordMatch(progress || loadProgress(), level, result, score);
    n.tutorialDone = true;
    if (mode.kind === 'daily') { n.dailyDone = today(); n.dailyBest = Math.max(n.dailyBest, ps); }
    if (mode.kind === 'rival' && result === 'win') {
      const r = RIVALS[mode.index];
      if (!n.ladderBeaten.includes(r.id)) {
        n = { ...n, ladderBeaten: [...n.ladderBeaten, r.id], ladder: Math.max(n.ladder, Math.min(mode.index + 1, RIVALS.length - 1)) };
        setUnlocked(r.back);
        later(() => sfx.unlock(), 700);
      }
    }
    commitProgress(n);
  };

  const postScore = async () => {
    const name = nameDraft.trim().slice(0, 24);
    if (!name) return;
    authLogin(name); setPlayerName(name); setPosted('posting');
    const { saveScore } = await import('@/lib/firebase');
    const ok = await saveScore(name, pScore * multOf(level));
    setPosted(ok ? 'done' : 'error');
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowHelp(false); setShowUpgrade(false); setShowPaywall(false); return; }
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'm' || e.key === 'M') { const m = !isMuted(); setMuted(m); setMutedState(m); return; }
      if (screen !== 'game' || showHelp || showUpgrade || showPaywall) return;
      if (phase === 'choose') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= pHand.length) { e.preventDefault(); select(n - 1); return; }
        if (e.key === 'Enter' && selected !== null) { e.preventDefault(); playCard(); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const d = e.key === 'ArrowRight' ? 1 : -1;
          setSelected((s) => (s === null ? 0 : (s + d + pHand.length) % pHand.length)); sfx.select();
        }
      } else if (phase === 'over' && (e.key === 'r' || e.key === 'R')) startMatch(mode);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleMute = () => { const m = !muted; setMuted(m); setMutedState(m); if (!m) sfx.select(); };
  const prog = progress;
  const back = prog?.back || 'plain';
  const winRate = prog && prog.played ? Math.round((prog.wins / prog.played) * 100) : 0;
  const prizesAhead = useMemo(() => prizes.slice(roundIndex + 1).map((z) => prizeWorth(z, prizes.indexOf(z), rules)).sort((a, b) => b - a), [prizes, roundIndex, rules]);
  const result = phase === 'over' ? (pScore > oScore ? 'win' : pScore < oScore ? 'loss' : 'tie') : null;
  const ladderNext = mode.kind === 'rival' && result === 'win' && mode.index + 1 < RIVALS.length ? mode.index + 1 : null;
  const triesLabel = premium ? 'Premium: no daily limit' : `${dailyTries} of ${DAILY_PLAYS} plays left today`;
  const firstMatch = !!prog && !prog.tutorialDone;
  const defaultLevel: Level = firstMatch ? 'rookie' : mode.kind === 'quick' && (premium || mode.level !== 'master') ? mode.level : 'sharp';

  // ================= TITLE =================
  if (screen === 'title') {
    const lv = (id: Level) => LEVELS.find((l) => l.id === id)!;
    return (
      <main className="cb title-screen">
        <section className="hero">
          <p className="eyebrow">Butts Studios · Games · 02</p>
          <div className="hero-grid">
            <div>
              <h1 className="display">Card Battle<span className="accent">.</span></h1>
              <p className="lede">Six cards each, six prizes on the table. You both choose at once; the higher card takes the points.</p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-big" onClick={() => startMatch({ kind: 'quick', level: defaultLevel })}>
                  {firstMatch ? 'Play the first match' : `Play ${lv(defaultLevel).name}`}
                </button>
                <button className="btn btn-secondary btn-big" onClick={() => setShowHelp(true)}>Rules</button>
              </div>
              <p className="meta">{firstMatch ? 'The first match is guided and does not use a daily play.' : triesLabel}</p>
            </div>
            <div className="hero-cards" aria-hidden="true">
              <span className="card hc hc1"><CardFace card={{ id: 'h1', rank: 13, suit: '♥' }} /></span>
              <span className="hc hc2 prize"><span className="prize-label">Prize</span><span className="prize-value">5</span><span className="prize-suit">♠</span></span>
              <span className="card hc hc3"><CardFace card={{ id: 'h3', rank: 12, suit: '♠' }} /></span>
            </div>
          </div>
          <div className="hero-meta"><span><strong>6</strong> rounds</span><span><strong>~1 min</strong> a match</span><span><strong>3</strong> opponents</span><span><strong>6</strong> rivals</span></div>
        </section>

        <section className="sec">
          <div className="sec-head"><h2>Quick match</h2><p>Pick an opponent. Harder opponents multiply your score.</p></div>
          <div className="plates">
            {LEVELS.map((l, i) => {
              const locked = l.id === 'master' && !premium;
              const rec = prog?.byLevel[l.id];
              return (
                <button key={l.id} className={`plate ${locked ? 'locked' : ''}`}
                  onClick={() => (locked ? setShowUpgrade(true) : startMatch({ kind: 'quick', level: l.id }))}>
                  <span className="plate-no">0{i + 1}{locked ? <span className="lock">Premium</span> : null}</span>
                  <span className="plate-name">{l.name}</span>
                  <span className="plate-kind">{l.blurb}</span>
                  <span className="plate-foot"><span>{rec ? `${rec.wins} of ${rec.played} won` : 'Not played'}</span><span>Score ×{l.mult}</span></span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sec">
          <div className="sec-head"><h2>Daily Deal</h2><p>One seeded deal for every player today, against Sharp.</p></div>
          <div className="daily">
            <span className="daily-date">{today()}</span>
            <span className="daily-best">{prog?.dailyBest ? <>Your best <b>{prog.dailyBest}</b></> : 'Not played yet'}</span>
            <button className="btn btn-secondary btn-big" onClick={() => startMatch({ kind: 'daily' })}>
              {prog?.dailyDone === today() ? 'Play it again' : 'Play today’s deal'}
            </button>
          </div>
        </section>

        <section className="sec">
          <div className="sec-head"><h2>Rival ladder</h2><p>Six rivals, one house rule each. Beat one to face the next and take their card back.{premium ? '' : ' Rival 1 is open to everyone; the rest come with Premium.'}</p></div>
          <ol className="slate">
            {RIVALS.map((r, i) => {
              const beaten = !!prog?.ladderBeaten.includes(r.id);
              const reached = i <= (prog?.ladder ?? 0);
              const open = reached && (premium || i === 0);
              return (
                <li key={r.id}>
                  <button className={`title-row ${beaten ? 'beaten' : ''} ${open ? '' : 'locked'}`}
                    onClick={() => (open ? startMatch({ kind: 'rival', index: i }) : !premium ? setShowUpgrade(true) : setToast(`Beat ${RIVALS[i - 1].name} first.`))}>
                    <span className="no">0{i + 1}</span>
                    <span className="tr-name"><strong>{r.name}</strong><span className="kind">{r.ruleName} · {lv(r.level).name}</span></span>
                    <span className="logline">{r.ruleText}</span>
                    <span className="tr-state">
                      <span className={`back-swatch back-${r.back}`} aria-hidden="true" />
                      <span>{beaten ? 'Beaten' : open ? 'Play' : !premium && i > 0 ? 'Premium' : 'Locked'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {prog && prog.played > 0 && (
          <section className="sec">
            <div className="sec-head"><h2>Your record</h2><p>Kept in this browser.</p></div>
            <div className="stats-grid">
              <div><b>{prog.played}</b><span>Matches</span></div>
              <div><b>{winRate}%</b><span>Won</span></div>
              <div><b>{prog.streak}</b><span>Streak</span></div>
              <div><b>{prog.bestStreak}</b><span>Best streak</span></div>
              <div><b>{prog.bestScore}</b><span>Best score</span></div>
            </div>
            <h3 className="sub-h">Card back</h3>
            <div className="backs">
              {BACKS.map((b) => {
                const earned = b.id === 'plain' || prog.ladderBeaten.some((id) => RIVALS.find((r) => r.id === id)?.back === b.id);
                return (
                  <button key={b.id} disabled={!earned} aria-pressed={back === b.id} title={earned ? b.name : 'Earned on the rival ladder'}
                    className={`back-pick ${back === b.id ? 'on' : ''}`} onClick={() => commitProgress({ ...prog, back: b.id })}>
                    <span className={`back-swatch back-${b.id}`} /><span>{earned ? b.name : 'Locked'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="sec">
          <div className="sec-head"><h2>Top scores</h2><p>Points won × opponent level, posted by players who chose to share a win.</p></div>
          {leaderboard === null ? <p className="meta">Loading…</p> : leaderboard === 'error' ? <p className="meta">Top scores are unavailable right now.</p> : leaderboard.length === 0 ? <p className="meta">No scores posted yet.</p> : (
            <ol className="board">
              {leaderboard.map((e, i) => (<li key={e.id}><span className="no">{String(i + 1).padStart(2, '0')}</span><span>{e.playerName}</span><b>{e.score}</b></li>))}
            </ol>
          )}
        </section>

        <div className="title-foot">
          {!premium ? <button className="btn btn-premium btn-big" onClick={() => setShowUpgrade(true)}>Premium · $3 one-time</button> : <span className="premium-badge">Premium</span>}
          <button className="btn btn-secondary btn-big" onClick={toggleMute} aria-pressed={muted}>{muted ? 'Sound off' : 'Sound on'}</button>
        </div>
        {modals()}
      </main>
    );
  }

  // ================= GAME =================
  const oppHidden = rules.hiddenHand;
  const slotClass = (who: 'p' | 'o') => (!last ? '' : last.outcome === 'tie' ? 'tie' : (last.outcome === 'player') === (who === 'p') ? 'won' : 'lost');
  const lowClubs = rules.lowWinsClubs && prize?.suit === '♣';
  return (
    <main className={`cb game ${phase}`}>
      <div className="hud">
        <button className="icon-btn" onClick={() => { clearTimers(); setScreen('title'); }} aria-label="Back to menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
        <div className={`score opp ${bump === 'o' ? 'bump' : ''}`}><span>{oppName(mode)}</span><b>{oScore}</b></div>
        <div className="rounds" aria-label={`Round ${Math.min(roundIndex + 1, HAND_SIZE)} of ${HAND_SIZE}`}>
          {Array.from({ length: HAND_SIZE }).map((_, i) => {
            const r = log[i];
            return <i key={i} className={r ? (r.outcome === 'player' ? 'w' : r.outcome === 'opp' ? 'l' : 't') : i === roundIndex && phase !== 'over' ? 'now' : ''} />;
          })}
        </div>
        <div className={`score you ${bump === 'p' ? 'bump' : ''}`}><span>You</span><b>{pScore}</b></div>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={muted}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" />{muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}</svg>
        </button>
        <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="Rules">?</button>
      </div>

      {mode.kind === 'rival' && <div className="rule-strip"><b>{RIVALS[mode.index].name} · {RIVALS[mode.index].ruleName}.</b> {RIVALS[mode.index].ruleText}</div>}

      <div className="row opp-hand" aria-label={oppHidden ? 'Opponent hand, face down' : 'Opponent hand'}>
        {oHand.map((c) => (
          <span key={c.id} className={`card small ${oppHidden ? `down back-${back}` : ''}`}
            aria-label={oppHidden ? 'Face-down card' : `${RANK_LABEL[c.rank]} of ${SUIT_NAME[c.suit]}`}>
            {!oppHidden && <CardFace card={c} prize={phase === 'choose' ? prize : undefined} rules={rules} small />}
          </span>
        ))}
      </div>

      <div className="table">
        <div className={`slot opp-slot ${slotClass('o')}`}>
          {played ? (
            <span className={`card flip back-${back}`}>
              <span className="flip-in"><CardFace card={played.o} /></span>
            </span>
          ) : phase === 'choose' ? (
            <span className={`card down back-${back} locked`} role="img" aria-label="Opponent has locked in a card"><span className="lock-tag">Locked</span></span>
          ) : null}
          {last && <span className="pow-tag">{last.op}</span>}
        </div>

        <div key={`pz${roundIndex}`} className={`prize ${prize && isRed(prize.suit) ? 'red' : ''} ${lowClubs ? 'inverted' : ''}`}>
          {prize && phase !== 'over' && (
            <>
              <span className="prize-label">Prize</span>
              <span className="prize-value">{prizeWorth(prize, roundIndex, rules) + pot}</span>
              <span className="prize-suit" aria-label={SUIT_NAME[prize.suit]}>{prize.suit}</span>
              {pot > 0 && <span className="tag">{prizeWorth(prize, roundIndex, rules)} + {pot} pot</span>}
              {lowClubs && <span className="tag">low wins</span>}
              {rules.finalTriple && roundIndex === HAND_SIZE - 1 && <span className="tag">triple</span>}
            </>
          )}
        </div>

        <div className={`slot you-slot ${slotClass('p')}`}>
          {played ? <span className="card fly-in"><CardFace card={played.p} /></span> : <span className="slot-label">You</span>}
          {last && <span className="pow-tag">{last.pp}</span>}
        </div>
      </div>

      <div className="ahead" aria-label="Prizes still to come">
        {phase !== 'over' && prizesAhead.length > 0 ? <>Still to come {prizesAhead.map((v, i) => <b key={i}>{v}</b>)}</> : <>&nbsp;</>}
      </div>

      <p className={`msg ${tutorial && phase === 'choose' ? 'coach' : ''}`} role="status" aria-live="polite">{message}</p>

      <div className="row hand" role="group" aria-label="Your hand">
        {pHand.map((c, i) => (
          <button key={c.id} className={`card ${selected === i ? 'selected' : ''}`} onClick={() => select(i)} disabled={phase !== 'choose'}
            aria-pressed={selected === i}
            aria-label={`${RANK_LABEL[c.rank]} of ${SUIT_NAME[c.suit]}, power ${prize ? power(c, prize, rules) : c.rank}. Key ${i + 1}.`}>
            <CardFace card={c} prize={phase === 'choose' ? prize : undefined} rules={rules} />
          </button>
        ))}
      </div>

      <div className="actions">
        <button className="btn btn-primary btn-big play-btn" onClick={() => playCard()} disabled={phase !== 'choose' || selected === null}>
          {phase !== 'choose' ? 'Revealing…' : selected === null ? 'Pick a card' : `Play ${RANK_LABEL[pHand[selected]?.rank]}${pHand[selected]?.suit ?? ''}`}
        </button>
      </div>
      <p className="hint">Tap a card twice to play it · keys 1–6, arrows, Enter · M mutes</p>

      {phase === 'over' && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
          <div className={`modal over ${result}`}>
            <p className="eyebrow">Match over · {oppName(mode)}{mode.kind === 'rival' ? ` · ${RIVALS[mode.index].ruleName}` : ''}</p>
            <h2 id="over-title" className="over-title">{result === 'win' ? 'You win' : result === 'loss' ? `${oppName(mode)} wins` : 'Draw'}<span className="accent">.</span></h2>
            <p className="final"><b>{pScore}</b><span>to</span><b>{oScore}</b></p>
            <ol className="recap" aria-label="Round by round">
              <li className="head" aria-hidden="true"><span>Prize</span><span>You</span><span>{oppName(mode)}</span><span className="ro">Pts</span></li>
              {log.map((r, i) => (
                <li key={i} className={r.outcome === 'player' ? 'w' : r.outcome === 'opp' ? 'l' : 't'}>
                  <span className="rp">{r.prize.value}{r.prize.suit}</span>
                  <span>{RANK_LABEL[r.p.rank]}{r.p.suit} <small>{r.pp}</small></span>
                  <span>{RANK_LABEL[r.o.rank]}{r.o.suit} <small>{r.op}</small></span>
                  <span className="ro">{r.outcome === 'player' ? `+${r.stake}` : r.outcome === 'opp' ? `−${r.stake}` : 'pot'}</span>
                </li>
              ))}
            </ol>
            {unlocked && (
              <p className="unlock"><span className={`back-swatch back-${unlocked}`} aria-hidden="true" />
                Card back earned: {BACKS.find((b) => b.id === unlocked)?.name}. {ladderNext !== null ? `${RIVALS[ladderNext].name} is next.` : 'Ladder complete.'}</p>
            )}
            {result === 'win' && (
              <div className="post">
                {posted === 'done' ? <p className="meta">Posted as {playerName}: {pScore * multOf(level)}.</p> : (
                  <form onSubmit={(e) => { e.preventDefault(); postScore(); }}>
                    <input aria-label="Name for top scores" placeholder="Name for top scores" maxLength={24} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                    <button className="btn btn-secondary" disabled={posted === 'posting' || !nameDraft.trim()}>Post {pScore * multOf(level)}</button>
                  </form>
                )}
                {posted === 'error' && <p className="meta">Could not post right now.</p>}
              </div>
            )}
            <div className="over-actions">
              {ladderNext !== null && premium ? (
                <button className="btn btn-primary btn-big" onClick={() => startMatch({ kind: 'rival', index: ladderNext })}>Face {RIVALS[ladderNext].name}</button>
              ) : (
                <button className="btn btn-primary btn-big" onClick={() => startMatch(mode.kind === 'daily' ? { kind: 'quick', level: 'sharp' } : mode)}>
                  {mode.kind === 'daily' ? 'Quick match' : 'Rematch'}
                </button>
              )}
              <button className="btn btn-secondary btn-big" onClick={() => setScreen('title')}>Menu</button>
              {result === 'win' && (
                <button className="btn btn-secondary btn-big" onClick={() => {
                  const text = `I beat ${oppName(mode)} ${pScore}–${oScore} at Card Battle. cards.buttsstudios.com`;
                  if (navigator.share) navigator.share({ text }).catch(() => {});
                  else navigator.clipboard?.writeText(text).then(() => setToast('Copied.')).catch(() => {});
                }}>Share</button>
              )}
            </div>
            {ladderNext !== null && !premium && <p className="meta">The rest of the ladder comes with Premium. <button className="linkish" onClick={() => setShowUpgrade(true)}>See Premium</button></p>}
            <p className="meta">{triesLabel}</p>
          </div>
        </div>
      )}
      {modals()}
    </main>
  );

  function modals() {
    return (
      <>
        {toast && <div className="toast" role="status">{toast}</div>}
        {showPaywall && (
          <div className="overlay" onClick={() => setShowPaywall(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onClick={(e) => e.stopPropagation()}>
              <h2 id="pw-title">That was today’s last play</h2>
              <p>Plays reset tomorrow. Premium removes the daily limit.</p>
              <div className="over-actions">
                <button className="btn btn-premium btn-big" onClick={() => { setShowPaywall(false); setShowUpgrade(true); }}>See Premium</button>
                <button className="btn btn-secondary btn-big" onClick={() => setShowPaywall(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
        {showUpgrade && (
          <div className="overlay" onClick={() => setShowUpgrade(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="up-title" onClick={(e) => e.stopPropagation()}>
              <h2 id="up-title">Card Battle Premium</h2>
              <ul className="premium-features">
                <li><b>Unlimited matches</b> instead of {DAILY_PLAYS} a day</li>
                <li><b>Master opponent</b>: simulates the rest of the match before every card</li>
                <li><b>The full rival ladder</b>: five more rivals, each with a house rule that changes how you play</li>
                <li><b>Card backs</b>, one for each rival you beat</li>
              </ul>
              <p className="premium-price">$3 <small>one-time</small></p>
              <p className="meta">Unlocks in this browser once the payment is verified. Progress is saved in this browser.</p>
              <button className="btn btn-premium btn-big" onClick={() => window.open('__NEW_PAYMENT_LINK_CARDS_3__', '_blank')}>
                Unlock Premium
              </button>
            </div>
          </div>
        )}
        {showHelp && (
          <div className="overlay" onClick={() => setShowHelp(false)}>
            <div className="modal rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => e.stopPropagation()}>
              <h2 id="rules-title">How it plays</h2>
              <ol>
                <li>Each round a <b>prize</b> worth 1 to 6 points is turned up.</li>
                <li>You and your opponent each choose one card. The opponent locks in first and never sees your card.</li>
                <li><b>Higher power takes the prize.</b> Power is the rank (2 low, A high), <b>+2</b> when the card matches the prize suit.</li>
                <li>A <b>tie</b> sends the prize to the pot; the next round’s winner takes the pot too.</li>
                <li>Both hands hold the <b>same six ranks</b>, and the opponent’s hand is face up. Six rounds; most points wins.</li>
              </ol>
              <p className="meta">Rivals add one house rule each, shown above the table.</p>
              <button className="btn btn-primary btn-big" onClick={() => setShowHelp(false)}>Got it</button>
            </div>
          </div>
        )}
      </>
    );
  }
}
