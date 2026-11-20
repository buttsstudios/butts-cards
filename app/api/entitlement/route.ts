import { NextResponse } from 'next/server';
import { handleEntitlement } from '@/lib/entitlement-core';

// GET /api/entitlement?token=...  ->  { premium, enforce, graceUntil, configured }  (R1119-HQ4-STUDIOS-46)
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') || '';
  const r = handleEntitlement(process.env as any, 'CARDS', token);
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
