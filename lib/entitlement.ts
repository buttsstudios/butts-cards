// Server-bound premium (R1119-HQ4-STUDIOS-46). The signed token from /api/verify-purchase (or /api/restore) is the unlock;
// the old premium localStorage flag is only a legacy marker that the server may honour during a grace window.
import { decide } from './entitlement-client';

export const TOKEN_KEY = 'butts_cards_entitlement';
const LEGACY_KEY = 'butts_cards_premium';
const BASE = '/games/cards';

let verified: boolean | null = null; // null = not yet checked this page load

function ls(): Storage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export function getToken(): string { const s = ls(); try { return (s && s.getItem(TOKEN_KEY)) || ''; } catch { return ''; } }
export function storeToken(t: string): void { const s = ls(); try { if (s) s.setItem(TOKEN_KEY, t); } catch { /* ignore */ } verified = true; }
export function legacyFlag(): boolean { const s = ls(); try { return !!s && s.getItem(LEGACY_KEY) === 'true'; } catch { return false; } }

// Synchronous gate. Until the server answers, a stored token counts (so a real buyer never sees a locked flash); the bare
// legacy flag does not. After the server answers, its decision wins.
export function premiumNow(): boolean {
  if (verified !== null) return verified;
  return !!getToken();
}

// Asks the server once per page load. Never throws; any failure keeps a token holder unlocked (fail open).
export async function verifyEntitlement(): Promise<boolean> {
  const tok = getToken();
  const flag = legacyFlag();
  if (!tok && !flag) { verified = false; return false; }
  let resp: any = null;
  try {
    const r = await fetch(BASE + '/api/entitlement?token=' + encodeURIComponent(tok), { cache: 'no-store' });
    if (r.ok) resp = await r.json();
  } catch { resp = null; }
  verified = decide(resp, !!tok, flag, Date.now());
  return verified;
}

export type RestoreResult = 'restored' | 'none' | 'error' | 'bad';
export async function restorePurchase(email: string): Promise<RestoreResult> {
  const em = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return 'bad';
  try {
    const r = await fetch(BASE + '/api/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) });
    const d: any = await r.json().catch(() => null);
    if (r.status === 400) return 'bad';
    if (d && d.restored === true && typeof d.token === 'string' && d.token) { storeToken(d.token); return 'restored'; }
    if (d && d.restored === false && r.status === 200) return 'none';
    return 'error';
  } catch { return 'error'; }
}
