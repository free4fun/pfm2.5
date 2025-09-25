export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ethGetBlockByHash } from '../../../../lib/rpc';

type Ctx = { params: Promise<{ hash: string }> };

/**
 * Fetch a specific block directly from the configured RPC endpoint.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { hash } = await ctx.params;
  const b = await ethGetBlockByHash(hash, true);
  return NextResponse.json(b ?? null);
}
