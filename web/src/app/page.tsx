'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import BlocksMetricsPanel from '@features/blocks/components/BlocksMetricsPanel';
import { Button, Card, Input } from '@shared/ui';

type RpcBlock = {
  number: string; hash: string; parentHash: string; miner: string; timestamp: string;
  gasUsed: string; gasLimit: string; size?: string; transactions: any[];
};

const hexToInt = (h?: string) => (h ? parseInt(h, 16) : 0);

export default function Home() {
  const [rpcUrl, setRpcUrl] = useState<string>('');
  const [list, setList] = useState<RpcBlock[]>([]);
  const [sel, setSel] = useState<RpcBlock | null>(null);
  const evRef = useRef<EventSource | null>(null);

  // Allow switching the reference RPC endpoint without reloading the app.
  useEffect(() => {
    const saved = localStorage.getItem('besu.rpc') || '';
    setRpcUrl(saved);
  }, []);
  const applyRpc = () => {
    if (rpcUrl) localStorage.setItem('besu.rpc', rpcUrl);
    // The backend keeps its own RPC base URL, so we just persist the client hint.
  };

  useEffect(() => {
    const es = new EventSource('/api/blocks/stream');
    evRef.current = es;
    es.addEventListener('block', (e) => {
      const b = JSON.parse((e as MessageEvent).data) as RpcBlock;
      setList(prev => {
        // Avoid inserting duplicates when streaming catches up quickly.
        if (prev.length && prev[0].hash === b.hash) return prev;
        const next = [b, ...prev].slice(0, 50);
        return next;
      });
    });
    return () => { es.close(); };
  }, []);

  const pretty = useMemo(() => (sel ? JSON.stringify(sel, null, 2) : ''), [sel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Blocks (live)</h1>
        <Link className="underline" href="/networks">Networks</Link>
      </div>

      <Card className="flex items-center gap-2">
        <Input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} placeholder="(optional) RPC url for reference e.g. http://localhost:8545" className="flex-1" />
        <Button onClick={applyRpc}>Save</Button>
      </Card>

      <BlocksMetricsPanel blocks={list} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="text-sm opacity-70 mb-2">Latest 50</div>
          <div className="max-h-[65vh] overflow-auto divide-y divide-zinc-800/70">
            {list.map(b => (
              <button
                key={b.hash}
                onClick={() => setSel(b)}
                className="w-full text-left p-3 hover:bg-zinc-900/60 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono">#{hexToInt(b.number)}</div>
                  <div className="text-xs opacity-70">{new Date(hexToInt(b.timestamp)*1000).toLocaleString()}</div>
                </div>
                <div className="text-xs truncate opacity-80">{b.hash}</div>
                <div className="text-xs opacity-80">
                  txs: {b.transactions?.length ?? 0} · gasUsed: {hexToInt(b.gasUsed)} / {hexToInt(b.gasLimit)}
                </div>
              </button>
            ))}
            {list.length === 0 && <div className="p-3 opacity-70 italic">Waiting for blocks…</div>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Inspector</div>
            {sel && (
              <a className="text-xs underline" href={`/api/blocks/${sel.hash}`} target="_blank">open raw</a>
            )}
          </div>
          {!sel ? (
            <div className="opacity-70 italic">Select a block</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                <div className="flex gap-4 flex-wrap">
                  <span className="font-mono">#{hexToInt(sel.number)}</span>
                  <span className="opacity-80">txs {sel.transactions?.length ?? 0}</span>
                  <span className="opacity-80">miner {sel.miner}</span>
                  <span className="opacity-80">{new Date(hexToInt(sel.timestamp)*1000).toLocaleString()}</span>
                </div>
              </div>
              <pre className="text-xs max-h-[60vh] overflow-auto bg-black/40 p-3 rounded">{pretty}</pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
