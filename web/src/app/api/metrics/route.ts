export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { metrics } from '@lib/metrics';

export async function GET() {
  const body = await metrics.registry.metrics();
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': metrics.registry.contentType }
  });
}
