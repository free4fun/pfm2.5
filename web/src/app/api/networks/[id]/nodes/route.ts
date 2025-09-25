import { NextRequest, NextResponse } from 'next/server';
import { listNodes, addNode, removeContainer } from '@lib/docker';
import { AddNodeBodySchema } from '@lib/validators';

type Ctx = { params: Promise<{ id: string }> };

const Body = AddNodeBodySchema;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const items = await listNodes(id);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const ports = body.rpcPort ? { '8545/tcp': body.rpcPort } : undefined;
  const cid = await addNode({
    networkName: id,
    name: body.name,
    image: body.image,
    role: body.role,
    ip: body.ip,
    ports,
    env: body.env,
    cmd: body.cmd,
    binds: body.binds,
  });
  return NextResponse.json({ id: cid }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params; void id;
  const qs = new URL(req.url).searchParams;
  const containerId = qs.get('containerId') || qs.get('nameOrId');
  if (!containerId) return NextResponse.json({ error: 'containerId required' }, { status: 400 });
  await removeContainer(containerId, true);
  return NextResponse.json({ ok: true });
}
