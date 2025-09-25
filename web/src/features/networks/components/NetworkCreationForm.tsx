'use client';

import { useState, type ChangeEvent } from 'react';

import { apiFetch } from '@shared/api/client';
import { Button, Card, Input } from '@shared/ui';

type NetworkCreationFormProps = { onCreated: () => void };

export default function NetworkCreationForm({ onCreated }: NetworkCreationFormProps) {
  const [name, setName] = useState('besu-net');
  const [subnet, setSubnet] = useState('172.60.0.0/16');
  const [owner, setOwner] = useState('web2');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/networks', {
        method: 'POST',
        body: { name, subnet, labels: { owner } },
        idempotencyKey: `net-${name}`,
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="font-semibold mb-2">Create network</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="name"
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        />
        <Input
          placeholder="subnet CIDR"
          value={subnet}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSubnet(event.target.value)}
        />
        <Input
          placeholder="label.owner"
          value={owner}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setOwner(event.target.value)}
        />
      </div>
      <div className="mt-3">
        <Button type="button" disabled={busy || !name.trim()} onClick={submit}>
          Create
        </Button>
      </div>
    </Card>
  );
}
