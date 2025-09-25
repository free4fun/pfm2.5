'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import NetworkCreationForm from '@features/networks/components/NetworkCreationForm';
import NodeCreationForm from '@features/networks/components/NodeCreationForm';
import { Button } from '@shared/ui';

type Net = { id: string; name: string; driver: string };

export default function NetworksIndex() {
  const [nets, setNets] = useState<Net[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/networks', { cache: 'no-store' });
      const data = await res.json();
      setNets(Array.isArray(data) ? data : (data?.items ?? []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const removeNet = async (name: string) => {
    if (!confirm(`Delete network "${name}" and all its containers?`)) return;
    await fetch(`/api/networks/${encodeURIComponent(name)}?removeContainers=true`, { method: 'DELETE' });
    load();
  };

  const networkNames = useMemo(() => nets.map(n => n.name).sort(), [nets]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Networks</h1>
        <Link className="text-sm text-blue-300 underline" href="/">Back to dashboard</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NetworkCreationForm onCreated={load} />
        <NodeCreationForm networks={networkNames} onCreated={load} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {nets.map(n => (
          <div key={n.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <Link href={`/networks/${encodeURIComponent(n.name)}`} className="min-w-0">
                <div className="truncate text-sm">{n.name}</div>
                <div className="truncate text-[11px] text-zinc-500">{n.id}</div>
              </Link>
              <div className="flex items-center gap-2">
                <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px]">{n.driver}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeNet(n.name)}
                  className="border border-red-700/60 px-2 py-1 text-[10px] text-red-300 hover:bg-red-900/30"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!loading && nets.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
            No networks found.
          </div>
        )}
      </div>
    </div>
  );
}
