import Docker from 'dockerode';
import type { NetworkInspectInfo } from 'dockerode';
import {
  ContainerInfo,
  ContainerOptions,
  ExecOptions,
  LogsOptions,
  NetworkCreateOptions,
  NetworkInfo,
  UpdateResources
} from './types';

/**
 * Convenience wrapper around dockerode that offers higher level helpers for
 * creating Besu-friendly networks and containers. It centralises error
 * handling, default values and output shaping for the dashboard as well as the
 * CLI tooling.
 */
export class DockerManager {
  private docker: Docker;

  constructor(options?: Docker.DockerOptions) {
    this.docker = new Docker(options);
  }

  // ---------- Images ----------
  /** Ensure an image exists locally, pulling it if necessary. */
  async ensureImage(image: string): Promise<void> {
    const images = await this.docker.listImages({ filters: { reference: [image] } as any });
    if (images.length > 0) return;
    const stream = await this.docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err: any) => (err ? reject(err) : resolve()));
    });
  }

  // ---------- Networks ----------
  /** Create a new bridge network with predictable IPAM config. */
  async createNetwork(options: NetworkCreateOptions): Promise<string> {
    const net = await this.docker.createNetwork({
      Name: options.name,
      Driver: 'bridge',
      Labels: options.labels ?? {},
      IPAM: { Driver: 'default', Config: [{ Subnet: options.subnet }] }
    });
    const info = await net.inspect();
    return info.Id;
  }

  /** Create the network if it does not exist and return the network ID. */
  async ensureNetwork(options: NetworkCreateOptions): Promise<string> {
    const nets = await this.docker.listNetworks({ filters: { name: [options.name] } as any });
    if (nets.length) return nets[0].Id!;
    return this.createNetwork(options);
  }

  /** List networks (optionally filtered by label selectors) with container info. */
  async listNetworks(labelSelector?: Record<string, string>): Promise<NetworkInfo[]> {
    const filters: any = {};
    if (labelSelector) filters.label = Object.entries(labelSelector).map(([k, v]) => `${k}=${v}`);
    const list = await this.docker.listNetworks({ filters });
    const out: NetworkInfo[] = [];
    for (const n of list) {
      const net = this.docker.getNetwork(n.Id!);
      const info = await net.inspect();
      out.push(this._toNetworkInfo(info));
    }
    return out;
  }

  /** Remove all containers connected to the given network. */
  async removeContainersInNetwork(networkNameOrId: string): Promise<void> {
    const net = this.docker.getNetwork(networkNameOrId);
    const info = await net.inspect();
    const containers = info.Containers ?? {};
    const ids = Object.keys(containers);
    for (const id of ids) await this.removeContainer(id, true);
  }

  /** Delete a network, optionally force removing its containers first. */
  async removeNetwork(networkNameOrId: string, removeContainers: boolean = true): Promise<void> {
    const net = this.docker.getNetwork(networkNameOrId);
    try {
      if (removeContainers) await this.removeContainersInNetwork(networkNameOrId);
      await net.remove();
    } catch (e: any) {
      if (e?.statusCode === 404) return;
      throw e;
    }
  }

  /** Prune all unused networks optionally filtered by label. */
  async pruneNetworks(labelSelector?: Record<string, string>): Promise<void> {
    // Docker API supports filters for prune; dockerode exposes it via modem
    const filters: any = {};
    if (labelSelector) filters.label = Object.entries(labelSelector).map(([k, v]) => `${k}=${v}`);
    await (this.docker as any).pruneNetworks({ filters: JSON.stringify(filters) });
  }

  /** Retrieve and normalise network inspection output. */
  async getNetworkInfo(networkNameOrId: string): Promise<NetworkInfo> {
    const net = this.docker.getNetwork(networkNameOrId);
    const info = await net.inspect();
    return this._toNetworkInfo(info);
  }

  /** Convert raw Docker inspect data into the simplified NetworkInfo structure. */
  private _toNetworkInfo(info: NetworkInspectInfo): NetworkInfo {
    const subnet = info.IPAM?.Config?.[0]?.Subnet;
    const entries = info.Containers
      ? Object.entries(info.Containers).map(([id, c]) => ({
          id,
          name: (c as any).Name,
          ipv4: (c as any).IPv4Address?.split('/')?.[0]
        }))
      : [];
    return {
      id: info.Id,
      name: info.Name,
      subnet,
      labels: (info as any).Labels ?? undefined,
      containers: entries
    };
  }

  // ---------- Containers ----------
  /** Create and optionally attach/start a container using friendly options. */
  async createContainer(options: ContainerOptions): Promise<string> {
    const { name, ip, networkName, Image, ...dockerOpts } = options;
    if (!Image) throw new Error('Image is required');
    if (ip && !networkName) throw new Error('Static IP requires networkName.');
    await this.ensureImage(Image);

    const container = await this.docker.createContainer({ name, Image, ...dockerOpts });

    if (networkName) {
      const net = this.docker.getNetwork(networkName);
      await net.connect({
        Container: container.id,
        EndpointConfig: ip ? { IPAMConfig: { IPv4Address: ip } } : undefined
      });
    }
    await container.start();
    return container.id;
  }

  /** Connect an existing container to a network, optionally with a static IP. */
  async connectContainerToNetwork(
    containerNameOrId: string,
    networkNameOrId: string,
    ip?: string
  ): Promise<void> {
    const net = this.docker.getNetwork(networkNameOrId);
    await net.connect({
      Container: containerNameOrId,
      EndpointConfig: ip ? { IPAMConfig: { IPv4Address: ip } } : undefined
    });
  }

  /** Disconnect a container from a network, optionally forcing the operation. */
  async disconnectContainerFromNetwork(
    containerNameOrId: string,
    networkNameOrId: string,
    force: boolean = false
  ): Promise<void> {
    const net = this.docker.getNetwork(networkNameOrId);
    await net.disconnect({ Container: containerNameOrId, Force: force });
  }

  /** Start a stopped container by name or ID. */
  async startContainer(nameOrId: string): Promise<void> {
    await this.docker.getContainer(nameOrId).start();
  }

  /** Gracefully stop a container with a configurable timeout. */
  async stopContainer(nameOrId: string, timeoutSec: number = 10): Promise<void> {
    const c = this.docker.getContainer(nameOrId);
    try {
      await c.stop({ t: timeoutSec });
    } catch (e: any) {
      if (e?.statusCode === 304) return; // already stopped
      throw e;
    }
  }

  /** Remove a container, ignoring "not found" errors. */
  async removeContainer(nameOrId: string, force: boolean = true): Promise<void> {
    const container = this.docker.getContainer(nameOrId);
    try {
      await container.remove({ force });
    } catch (e: any) {
      if (e?.statusCode === 404) return;
      throw e;
    }
  }

  /** Prune stopped containers using Docker's prune API. */
  async pruneContainers(): Promise<void> {
    await this.docker.pruneContainers({});
  }

  /** Inspect a container and map the result to ContainerInfo for UI display. */
  async getContainerInfo(containerNameOrId: string): Promise<ContainerInfo> {
    const c = this.docker.getContainer(containerNameOrId);
    const info = await c.inspect();
    const networksObj = info.NetworkSettings?.Networks ?? {};
    const networks = Object.keys(networksObj);
    return {
      id: info.Id,
      name: info.Name?.replace(/^\//, ''),
      image: info.Config?.Image,
      state: info.State?.Status ?? 'unknown',
      running: Boolean(info.State?.Running),
      status: info.State?.Status,
      networks
    };
  }

  /** Execute a command inside a container and collect stdout/stderr. */
  async execInContainer(nameOrId: string, opts: ExecOptions): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const c = this.docker.getContainer(nameOrId);
    const exec = await c.exec({
      Cmd: opts.cmd,
      Env: opts.env,
      User: opts.user,
      WorkingDir: opts.workdir,
      AttachStdout: opts.attachStdout ?? true,
      AttachStderr: opts.attachStderr ?? true
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const chunksStdout: Buffer[] = [];
    const chunksStderr: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      // Demultiplex the Docker stream, accumulating stdout/stderr separately.
      (this.docker.modem as any).demuxStream(stream, {
        write: (b: Buffer) => chunksStdout.push(Buffer.from(b))
      }, {
        write: (b: Buffer) => chunksStderr.push(Buffer.from(b))
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const insp = await exec.inspect();
    return {
      exitCode: insp.ExitCode ?? 0,
      stdout: Buffer.concat(chunksStdout).toString('utf8'),
      stderr: Buffer.concat(chunksStderr).toString('utf8')
    };
  }

  /** Retrieve container logs with sane defaults for stdout/stderr/tail. */
  async getContainerLogs(nameOrId: string, opts: LogsOptions = {}): Promise<string> {
    const c = this.docker.getContainer(nameOrId);
    const stream = await c.logs({
      stdout: opts.stdout ?? true,
      stderr: opts.stderr ?? true,
      tail: opts.tail ?? 100,
      since: opts.since ?? 0
    } as any);
    // stream may be Buffer
    return Buffer.isBuffer(stream) ? stream.toString('utf8') : String(stream);
  }

  /** Apply CPU/memory constraints to a running container. */
  async updateContainerResources(nameOrId: string, res: UpdateResources): Promise<void> {
    const c = this.docker.getContainer(nameOrId);
    await c.update({
      CpuShares: res.cpuShares,
      Memory: res.memory,
      NanoCpus: res.nanoCpus
    } as any);
  }

  /** Wait until a container transitions into the desired state or timeout. */
  async waitForContainer(nameOrId: string, state: 'running' | 'exited', timeoutMs = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const info = await this.getContainerInfo(nameOrId);
      if (state === 'running' && info.running) return true;
      if (state === 'exited' && !info.running) return true;
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  /** Helper to consume a stream into a utf8 string. */
  private async _readStreamToString(s: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const c of s) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks).toString('utf8');
  }
}

export default DockerManager;
