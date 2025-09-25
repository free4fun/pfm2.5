'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import { apiFetch } from '@shared/api/client';
import { Button, Card, Input, Select } from '@shared/ui';

type NodeCreationFormProps = {
  networks: string[];
  onCreated: () => void;
};

type Role = 'bootnode' | 'miner' | 'rpc';

export default function NodeCreationForm({ networks, onCreated }: NodeCreationFormProps) {
  const [role, setRole] = useState<Role>('rpc');
  const [network, setNetwork] = useState<string>('');
  const [name, setName] = useState('rpc8545');
  const [ip, setIp] = useState('172.60.0.10');
  const [port, setPort] = useState(8545);
  const [image, setImage] = useState('hyperledger/besu:latest');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (networks.length === 0) {
      setNetwork('');
      return;
    }
    setNetwork(current => (current && networks.includes(current) ? current : networks[0]));
  }, [networks]);

  useEffect(() => {
    if (role === 'rpc') {
      setName(value => (value.startsWith('rpc') ? value : 'rpc8545'));
    } else if (role === 'miner') {
      setName(value => (value.startsWith('miner') ? value : 'miner1'));
    } else {
      setName(value => (value.startsWith('bootnode') ? value : 'bootnode1'));
    }
  }, [role]);

  const rpcPortEnabled = role === 'rpc';
  const canSubmit = useMemo(() => Boolean(network) && (!rpcPortEnabled || port > 0), [network, port, rpcPortEnabled]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !network) return;
    setBusy(true);
    try {
      await apiFetch(`/api/networks/${encodeURIComponent(network)}/nodes`, {
        method: 'POST',
        body: {
          role,
          name,
          image,
          ip,
          rpcPort: rpcPortEnabled ? port : undefined,
        },
        idempotencyKey: `node-${network}-${name}`,
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form className="space-y-3" onSubmit={submit}>
        <h3 className="font-semibold">Add node</h3>
        <Select value={network} onChange={(event: ChangeEvent<HTMLSelectElement>) => setNetwork(event.target.value)}>
          {networks.length === 0 ? <option value="">No networks available</option> : null}
          {networks.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
        <div className="grid gap-2 sm:grid-cols-5">
          <Select value={role} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRole(event.target.value as Role)}>
            <option value="bootnode">bootnode</option>
            <option value="miner">miner</option>
            <option value="rpc">rpc</option>
          </Select>
          <Input placeholder="name" value={name} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)} />
          <Input placeholder="ip" value={ip} onChange={(event: ChangeEvent<HTMLInputElement>) => setIp(event.target.value)} />
          <Input
            placeholder="rpcPort"
            type="number"
            value={port}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPort(parseInt(event.target.value || '0', 10))}
            disabled={!rpcPortEnabled}
          />
          <Input placeholder="image" value={image} onChange={(event: ChangeEvent<HTMLInputElement>) => setImage(event.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !canSubmit}>Create node</Button>
        </div>
      </form>
    </Card>
  );
}
