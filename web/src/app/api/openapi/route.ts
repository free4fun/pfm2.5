export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getOpenApiDocument } from '@lib/openapi';

export async function GET() {
  const doc = getOpenApiDocument();
  return NextResponse.json(doc);
}
