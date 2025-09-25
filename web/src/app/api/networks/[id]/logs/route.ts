import { NextRequest, NextResponse } from 'next/server';
import { listNodes, nodeLogs } from '@lib/docker';

type Ctx = { params: Promise<{ id: string }> };
type NodeInfo = { id: string; name: string };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const nodes = await listNodes(id);
  const items = await Promise.all(nodes.map(async n => ({
    containerId: n.id,
    name: n.name,
    logs: await nodeLogs(n.id, 300),
  })));
  return NextResponse.json(items);
}
