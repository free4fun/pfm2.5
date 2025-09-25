import { NextRequest, NextResponse } from 'next/server';
import { getNetworkInfo, removeNetwork } from '@lib/docker';
import { timeHttp } from '@lib/time';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const end = timeHttp('/api/networks/[id]', 'GET');
  const info = await getNetworkInfo(id);
  end(200);
  return NextResponse.json(info);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const end = timeHttp('/api/networks/[id]', 'DELETE');
  const removeContainers = (new URL(req.url).searchParams.get('removeContainers') ?? 'true') !== 'false';
  try {
    await removeNetwork(id, removeContainers);
    end(200);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    end(500);
    return NextResponse.json({ error: e?.message ?? 'delete failed' }, { status: 500 });
  }
}
