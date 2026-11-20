import { NextResponse } from 'next/server';
import { handleVerify } from '@/lib/entitlement-core';

// Server-side check that a Stripe Checkout session (from this game's Payment Link redirect) was paid; issues the signed token.
// Env: STRIPE_READ_KEY (restricted, Checkout Sessions read), PREMIUM_PAYMENT_LINKS (this game's plink_ id), ENTITLEMENT_SECRET.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('session_id') || '';
  const r = await handleVerify(process.env as any, fetch, id);
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
