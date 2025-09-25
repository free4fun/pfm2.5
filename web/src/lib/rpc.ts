export type JsonRpcBlock = {
  number: string; hash: string; parentHash: string; miner: string; timestamp: string;
  gasUsed: string; gasLimit: string; size?: string; transactions: any[];
};
const RPC_URL = process.env.BESU_RPC_URL!;
if (!RPC_URL) throw new Error('Missing env: BESU_RPC_URL');

async function rpc<T=any>(method: string, params: any[] = []): Promise<T> {
  const r = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result as T;
}

export const ethBlockNumber = async () => parseInt(await rpc<string>('eth_blockNumber'), 16);

export const ethGetBlockByNumber = async (n: number, fullTx = false) =>
  rpc<JsonRpcBlock>('eth_getBlockByNumber', ['0x' + n.toString(16), fullTx]);

export const ethGetBlockByHash = async (hash: string, fullTx = false) =>
  rpc<JsonRpcBlock>('eth_getBlockByHash', [hash, fullTx]);
