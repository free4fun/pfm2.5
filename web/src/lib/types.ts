// Types shared by API and UI

export type NodeRole = 'miner' | 'rpc' | 'bootnode'; // use "miner" as label even on PoA

export type NetworkCreateOptions = {
  name: string;
  subnet: string;
  labels?: Record<string, string>;
};

export type NetworkInfo = {
  id: string;
  name: string;
  driver: string;
  scope?: string;
  createdAt?: string;
  labels?: Record<string, string>;
  subnet?: string;
  containers: Array<{ id: string; name: string; ipv4?: string }>;
};

export type ContainerInfo = {
  id: string;
  name: string;
  image: string;
  createdAt?: string;
  state?: string;
  status?: string;
  networks?: Array<{ name: string; ipv4?: string }>;
};

export type ContainerOptions = {
  name: string;
  image: string;
  role?: NodeRole;                // "miner" is a PoA validator label here
  ip?: string;
  networkName?: string;
  env?: Record<string, string>;
  cmd?: string[];
  ports?: Record<string, number>; // {"8545/tcp": 8545}
};
