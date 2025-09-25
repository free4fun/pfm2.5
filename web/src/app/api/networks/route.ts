import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listNetworks, createNetwork } from '@lib/docker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateNetworkSchema = z.object({
  name: z.string().min(1),
  subnet: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/),
  labels: z.record(z.string()).optional(),
});

export async function GET() {
  const nets = await listNetworks();
  return NextResponse.json(nets);
}

export async function POST(req: NextRequest) {
  const data = CreateNetworkSchema.parse(await req.json());
  const id = await createNetwork(data);
  return NextResponse.json({ id }, { status: 201 });
}
