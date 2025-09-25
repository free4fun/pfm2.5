'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button, Input, Select } from '@shared/ui';

import { LogsPanel } from '../components/LogsPanel';

type NodeRow = { id: string; name: string };

type Role = 'bootnode' | 'miner' | 'rpc';

type Props = { id: string };

export default function NetworkDetailView({ id }: Props) {
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [creating, setCreating] = useState(false);

  const [role, setRole] = useState<Role>('rpc');
  const [nameInput, setNameInput] = useState('rpc8545');
  const [image, setImage] = useState('hyperledger/besu:latest');
  const [ip, setIp] = useState('');
  const [ports, setPorts] = useState('8545/tcp=8545'); // "container=host"

  useEffect(() => {
    if (role === 'rpc') {
      setNameInput(n => (n.startsWith('rpc') ? n : 'rpc8545'));
      setPorts(p => (p ? p : '8545/tcp=8545'));
    } else if (role === 'miner') {
      setNameInput(n => (n.startsWith('miner') ? n : 'miner1'));
      setPorts(''); // no host ports for internal-only peering
    } else {
      setNameInput(n => (n.startsWith('bootnode') ? n : 'bootnode1'));
      setPorts('');
    }
  }, [role]);

  const parsedPorts = useMemo(
    () =>
      Object.fromEntries(
        (ports || '')
          .split(',')
          .map((segment) => segment.trim())
          .filter(Boolean)
          .map((pair) => {
            const [container, host] = pair.split('=');
            return [container.trim(), Number(host)];
          }),
      ),
    [ports],
  );

  const load = async () => {
    setLoadingNodes(true);
    try {
      const res = await fetch(`/api/networks/${encodeURIComponent(id)}/nodes`, { cache: 'no-store' });
      const data = await res.json();
      const arr: NodeRow[] = Array.isArray(data) ? data : data?.items ?? [];
      setNodes(arr);
    } finally {
      setLoadingNodes(false);
    }
  };

  const createContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await fetch(`/api/networks/${encodeURIComponent(id)}/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role,
          name: nameInput,
          image,
          ip: ip || undefined,
          networkName: id,
          ports: Object.keys(parsedPorts).length ? parsedPorts : undefined,
        }),
      });
      await load();
    } finally {
      setCreating(false);
    }
  };

  const remove = async (cid: string) => {
    await fetch(`/api/networks/${encodeURIComponent(id)}/nodes?containerId=${encodeURIComponent(cid)}`, { method: 'DELETE' });
    await load();
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [id]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Network: {id}</h1>

      <form
        onSubmit={createContainer}
        className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:grid-cols-6"
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Role
          <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="rpc">rpc</option>
            <option value="miner">miner</option>
            <option value="bootnode">bootnode</option>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Name
          <Input value={nameInput} onChange={(event) => setNameInput(event.target.value)} required />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400 md:col-span-2">
          Image
          <Input value={image} onChange={(event) => setImage(event.target.value)} required />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Static IP
          <Input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="172.60.0.10" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Ports (c=h, comma)
          <Input
            value={ports}
            onChange={(event) => setPorts(event.target.value)}
            placeholder={role === 'rpc' ? '8545/tcp=8545' : '30303/tcp=30303'}
          />
        </label>

        <div className="flex items-end">
          <Button type="submit" disabled={creating} className="w-full text-xs">
            Create container
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between text-sm font-semibold tracking-wide">
            <span>Nodes</span>
            {loadingNodes && <span className="text-xs font-normal text-zinc-400">Updating…</span>}
          </div>
        </div>
        <div className="divide-y divide-zinc-800">
          {nodes.length === 0 && <div className="px-4 py-6 text-sm text-zinc-400">No containers.</div>}
          {nodes.map((node) => (
            <div key={node.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-xs text-zinc-300">{node.name}</div>
                <div className="truncate font-mono text-[10px] text-zinc-500">{node.id}</div>
              </div>
              <Button
                variant="ghost"
                onClick={() => remove(node.id)}
                className="border border-red-700/60 text-xs text-red-300 hover:bg-red-900/30"
                type="button"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </section>

      <LogsPanel id={id} />
    </div>
  );
}
