// Server-bound premium entitlement (R1119-HQ4-STUDIOS-46). Same design as the Glowgrid game (glb-game api/_entitlement.js).
// Stateless HMAC-SHA256 token over a small JSON payload bound to a verified paid Stripe Checkout session id. No database, no accounts.
// Env: ENTITLEMENT_SECRET (server only), CARDS_ENFORCE_TOKEN ('1' = enforce), CARDS_LEGACY_GRACE_UNTIL (ISO date, optional),
// STRIPE_READ_KEY + PREMIUM_PAYMENT_LINKS (this game's Payment Link only).
// Threat model (honest): this closes "type the premium flag into localStorage". It does not stop a buyer sharing a token, and
// because the game logic runs in the browser it cannot stop someone patching their own copy of the page.
const crypto = require('crypto');

const TOKEN_DAYS = 3650; // a one-time purchase must not silently expire: effectively lifetime
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const sign = (secret, body) => b64u(crypto.createHmac('sha256', secret).update(body).digest());

function issueToken(secret, sessionId, nowMs, days) {
  if (!secret) return null;
  const iat = Math.floor((nowMs || Date.now()) / 1000);
  const exp = iat + 86400 * (days || TOKEN_DAYS);
  const body = b64u(JSON.stringify({ v: 1, sid: sessionId, iat, exp }));
  return body + '.' + sign(secret, body);
}

// Returns the payload when the signature is valid and not expired, else null.
function verifyToken(secret, token, nowMs) {
  if (!secret || typeof token !== 'string' || token.length > 600) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const want = Buffer.from(sign(secret, parts[0]));
  const got = Buffer.from(parts[1]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let p;
  try { p = JSON.parse(unb64u(parts[0]).toString('utf8')); } catch (e) { return null; }
  if (!p || p.v !== 1 || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(String(p.sid))) return null;
  if (!(p.exp > Math.floor((nowMs || Date.now()) / 1000))) return null;
  return p;
}

// GET /api/entitlement?token=...  ->  { premium, enforce, graceUntil, configured }
function handleEntitlement(env, pfx, token) {
  const secret = env.ENTITLEMENT_SECRET;
  const enforce = env[pfx + '_ENFORCE_TOKEN'] === '1';
  const g = env[pfx + '_LEGACY_GRACE_UNTIL'] || '';
  const graceUntil = g && !isNaN(Date.parse(g)) ? new Date(g).toISOString() : null;
  const p = token && secret ? verifyToken(secret, String(token)) : null;
  return { status: 200, body: { premium: !!p, enforce, graceUntil, configured: !!secret } };
}

// GET /api/verify-purchase?session_id=... : the Stripe session must be complete, paid, and on THIS game's Payment Link.
async function handleVerify(env, fetchFn, id) {
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return { status: 400, body: { premium: false, error: 'bad_session' } };
  const key = env.STRIPE_READ_KEY;
  const allowed = (env.PREMIUM_PAYMENT_LINKS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || allowed.length === 0) return { status: 503, body: { premium: false, error: 'not_configured' } };
  const r = await fetchFn('https://api.stripe.com/v1/checkout/sessions/' + id, { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
  if (!r.ok) return { status: 404, body: { premium: false } };
  const s = await r.json();
  const ok = s.status === 'complete' && s.payment_status === 'paid' && allowed.includes(s.payment_link);
  const out = { premium: ok };
  if (ok) { const t = issueToken(env.ENTITLEMENT_SECRET, id); if (t) out.token = t; }
  return { status: ok ? 200 : 402, body: out };
}

// POST /api/restore { email }: read-only Stripe lookup. Rate limits are in memory per serverless instance (best effort).
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const WIN_MS = 10 * 60 * 1000, MAX_PER_IP = 8, MAX_PER_EMAIL = 5;
const hits = new Map();
function limited(key, max, now) {
  const a = (hits.get(key) || []).filter((t) => now - t < WIN_MS);
  if (a.length >= max) { hits.set(key, a); return true; }
  a.push(now); hits.set(key, a);
  if (hits.size > 5000) { for (const [k, v] of hits) if (!v.some((t) => now - t < WIN_MS)) hits.delete(k); }
  return false;
}
const hashPrefix = (e) => crypto.createHash('sha256').update(e).digest('hex').slice(0, 8);

async function findPaidSession(fetchFn, key, links, email) {
  const variants = Array.from(new Set([email, email.toLowerCase()]));
  for (const em of variants) {
    const u = 'https://api.stripe.com/v1/checkout/sessions?limit=100&customer_details[email]=' + encodeURIComponent(em);
    const r = await fetchFn(u, { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
    if (!r.ok) throw new Error('stripe_' + r.status);
    const j = await r.json();
    const s = ((j && j.data) || []).find((x) => x && x.status === 'complete' && x.payment_status === 'paid' && links.includes(x.payment_link));
    if (s) return s.id;
  }
  return null;
}

async function handleRestore(opts) {
  const { env, fetchFn, body, ip, nowMs, log } = opts;
  const email = body && typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return { status: 400, body: { restored: false, error: 'bad_email' } };
  const now = nowMs || Date.now();
  const h = hashPrefix(email.toLowerCase());
  if (limited('ip:' + ip, MAX_PER_IP, now) || limited('em:' + h, MAX_PER_EMAIL, now)) return { status: 429, headers: { 'Retry-After': '600' }, body: { restored: false, error: 'rate_limited' } };
  const key = env.STRIPE_READ_KEY, secret = env.ENTITLEMENT_SECRET;
  const links = (env.PREMIUM_PAYMENT_LINKS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || !secret || links.length === 0) return { status: 503, body: { restored: false, error: 'unavailable' } };
  try {
    const sid = await findPaidSession(fetchFn, key, links, email);
    if (!sid) { (log || console.log)('restore none ' + h); return { status: 200, body: { restored: false } }; }
    const token = issueToken(secret, sid, now);
    if (!token) return { status: 503, body: { restored: false, error: 'unavailable' } };
    (log || console.log)('restore ok ' + h);
    return { status: 200, body: { restored: true, token } };
  } catch (e) {
    (log || console.log)('restore error ' + h);
    return { status: 502, body: { restored: false, error: 'unavailable' } };
  }
}

module.exports = { issueToken, verifyToken, handleEntitlement, handleVerify, handleRestore, TOKEN_DAYS, _hits: hits };
