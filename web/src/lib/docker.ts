import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import type Docker from 'dockerode';
import { DockerManager } from 'besu-docker-manager';
import { ENV } from './env';
import { metrics } from './metrics';

let dm: DockerManager | null = null;

// Lazily create a single Docker manager so we reuse the same socket connection.
function dockerManager(): DockerManager {
  if (!dm) dm = new DockerManager({ socketPath: ENV.DOCKER_SOCKET });
  return dm;
}

/* ============================= Helpers FS/Genesis ============================= */

function baseDir(): string {
  return ENV.BESU_BASE_DIR;
}

function ensureFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}
function ensureDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function genesisPath(): string | null {
  const p = path.join(baseDir(), 'genesis.json');
  return ensureFile(p) ? p : null;
}

function nodeDirs(name: string) {
  const dir = path.join(baseDir(), name);
  return {
    root: dir,
    data: path.join(dir, 'data'),
    keyFile: path.join(dir, 'nodekey.hex'),
  };
}

function readChainId(): number | null {
  const g = genesisPath();
  if (!g) return null;
  try {
    const j = JSON.parse(fs.readFileSync(g, 'utf8'));
    return Number(j?.config?.chainId ?? 0) || null;
  } catch { return null; }
}

/* ============================= Ports helpers ============================= */

type PortMap = NonNullable<Docker.ContainerCreateOptions['HostConfig']>['PortBindings'];
async function isPortFree(p: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => { srv.close(() => resolve(true)); })
      .listen(p, '0.0.0.0');
  });
}
async function findFree(start = 8545, end = 8645) {
  for (let p = start; p <= end; p++) if (await isPortFree(p)) return p;
  throw new Error(`no free port ${start}-${end}`);
}

/* ============================= Public API ============================= */

/**
 * List Docker networks that look like they belong to Besu.
 * Dockerode only returns partial information, so we inspect each network.
 */
export async function listNetworks() {
  const d = dockerManager();
  const nets = await d.listNetworks();

  const out: Array<{ id: string; name: string; driver: string }> = [];
  for (const n of nets as any[]) {
    const info = await d.getNetworkInfo(n.id);
    const hasBesu = (info.containers ?? []).some(
      (c: any) => /besu|rpc|miner|bootnode/i.test(c?.name ?? '')
    );
    if (hasBesu || /besu/i.test((n?.name ?? '') as string)) {
      out.push({
        id: info.id,
        name: (info.name ?? n?.name ?? info.id) as string,
        driver: (n as any)?.driver ?? 'bridge',
      });
    }
  }
  return out;
}


export async function createNetwork(opts: { name: string; subnet: string; labels?: Record<string,string> }) {
  const d = dockerManager();
  const labels = {
    'bw:managed': '1',
    ...(opts.labels ?? {}),
  };
  const id = await d.createNetwork({ name: opts.name, subnet: opts.subnet, labels });
  metrics.networkOps.inc({ op: 'create' });
  return id;
}

export async function removeNetwork(nameOrId: string, removeContainers = true) {
  const d = dockerManager();
  if (removeContainers) await d.removeContainersInNetwork(nameOrId);
  await d.removeNetwork(nameOrId);
  metrics.networkOps.inc({ op: 'delete' });
}

export async function getNetworkInfo(networkNameOrId: string) {
  const d = dockerManager();
  return d.getNetworkInfo(networkNameOrId);
}

export async function getContainerInfo(containerNameOrId: string) {
  const d = dockerManager();
  return d.getContainerInfo(containerNameOrId);
}

export async function listNodes(networkName: string) {
  const d = dockerManager();
  const info = await d.getNetworkInfo(networkName);
  return (info.containers ?? []).map(c => ({
    id: c.id,
    name: c.name ?? c.id,
  }));
}

export async function removeContainer(nameOrId: string, force = true): Promise<void> {
  const d = dockerManager();
  await d.removeContainer(nameOrId, force as any);
}


export async function nodeLogs(nameOrId: string, tail = 200) {
  const d = dockerManager();
  return d.getContainerLogs(nameOrId, { tail, stdout: true, stderr: true });
}



/* ============================= Node creation ============================= */

type NodeRole = 'rpc' | 'miner' | 'bootnode';

function roleBaseFlags(rpcPort = 8545): string[] {
  return [
    '--p2p-port=30303',
    '--discovery-enabled=true',
    '--nat-method=NONE',
    // Always expose HTTP RPC internally so admin_addPeer calls work.
    '--rpc-http-enabled=true',
    `--rpc-http-port=${rpcPort}`,
    '--rpc-http-host=0.0.0.0',
    '--rpc-http-api=ETH,NET,WEB3,ADMIN,QBFT,IBFT',
    '--host-allowlist=*',
  ];
}

