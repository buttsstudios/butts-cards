// Run: node --test tests/   (Node 18+; no dependencies). Stripe is mocked: no network, no purchase.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const core = require('../lib/entitlement-core');
const { decide } = require('../lib/entitlement-client');
const PFX = 'CARDS';
const SECRET = 's3cret-s3cret-s3cret-s3cret-123456';
const SID = 'cs_live_a1B2c3D4';
const ENV = { ENTITLEMENT_SECRET: SECRET, STRIPE_READ_KEY: 'rk_test_x', PREMIUM_PAYMENT_LINKS: 'plink_mine' };

test('token round trip, tamper, expiry, wrong secret, junk', () => {
  const t = core.issueToken(SECRET, SID);
  assert.strictEqual(core.verifyToken(SECRET, t).sid, SID);
  assert.strictEqual(core.verifyToken('other-secret-other-secret-other-1', t), null);
  const [b, s] = t.split('.');
  assert.strictEqual(core.verifyToken(SECRET, b + '.' + s.slice(0, -2) + 'AA'), null);
  const forged = Buffer.from(JSON.stringify({ v: 1, sid: SID, iat: 1, exp: 9999999999 })).toString('base64url') + '.' + s;
  assert.strictEqual(core.verifyToken(SECRET, forged), null);
  assert.strictEqual(core.verifyToken(SECRET, core.issueToken(SECRET, SID, Date.now() - 4000 * 86400000)), null);
  for (const j of ['', 'abc', 'a.b.c', 'x'.repeat(700)]) assert.strictEqual(core.verifyToken(SECRET, j), null);
  assert.strictEqual(core.issueToken('', SID), null);
});

test('entitlement endpoint: valid, forged, none, config flags', () => {
  const t = core.issueToken(SECRET, SID);
  assert.strictEqual(core.handleEntitlement(ENV, PFX, t).body.premium, true);
  assert.strictEqual(core.handleEntitlement(ENV, PFX, t + 'x').body.premium, false);
  assert.strictEqual(core.handleEntitlement(ENV, PFX, '').body.premium, false);
  const r = core.handleEntitlement({ ...ENV, [PFX + '_ENFORCE_TOKEN']: '1', [PFX + '_LEGACY_GRACE_UNTIL']: '2027-06-30' }, PFX, '');
  assert.strictEqual(r.body.enforce, true); assert.strictEqual(r.body.graceUntil, '2027-06-30T00:00:00.000Z');
  const off = core.handleEntitlement(ENV, PFX, '').body;
  assert.strictEqual(off.enforce, false); assert.strictEqual(off.graceUntil, null);
  assert.strictEqual(core.handleEntitlement({}, PFX, t).body.configured, false); // missing secret is reported, never "invalid"
});

const mk = (obj, status = 200) => async () => ({ ok: status < 400, status, json: async () => obj });
test('verify-purchase: paid on this link only, issues token', async () => {
  const good = { status: 'complete', payment_status: 'paid', payment_link: 'plink_mine' };
  let r = await core.handleVerify(ENV, mk(good), SID);
  assert.strictEqual(r.status, 200); assert.ok(core.verifyToken(SECRET, r.body.token));
  r = await core.handleVerify(ENV, mk({ ...good, payment_link: 'plink_other' }), SID); assert.strictEqual(r.status, 402); assert.ok(!r.body.token);
  r = await core.handleVerify(ENV, mk({ ...good, payment_status: 'unpaid' }), SID); assert.strictEqual(r.status, 402);
  r = await core.handleVerify(ENV, mk({}, 404), SID); assert.strictEqual(r.status, 404);
  r = await core.handleVerify(ENV, mk(good), 'nope'); assert.strictEqual(r.status, 400);
});

test('restore: paid on this link -> token; other link / unpaid -> none; bad email 400; errors 502; no email in logs', async () => {
  const logs = [];
  const base = (email, list, ip) => ({ env: ENV, fetchFn: mk({ data: list }), body: { email }, ip: ip || '9.9.9.1', log: (m) => logs.push(m) });
  const paid = { id: SID, status: 'complete', payment_status: 'paid', payment_link: 'plink_mine' };
  let r = await core.handleRestore(base('Buyer@Example.com', [paid]));
  assert.strictEqual(r.body.restored, true); assert.ok(core.verifyToken(SECRET, r.body.token));
  r = await core.handleRestore(base('a@b.co', [{ ...paid, payment_link: 'plink_other' }], '9.9.9.2')); assert.strictEqual(r.body.restored, false);
  r = await core.handleRestore(base('a2@b.co', [{ ...paid, payment_status: 'unpaid' }], '9.9.9.3')); assert.strictEqual(r.body.restored, false);
  r = await core.handleRestore(base('not-an-email', [], '9.9.9.4')); assert.strictEqual(r.status, 400);
  r = await core.handleRestore({ ...base('c@d.co', [], '9.9.9.5'), fetchFn: mk({}, 500) }); assert.strictEqual(r.status, 502);
  r = await core.handleRestore({ ...base('c3@d.co', [], '9.9.9.6'), env: {} }); assert.strictEqual(r.status, 503);
  assert.ok(logs.length >= 3 && !logs.some((l) => /@|example|buyer/i.test(l)), 'email never logged');
});

test('restore: rate limited per ip', async () => {
  let last;
  for (let i = 0; i < 10; i++) last = await core.handleRestore({ env: ENV, fetchFn: mk({ data: [] }), body: { email: 'rl' + i + '@x.co' }, ip: '7.7.7.7', log() {} });
  assert.strictEqual(last.status, 429); assert.strictEqual(last.headers['Retry-After'], '600');
});

test('client decision matrix: fail open for token holders, legacy flag per enforcement/grace', () => {
  const now = Date.parse('2026-12-01');
  assert.strictEqual(decide(null, true, false, now), true);            // endpoint blocked/failed + token: stay unlocked
  assert.strictEqual(decide(null, false, true, now), false);           // endpoint blocked + bare flag: locked
  assert.strictEqual(decide(null, false, false, now), false);          // fresh browser
  assert.strictEqual(decide('junk', true, false, now), true);          // malformed response
  assert.strictEqual(decide({ configured: false, enforce: true }, true, false, now), true); // server missing secret: never revoke
  assert.strictEqual(decide({ premium: true, enforce: true }, true, false, now), true);
  assert.strictEqual(decide({ premium: false, enforce: true, graceUntil: null }, true, false, now), false); // forged token, enforced
  assert.strictEqual(decide({ premium: false, enforce: true, graceUntil: null }, false, true, now), false); // bare flag, no grace
  assert.strictEqual(decide({ premium: false, enforce: true, graceUntil: '2027-06-30T00:00:00Z' }, false, true, now), true);  // grace
  assert.strictEqual(decide({ premium: false, enforce: true, graceUntil: '2026-11-30T00:00:00Z' }, false, true, now), false); // grace over
  assert.strictEqual(decide({ premium: false, enforce: false }, false, true, now), true);   // enforcement off = legacy behaviour
  assert.strictEqual(decide({ premium: false, enforce: false }, false, false, now), false);
});

test('source: gate no longer reads the legacy localStorage flag; token is verified via the server', () => {
  const root = path.join(__dirname, '..');
  const gate = fs.readFileSync(path.join(root, 'lib', 'auth.ts'), 'utf8');
  assert.doesNotMatch(gate, /getItem\(STORAGE_KEYS\.IS_PREMIUM\)/);
  assert.match(gate, /premiumNow\(\)/);
  const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
  assert.match(page, /verifyEntitlement\(\)/); assert.match(page, /storeToken\(d\.token\)/);
});
