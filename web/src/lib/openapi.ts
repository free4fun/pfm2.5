import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { CreateNetworkSchema, AddNodeSchema } from './validators';

export function getOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  const Health = z.object({ ok: z.boolean() });

  registry.register('CreateNetwork', CreateNetworkSchema);
  registry.register('AddNode', AddNodeSchema);

  registry.registerPath({
    method: 'get',
    path: '/api/health',
    summary: 'Health check',
    responses: { 200: { description: 'OK', content: { 'application/json': { schema: Health } } } }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/networks',
    summary: 'List Docker networks',
    responses: { 200: { description: 'List', content: { 'application/json': { schema: z.array(z.any()) } } } }
  });

  registry.registerPath({
    method: 'post',
    path: '/api/networks',
    summary: 'Create or ensure a Docker network',
    request: { body: { content: { 'application/json': { schema: CreateNetworkSchema } } } },
    responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' } }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/networks/{id}',
    summary: 'Get network details',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Details' }, 404: { description: 'Not found' } }
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/networks/{id}',
    summary: 'Delete network and containers',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Deleted' } }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/networks/{id}/status',
    summary: 'Network status',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Status' } }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/networks/{id}/logs',
    summary: 'Aggregated logs',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Logs' } }
  });

  registry.registerPath({
    method: 'get',
    path: '/api/networks/{id}/nodes',
    summary: 'List nodes in a network',
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: { description: 'Containers' } }
  });

  registry.registerPath({
    method: 'post',
    path: '/api/networks/{id}/nodes',
    summary: 'Add node to a network',
    request: {
      params: z.object({ id: z.string() }),
      body: { content: { 'application/json': { schema: AddNodeSchema } } }
    },
    responses: { 201: { description: 'Created' }, 400: { description: 'Validation error' } }
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/networks/{id}/nodes/{containerId}',
    summary: 'Remove node from network',
    request: { params: z.object({ id: z.string(), containerId: z.string() }) },
    responses: { 200: { description: 'Removed' } }
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Besu Web2 API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }]
  });
}
