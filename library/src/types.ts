import type Docker from 'dockerode';

/** Options required to provision a Docker network for Besu nodes. */
export interface NetworkCreateOptions {
  /** Human readable network name (also used as Docker identifier). */
  name: string;
  /** CIDR range (e.g. 172.21.0.0/16) assigned to the bridge network. */
  subnet: string;
  /** Optional labels used to tag the network for later clean-up. */
  labels?: Record<string, string>;
}

/**
 * Wrapper around dockerode's container creation options with a few helpers for
 * attaching the container to a network and assigning a static address.
 */
export interface ContainerOptions extends Docker.ContainerCreateOptions {
  /** Unique container name. */
  name: string;
  /** Optional static IPv4 address to request from the target network. */
  ip?: string;
  /** Docker network name/ID to attach to immediately after creation. */
  networkName?: string;
}

/** Options for executing a command inside an existing container. */
export interface ExecOptions {
  /** Command array passed to the Docker exec API. */
  cmd: string[];
  /** Optional environment variables in KEY=VALUE format. */
  env?: string[];
  /** User specification (e.g. "0:0" or "besu"). */
  user?: string;
  /** Working directory inside the container. */
  workdir?: string;
  /** Whether to capture stdout (defaults to true). */
  attachStdout?: boolean;
  /** Whether to capture stderr (defaults to true). */
  attachStderr?: boolean;
}

/** Parameters for retrieving log output from a container. */
export interface LogsOptions {
  /** Include stdout stream (defaults to true). */
  stdout?: boolean;
  /** Include stderr stream (defaults to true). */
  stderr?: boolean;
  /** Only show logs since this unix timestamp in seconds. */
  since?: number; // unix seconds
  /** Tail the last N lines; defaults to 100 lines. */
  tail?: number;
}

/** CPU/memory constraints to apply to a running container. */
export interface UpdateResources {
  /** Relative CPU weight. */
  cpuShares?: number;
  /** Hard memory limit in bytes. */
  memory?: number; // bytes
  /** Nano-CPU limit (1e9 equals a full CPU). */
  nanoCpus?: number; // 1e9 = 1 CPU
}

/** High level view of a Docker network that is convenient for UIs/logging. */
export interface NetworkInfo {
  id: string;
  name: string;
  subnet?: string;
  labels?: Record<string, string>;
  containers: { id: string; name?: string; ipv4?: string }[];
}

/** Simplified subset of container inspection output. */
export interface ContainerInfo {
  id: string;
  name?: string;
  image?: string;
  state: string;
  running: boolean;
  status?: string;
  networks: string[];
}
