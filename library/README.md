# Besu Docker Manager Library

`besu-docker-manager` is a lightweight TypeScript wrapper around [dockerode](https://github.com/apocas/dockerode). It provides high-level helpers tailored to Hyperledger Besu test environments (network creation, container lifecycle management and log inspection).

## Installation

Install the library dependencies and build output:

```bash
npm install
npm run build
```

To link the package in another project locally, run `npm link` after the build.

## Configuration

The constructor accepts the same options as dockerode. Common scenarios include:

- `new DockerManager({ socketPath: '/var/run/docker.sock' })` for local Unix sockets.
- `new DockerManager({ host: '192.168.1.100', port: 2375 })` for unsecured remote daemons.
- Using environment variables `DOCKER_HOST`, `DOCKER_TLS_VERIFY` and `DOCKER_CERT_PATH` to let dockerode pick up context automatically.

Ensure the process has permission to access the Docker endpoint and that the Docker API version matches the daemon version.

## Available npm scripts

- `npm run build` – compile the TypeScript sources to `dist/`.
- `npm test` – run the Jest suite against the compiled output.

## Usage

Import the class in a Node.js project and orchestrate Besu containers:

```ts
import { DockerManager } from 'besu-docker-manager';

const manager = new DockerManager({ socketPath: '/var/run/docker.sock' });
const networkId = await manager.ensureNetwork({ name: 'besu-dev', subnet: '172.21.0.0/16' });
const containerId = await manager.createContainer({
  name: 'besu-node-1',
  Image: 'hyperledger/besu:latest',
  networkName: 'besu-dev',
  Cmd: ['--network=dev']
});
await manager.waitForContainer(containerId, 'running');
```

## Examples

- List all Besu networks tagged with `managed=besu-dev`:

  ```ts
  const networks = await manager.listNetworks({ managed: 'besu-dev' });
  console.table(networks.map(net => ({ name: net.name, containers: net.containers.length })));
  ```

- Execute a JSON-RPC curl command inside a node container:

  ```ts
  const { stdout } = await manager.execInContainer('besu-node-1', {
    cmd: ['curl', '-s', 'http://localhost:8545'],
    workdir: '/opt/besu'
  });
  console.log(stdout);
  ```

Refer to the source in [`src/`](./src) for the complete API surface and additional examples.