/** Auto-compute bind mounts and CLI flags when the caller left them undefined. */
function autoBindsAndFlags(nodeName: string, role: NodeRole, rpcPortPref: number) {
  const g = genesisPath();
  const chainId = readChainId();
  const nd = nodeDirs(nodeName);

  const binds: string[] = [];
  const extraFlags: string[] = [];

  // Mount genesis file when available so Besu shares chain config.
  if (g) {
    binds.push(`${g}:/config/genesis.json:ro`);
    extraFlags.push('--genesis-file=/config/genesis.json');
  }
  // Mount persistent data directory when it exists.
  if (ensureDir(nd.data)) {
    binds.push(`${nd.data}:/data`);
    extraFlags.push('--data-path=/data');
  }
  // Mount static node key if provided.
  if (ensureFile(nd.keyFile)) {
    binds.push(`${nd.keyFile}:/keys/nodekey.hex:ro`);
    extraFlags.push('--node-private-key-file=/keys/nodekey.hex');
  }
  // Propagate custom chain id from genesis file.
  if (chainId) extraFlags.push(`--network-id=${chainId}`);

  // Only RPC nodes expose port 8545 to the host by default.
  const base = roleBaseFlags(rpcPortPref);
  return { binds, cmd: [...base, ...extraFlags] };
}

/** Create a Besu container and attach it to the managed Docker network. */
export async function addNode(params: {
  networkName: string;
  name: string;
  image: string;
  role: NodeRole;
  ip?: string;
  ports?: Record<string, number>; // {"8545/tcp": 8545}
  env?: Record<string,string>;
  cmd?: string[];                // If provided we respect it and skip auto flags.
  binds?: string[];              // If provided we respect it and skip auto binds.
}) {
  const d = dockerManager();
  const { networkName, name, image, role } = params;
  const rpcPref = params.ports?.['8545/tcp'] ?? params.ports?.['8545'] ?? 8545;

  // Auto-populate binds/command when missing.
  const { binds, cmd } = (!params.binds && !params.cmd)
    ? autoBindsAndFlags(name, role, rpcPref)
    : { binds: params.binds ?? [], cmd: [...roleBaseFlags(rpcPref), ...(params.cmd ?? [])] };

  // Prepare Docker port mapping objects.
  const ExposedPorts: NonNullable<Docker.ContainerCreateOptions['ExposedPorts']> = {};
  const PortBindings: PortMap = {};

  // Only publish RPC port (8545) by default; P2P port stays internal for non-RPC roles.
  for (const [containerPort, hostPort] of Object.entries(params.ports ?? {})) {
    if (role !== 'rpc' && /^30303/.test(containerPort)) continue;
    const hp = Number(hostPort);
    const usePort = (await isPortFree(hp)) ? hp : await findFree(hp + 1, hp + 100);
    ExposedPorts[containerPort] = {};
    PortBindings[containerPort] = [{ HostPort: String(usePort) }];
  }

  const Env = params.env ? Object.entries(params.env).map(([k,v]) => `${k}=${v}`) : undefined;

  const containerId = await d.createContainer({
    name,
    Image: image,
    Cmd: cmd,
    Env,
    ExposedPorts: Object.keys(ExposedPorts).length ? ExposedPorts : undefined,
    HostConfig: {
      Binds: binds.length ? binds : undefined,
      PortBindings: Object.keys(PortBindings).length ? PortBindings : undefined,
      NetworkMode: networkName,
      RestartPolicy: { Name: 'unless-stopped' },
    },
    // Additional hints understood by DockerManager for network wiring.
    networkName,
    ip: params.ip,
  } as any);

  // Attempt to mesh peers after the container is ready; ignore failures.
  try { await meshPeers(networkName); } catch {}
  metrics.nodeOps.inc({ op: 'add', role });
  return containerId;
}

/* ============================= Peering mesh ============================= */

async function containerIdsInNetwork(networkName: string): Promise<string[]> {
  const info = await dockerManager().getNetworkInfo(networkName);
  return (info.containers ?? []).map(c => c.id);
}

async function containerIpInNetwork(containerId: string, networkName: string): Promise<string | null> {
  try {
    const info = await dockerManager().getContainerInfo(containerId);
    const nets = (info as any)?.networks ?? [];
    const match = nets.find((n: any) => n?.name === networkName);
    return match?.ipv4 ?? null;
  } catch { return null; }
}


async function fetchEnode(ip: string, port = 8545, timeoutMs = 1200): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'admin_nodeInfo', params: [] }),
      signal: ctrl.signal,
    }).catch(() => null);
    clearTimeout(t);
    if (!res || !res.ok) return null;
    const j: any = await res.json().catch(() => null);
    const enode = j?.result?.enode;
    return (typeof enode === 'string' && enode.startsWith('enode://')) ? enode : null;
  } catch { return null; }
}

async function adminAddPeer(ip: string, enode: string, timeoutMs = 800): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    await fetch(`http://${ip}:8545`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'admin_addPeer', params: [enode] }),
      signal: ctrl.signal,
    }).catch(() => null);
    clearTimeout(t);
  } catch {}
}

async function meshPeers(networkName: string) {
  const ids = await containerIdsInNetwork(networkName);
  const ips = await Promise.all(ids.map(async id => await containerIpInNetwork(id, networkName)));
  const ipList = ips.filter(Boolean) as string[];

  // Discover enode URLs via admin_nodeInfo.
  const enodes = new Set<string>();
  for (const ip of ipList) {
    const e = await fetchEnode(ip, 8545);
    if (e && !/@127\.0\.0\.1:/.test(e)) enodes.add(e);
  }
  if (!enodes.size) return;

  // Push every discovered enode to every peer for a dense mesh.
  for (const ip of ipList) {
    for (const e of enodes) { await adminAddPeer(ip, e); }
  }
}
