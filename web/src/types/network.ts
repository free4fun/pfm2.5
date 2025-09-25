export type AddNodeInput = {
  role: 'bootnode' | 'miner' | 'rpc';
  name: string;
  image: string;
  networkName?: string;
  ip?: string;
  rpcPort?: number;
  env?: Record<string, string>;
  cmd?: string[];
  binds?: string[];
};
