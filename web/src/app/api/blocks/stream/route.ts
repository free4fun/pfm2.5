export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { ethBlockNumber, ethGetBlockByNumber } from '../../../../lib/rpc';

const INTERVAL_MS = 1500;
type Client = { ctrl: AbortController };

export async function GET(_req: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
     const safeEnq = (s: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(s)); } catch { /* already closed */ }
      };
      
      safeEnq(`event: ping\ndata: {}\n\n`);

      let last = 0;
      const tick = async () => {
        if (closed) return;
        try {
          const n = await ethBlockNumber();
          if (n > last) {
            const b = await ethGetBlockByNumber(n, true);
            last = n;
            safeEnq(`event: block\ndata: ${JSON.stringify(b)}\n\n`);
          }
        } catch (e:any) {
          safeEnq(`event: error\ndata: ${JSON.stringify({ message: e?.message || 'rpc error' })}\n\n`);
        }
      };
      const id = setInterval(tick, 1000);

      const ping = setInterval(() => {
        safeEnq(`event: ping\ndata: {}\n\n`);
      }, 25000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(id);
        clearInterval(ping);
        try { controller.close(); } catch {}
      };


      const signal: AbortSignal | undefined = (globalThis as any).__NEXT_PRIVATE_ORIGIN__ ? undefined : undefined;
      const autoClose = setTimeout(close, 5 * 60 * 1000);
      const _clearAuto = () => clearTimeout(autoClose);

    },
    cancel() {
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx
    },
  });
}
