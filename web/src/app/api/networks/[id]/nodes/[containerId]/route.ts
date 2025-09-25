export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { isBuildTime } from '@lib/build';
import { metrics } from '@lib/metrics';
import { removeContainer } from '@lib/docker';

type Ctx = { params: Promise<{ id: string; containerId: string }> };

/**
 * Delete a single container from a managed network.
 * The handler is kept minimal so it can run inside serverless environments.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  if (isBuildTime()) return NextResponse.json({ ok: true, skipped: 'build' });

  const { containerId } = await ctx.params;
  await removeContainer(containerId, true);
  metrics.nodeOps.inc({ op: 'remove', role: 'any' });

  return NextResponse.json({ ok: true });
}
