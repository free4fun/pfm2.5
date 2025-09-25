# Besu Network Toolkit

This monorepo contains a toolkit for bootstrapping and inspecting Hyperledger Besu development networks. The codebase is split into three independent packages:

- [`library`](library/README.md) – a TypeScript helper around Docker used to manage Besu containers and networks.
- [`script`](script/README.md) – Node.js command line tools for generating genesis data and prefunding HD wallets.
- [`web`](web/README.md) – a Next.js dashboard that surfaces live chain information and orchestrates Docker resources.

## Installation

Clone the repository and install the dependencies for each package individually:

```bash
git clone <repo-url>
cd dev
cd library && npm install
cd ../script && npm install
cd ../web && npm install
```

> Each package is versioned and published independently. Installing dependencies in one folder does not affect the others.

## Configuration

The toolkit interacts with a Docker Engine instance. By default, the packages expect the Unix socket at `/var/run/docker.sock`. When Docker listens elsewhere, point the tooling at an alternative endpoint using one of the following variables:

- `DOCKER_HOST` – standard dockerode/CLI endpoint string such as `unix:///var/run/docker.sock` or `tcp://127.0.0.1:2375`.
- `DOCKER_TLS_VERIFY` / `DOCKER_CERT_PATH` – optional TLS configuration when talking to a remote daemon.
- `DOCKER_SOCKET` – bespoke override used by the web dashboard to locate the socket.

Ensure the user executing the commands has permission to access the socket or TCP endpoint.

## Usage overview

- Build the Docker manager library:

  ```bash
  cd library
  npm run build
  ```

- Run genesis helper scripts as needed via `node script/index.mjs <command>`.
- Start the Next.js dashboard with `npm run dev` from the `web` directory to browse network information.
- Provision or tear down multi-node Besu networks with the convenience shell wrapper: `./script.sh up --fresh` or `./script.sh down`.

## Examples

- Create a custom Clique genesis file with three signers and predefined allocations:

  ```bash
  cd script
  node index.mjs build-genesis 2025 30000 5 signer1,signer2,signer3 ./network/allocs.json > genesis.json
  ```

- Use the library programmatically to create a network and container:

  ```ts
  import { DockerManager } from 'besu-docker-manager';

  const manager = new DockerManager({ socketPath: '/var/run/docker.sock' });
  await manager.ensureNetwork({ name: 'besu-dev', subnet: '172.25.0.0/16' });
  await manager.createContainer({
    name: 'besu-node-1',
    Image: 'hyperledger/besu:latest',
    networkName: 'besu-dev'
  });
  ```

Refer to each package specific README for detailed instructions and more scenarios.
