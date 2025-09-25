import { NextRequest, NextResponse } from 'next/server';
import { getContainerInfo } from '@lib/docker';
import { timeHttp } from '@lib/time';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const end = timeHttp('/api/containers/[id]', 'GET');
  const info = await getContainerInfo(id);
  end(200);
  return NextResponse.json(info);
}
