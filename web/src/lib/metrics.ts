import 'server-only';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const metrics = {
  networkOps: new client.Counter({
    name: 'besu_network_ops_total',
    help: 'Count of network operations',
    labelNames: ['op'],
    registers: [register]
  }),
  nodeOps: new client.Counter({
    name: 'besu_node_ops_total',
    help: 'Count of node operations',
    labelNames: ['op', 'role'],
    registers: [register]
  }),
  httpDuration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request durations',
    labelNames: ['route', 'method', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register]
  }),
  registry: register
};

export function timeHttp(route: string, method: string) {
  const end = metrics.httpDuration.startTimer({ route, method });
  return (status: number) => end({ status: String(status) });
}
