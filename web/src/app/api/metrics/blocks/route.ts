export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import client from 'prom-client';
import { ethBlockNumber, ethGetBlockByNumber } from '../../../../lib/rpc';

const reg = new client.Registry();
const gLatest = new client.Gauge({ name: 'besu_latest_block', help: 'Latest block height' });
const gTPS = new client.Gauge({ name: 'besu_tps_ema60', help: 'TPS EMA approximation (60s window)' });
const gTx = new client.Gauge({ name: 'besu_last_block_tx', help: 'Transactions in last block' });
reg.registerMetric(gLatest); reg.registerMetric(gTPS); reg.registerMetric(gTx);
client.collectDefaultMetrics({ register: reg });

export async function GET() {
  try {
    const latest = await ethBlockNumber();
    gLatest.set(latest);

    const N = 20;
    const first = Math.max(0, latest - N + 1);
    const blocks = await Promise.all(
      Array.from({ length: latest - first + 1 }, (_, i) => ethGetBlockByNumber(first + i, false))
    );

    const pairs = blocks
      .map(b => ({ ts: parseInt(b.timestamp, 16), tx: b.transactions?.length ?? 0 }))
      .sort((a, b) => a.ts - b.ts);

    let ema = 0, a = 2 / (Math.min(30, pairs.length) + 1);
    for (let i = 1; i < pairs.length; i++) {
      const dt = Math.max(1, pairs[i].ts - pairs[i - 1].ts);
      const tps = pairs[i].tx / dt;
      ema = ema ? (a * tps + (1 - a) * ema) : tps;
    }
    gTPS.set(ema || 0);
    gTx.set(pairs[pairs.length - 1]?.tx ?? 0);

    const body = await reg.metrics(); // string
    return new Response(body, {
      headers: {
        'content-type': reg.contentType || 'text/plain; version=0.0.4',
        'cache-control': 'no-cache',
      },
    });
  } catch (e: any) {
    const msg = e?.message || 'metrics error';
    return new Response(`# error ${msg}\n`, {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}
