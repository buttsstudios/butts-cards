import { NextResponse } from 'next/server';

// Server-side check that a Stripe Checkout session (from a Payment Link redirect) was paid.
// Replaces the old `?premium=true` URL flag, which unlocked premium without paying.
// Env (Vercel): STRIPE_READ_KEY = restricted key with Checkout Sessions read only;
//               PREMIUM_PAYMENT_LINKS = comma list of plink_ ids that grant premium here.
// Stripe Payment Link "after payment" redirect must be: https://<host>/?session_id={CHECKOUT_SESSION_ID}
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) {
    return NextResponse.json({ premium: false, error: 'bad_session' }, { status: 400 });
  }
  const key = process.env.STRIPE_READ_KEY;
  const allowed = (process.env.PREMIUM_PAYMENT_LINKS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!key || allowed.length === 0) {
    return NextResponse.json({ premium: false, error: 'not_configured' }, { status: 503 });
  }
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!r.ok) return NextResponse.json({ premium: false }, { status: 404 });
  const s = await r.json();
  const ok = s.status === 'complete' && s.payment_status === 'paid' && allowed.includes(s.payment_link);
  return NextResponse.json({ premium: ok }, { status: ok ? 200 : 402 });
}
