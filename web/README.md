# Besu Web Dashboard

This Next.js application offers a live overview of Hyperledger Besu development clusters. It surfaces block/head information, exposes quick actions for Docker-based Besu nodes and renders health metrics without depending on external storage.

## Installation

Install dependencies from the package directory:

```bash
npm install
```

## Configuration

Set the following environment variables before running the app:

- `DOCKER_SOCKET` – path to the Docker Engine socket (defaults to `/var/run/docker.sock`).
- `BESU_BASE_DIR` – directory containing Besu configuration files such as `genesis.json` and per-node folders.
- `NEXT_PUBLIC_METRICS_ENABLED` (optional) – toggle custom instrumentation in the UI.
- `PORT` (optional) – override the default Next.js port when running behind a proxy.

Environment variables can be stored in a `.env.local` file during development.

## Usage

Common npm scripts:

- `npm run dev` – start the development server with hot reload at `http://localhost:3000`.
- `npm run build` – create an optimized production build.
- `npm run start` – serve the production build (requires a prior `build`).

Once the server is running:

1. Visit the dashboard and supply the desired Besu network name.
2. Use the "Create network" action to create a Docker bridge with the configured subnet.
3. Add node containers directly from the UI or inspect existing ones discovered on the bridge.
4. Follow the live block feed and use the metrics panel to verify network health.

## Examples

- Start the dashboard against a remote Docker host:

  ```bash
  DOCKER_HOST=tcp://192.168.1.50:2375 BESU_BASE_DIR=$PWD/networks/dev npm run dev
  ```

- Deploy a production build served on port 4000:

  ```bash
  npm run build
  PORT=4000 DOCKER_SOCKET=/var/run/docker.sock NEXT_PUBLIC_METRICS_ENABLED=1 npm run start
  ```

## Features

- Streams new blocks via Server-Sent Events.
- Creates, lists, and removes Docker networks dedicated to Besu nodes.
- Adds Besu nodes with sensible default flags and meshes peers automatically.
- Exposes metrics through `/api/metrics` without any external datastore.
