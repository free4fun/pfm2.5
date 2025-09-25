'use client';

import { useEffect, useState } from 'react';

type LogItem = { containerId: string; name?: string; logs: string };

export function LogsPanel({ id }: { id: string }) {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/networks/${encodeURIComponent(id)}/logs`, { cache: 'no-store' });
      const data = await res.json();
      const arr: LogItem[] = Array.isArray(data) ? data : (data?.items ?? []);
      setItems(arr);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const toggle = (cid: string) => setExpanded(s => ({ ...s, [cid]: !s[cid] }));
  const copy = (txt: string) => navigator.clipboard.writeText(txt).catch(() => {});

  return (
    <section className="mt-8 w-full rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-900/70 px-4 py-3 backdrop-blur">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-200">Logs</h2>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-400">Actualizando…</span>}
          <button
            onClick={load}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {items.length === 0 && (
          <div className="rounded-lg border border-zinc-800 p-6 text-sm text-zinc-400">
            Sin contenedores con logs.
          </div>
        )}

        {items.map((it) => {
          const open = !!expanded[it.containerId];
          return (
            <div
              key={it.containerId}
              className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-zinc-300">
                    {it.name || it.containerId}
                  </div>
                  <div className="truncate font-mono text-[10px] text-zinc-500">
                    {it.containerId}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copy(it.logs)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
                    title="Copiar logs"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => toggle(it.containerId)}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
                  >
                    {open ? 'Contraer' : 'Expandir'}
                  </button>
                </div>
              </div>

              <pre
                className={[
                  'w-full whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-zinc-200',
                  'p-3',
                  open ? 'max-h-[70vh]' : 'max-h-64',
                  'overflow-auto',
                ].join(' ')}
              >
                {it.logs || '—'}
              </pre>
            </div>
          );
        })}
      </div>
    </section>
  );
}
