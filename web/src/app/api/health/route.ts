export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { isBuildTime } from '@lib/build';
import { listNetworks } from '@lib/docker';

/**
 * Basic liveness probe. We ping Docker to verify the socket is reachable.
 */
export async function GET() {
  if (isBuildTime()) return NextResponse.json({ ok: true, skipped: 'build' });

  try {
    await listNetworks();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'health check failed' }, { status: 500 });
  }
}
