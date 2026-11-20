import { NextResponse } from 'next/server';
import { handleRestore } from '@/lib/entitlement-core';

// POST /api/restore { email }: read-only Stripe check limited to this game's Payment Link; email never stored or logged.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const ip = String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  const r: any = await handleRestore({ env: process.env as any, fetchFn: fetch, body, ip });
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store', ...(r.headers || {}) } });
}
export async function GET() { return NextResponse.json({ restored: false, error: 'method' }, { status: 405, headers: { Allow: 'POST' } }); }
