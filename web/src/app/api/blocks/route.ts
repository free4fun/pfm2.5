export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ethBlockNumber, ethGetBlockByNumber } from '../../../lib/rpc';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get('number');
  const full = searchParams.get('full') === 'true';

  if (num) {
    const n = num.startsWith('0x') ? parseInt(num, 16) : parseInt(num, 10);
    const b = await ethGetBlockByNumber(n, full);
    return NextResponse.json(b ?? null);
  }
  const latest = await ethBlockNumber();
  const b = await ethGetBlockByNumber(latest, full);
  return NextResponse.json(b ?? null);
}
