// Uses alpine:3 image pulled on first use.

import { DockerManager } from '../src/DockerManager';

const unique = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random()*1e6)}`;
const pickSubnet = (): string => {
  const oct = 60 + Math.floor(Math.random() * 80); // 172.60..172.139
  return `172.${oct}.0.0/16`;
};
const ipFromSubnet = (subnet: string, host = 10) => {
  const m = subnet.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
  if (!m) throw new Error(`unsupported subnet: ${subnet}`);
  return `${m[1]}.${m[2]}.${host}.10`;
};

describe('DockerManager extra integration', () => {
  const dm = new DockerManager();

  afterAll(async () => {
    // best effort global prune (safe in CI; adjust locally if needed)
    await dm.pruneContainers().catch(() => void 0);
    await dm.pruneNetworks().catch(() => void 0);
  });

  it('errors when static IP provided without networkName', async () => {
    const name = unique('bad-ip');
    await expect(dm.createContainer({
      name, Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 5'], ip: '172.99.0.10'
    } as any)).rejects.toThrow(/Static IP requires networkName/i);
  });

  it('ensureImage is idempotent', async () => {
    await expect(dm.ensureImage('alpine:3')).resolves.toBeUndefined();
    await expect(dm.ensureImage('alpine:3')).resolves.toBeUndefined();
  });

  it('ensureNetwork is idempotent and listNetworks filters by label', async () => {
    const netName = unique('ens-net');
    const subnet = pickSubnet();
    const id1 = await dm.ensureNetwork({ name: netName, subnet, labels: { owner: 'extra' } });
    const id2 = await dm.ensureNetwork({ name: netName, subnet, labels: { owner: 'extra' } });
    expect(id1).toBe(id2);

    const listed = await dm.listNetworks({ owner: 'extra' });
    expect(listed.some(n => n.name === netName)).toBe(true);

    await dm.removeNetwork(netName, true);
  });

  it('connects and disconnects a container to/from a network with static IP', async () => {
    const netName = unique('net-move');
    const subnet = pickSubnet();
    await dm.ensureNetwork({ name: netName, subnet, labels: { suite: 'extra' } });

    const name = unique('ctr-move');
    const cid = await dm.createContainer({
      name, Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 15']
    });
    expect(await dm.waitForContainer(cid, 'running', 4000)).toBe(true);

    const ip = ipFromSubnet(subnet);
    await dm.connectContainerToNetwork(cid, netName, ip);

    let ci = await dm.getContainerInfo(cid);
    expect(ci.networks).toContain(netName);

    await dm.disconnectContainerFromNetwork(cid, netName, true);
    ci = await dm.getContainerInfo(cid);
    expect(ci.networks).not.toContain(netName);

    await dm.removeContainer(cid, true);
    await dm.removeNetwork(netName, true);
  });

  it('execInContainer returns stdout/stderr and exit code (non-zero)', async () => {
    const netName = unique('net-exec');
    const subnet = pickSubnet();
    await dm.ensureNetwork({ name: netName, subnet });

    const name = unique('ctr-exec');
    const cid = await dm.createContainer({
      name, Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 12'], networkName: netName
    });
    expect(await dm.waitForContainer(cid, 'running', 4000)).toBe(true);

    const ok = await dm.execInContainer(cid, { cmd: ['sh', '-lc', 'echo -n hello && echo err 1>&2'] });
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout).toBe('hello');
    expect(ok.stderr.trim()).toBe('err');

    const bad = await dm.execInContainer(cid, { cmd: ['sh', '-lc', 'exit 7'] });
    expect(bad.exitCode).toBe(7);

    await dm.removeNetwork(netName, true);
  });

  it('getContainerLogs captures output', async () => {
    const netName = unique('net-logs');
    await dm.ensureNetwork({ name: netName, subnet: pickSubnet() });

    const name = unique('ctr-logs');
    const cid = await dm.createContainer({
      name,
      Image: 'alpine:3',
      Cmd: ['sh', '-lc', 'echo alpha; echo beta 1>&2; sleep 5'],
      networkName: netName
    });
    expect(await dm.waitForContainer(cid, 'running', 3000)).toBe(true);

    const logs = await dm.getContainerLogs(cid, { tail: 100000 });
    expect(logs).toMatch(/alpha/);

    await dm.removeNetwork(netName, true);
  });

  it('updateContainerResources does not throw', async () => {
    const name = unique('ctr-upd');
    const cid = await dm.createContainer({
      name, Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 10']
    });
    await expect(dm.updateContainerResources(cid, { nanoCpus: 5e8 })).resolves.toBeUndefined();
    await dm.removeContainer(cid, true);
  });

  it('stop/start idempotency and waitForContainer timeouts return false', async () => {
    const name = unique('ctr-ss');
    const cid = await dm.createContainer({
      name, Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 2']
    });
    expect(await dm.waitForContainer(cid, 'running', 3000)).toBe(true);

    await dm.stopContainer(cid);
    await dm.stopContainer(cid); // idempotent
    expect(await dm.waitForContainer(cid, 'exited', 4000)).toBe(true);

    // Asking for running state should timeout and return false
    expect(await dm.waitForContainer(cid, 'running', 1000)).toBe(false);

    await dm.removeContainer(cid, true);
  });

  it('removeContainer and removeNetwork are no-ops on missing resources', async () => {
    await expect(dm.removeContainer('no-such', true)).resolves.toBeUndefined();
    await expect(dm.removeNetwork('no-such', true)).resolves.toBeUndefined();
  });

  it('removeContainersInNetwork deletes all members', async () => {
    const netName = unique('net-purge');
    await dm.ensureNetwork({ name: netName, subnet: pickSubnet() });

    await dm.createContainer({ name: unique('c1'), Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 8'], networkName: netName });
    await dm.createContainer({ name: unique('c2'), Image: 'alpine:3', Cmd: ['sh', '-c', 'sleep 8'], networkName: netName });

    const before = await dm.getNetworkInfo(netName);
    expect(before.containers.length).toBeGreaterThanOrEqual(2);

    await dm.removeContainersInNetwork(netName);
    const after = await dm.getNetworkInfo(netName);
    expect(after.containers.length).toBe(0);

    await dm.removeNetwork(netName, false);
  });

  it('pruneNetworks removes by label selector', async () => {
    const a = unique('net-a'); const b = unique('net-b');
    const subnetA = pickSubnet(); const subnetB = pickSubnet();
    await dm.ensureNetwork({ name: a, subnet: subnetA, labels: { gc: 'yes' } });
    await dm.ensureNetwork({ name: b, subnet: subnetB, labels: { gc: 'yes' } });

    let listed = await dm.listNetworks({ gc: 'yes' });
    expect(listed.some(n => n.name === a)).toBe(true);
    expect(listed.some(n => n.name === b)).toBe(true);

    await dm.pruneNetworks({ gc: 'yes' });

    listed = await dm.listNetworks({ gc: 'yes' });
    expect(listed.length).toBe(0);
  });
});
