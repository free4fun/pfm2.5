import { NextResponse } from 'next/server';
import { getNetworkInfo } from '@lib/docker';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const info = await getNetworkInfo(id);
  return NextResponse.json(info);
}
