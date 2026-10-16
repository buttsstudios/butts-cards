// Tiny synthesized sound set (WebAudio, no audio files to download). Muted state is remembered in this browser.
let ctx: AudioContext | null = null;
let muted = false;
const KEY = 'butts_cards_muted';

export function initSfx() {
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked */ }
}
export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* storage blocked */ }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0, slideTo?: number) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.05, delay = 0, hp = 1200) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}

export const sfx = {
  select: () => tone(660, 0.06, 'triangle', 0.05),
  play: () => noise(0.12, 0.06, 0, 900),
  flip: () => { noise(0.05, 0.05, 0, 2400); tone(420, 0.05, 'square', 0.02, 0.02); },
  win: () => { tone(523, 0.12, 'triangle', 0.07); tone(784, 0.18, 'triangle', 0.07, 0.09); },
  lose: () => tone(220, 0.22, 'sine', 0.08, 0, 140),
  tie: () => { tone(440, 0.08, 'square', 0.03); tone(440, 0.08, 'square', 0.03, 0.12); },
  matchWin: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.1)),
  matchLose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.26, 'sine', 0.07, i * 0.14)),
  unlock: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.08)),
};

export function buzz(pattern: number | number[]) {
  if (muted) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
