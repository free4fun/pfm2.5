import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
extendZodWithOpenApi(z);

// Simple CIDR and IPv4 checks
const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[12][0-9]|3[0-2])$/;
const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

export const CreateNetworkSchema = z.object({
  name: z.string().min(1).openapi({ example: 'besu-net' }),
  subnet: z.string().regex(cidrRegex, 'invalid CIDR').openapi({ example: '172.40.0.0/16' }),
  labels: z.record(z.string()).optional().openapi({ example: { owner: 'web2' } })
}).openapi('CreateNetwork');

export const AddNodeSchema = z.object({
  role: z.enum(['bootnode', 'miner', 'rpc']).openapi({ example: 'rpc' }),
  name: z.string().min(1).openapi({ example: 'rpc8545' }),
  image: z.string().min(1).default('hyperledger/besu:latest'),
  ip: z.string().regex(ipv4Regex, 'invalid IPv4').optional().openapi({ example: '172.40.0.10' }),
  rpcPort: z.number().int().positive().optional().openapi({ example: 8545 }),
  networkName: z.string(),
  env: z.record(z.string()).optional(),
  cmd: z.array(z.string()).optional(),
  binds: z.array(z.string()).optional(),
}).openapi('AddNode');

export const AddNodeBodySchema = z.object({
  role: z.enum(['bootnode','miner','rpc']),
  name: z.string().min(1),
  image: z.string().min(1),
  ip: z.string().optional(),        // o z.string().ip().optional() si quieres validar IP
  rpcPort: z.number().int().positive().optional(),
  env: z.record(z.string()).optional(),
  cmd: z.array(z.string()).optional(),
  binds: z.array(z.string()).optional(),
});

export type AddNodeBody = z.infer<typeof AddNodeBodySchema>;
export type AddNodeInput = z.infer<typeof AddNodeSchema>;