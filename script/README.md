# Besu Network Scripts

The `script` package bundles CLI helpers for building Hyperledger Besu development assets. Use them to derive validator addresses, generate Clique genesis files and fund deterministic accounts before spinning up the network.

## Installation

Install the runtime dependencies in the package directory:

```bash
npm install
```

## Configuration

Most commands operate purely on files and deterministic mnemonics. The `fund-and-check` command requires:

- Access to a JSON-RPC endpoint exposed by a Besu node (`rpcUrl`).
- A chain ID that matches the RPC endpoint.
- An HD mnemonic/base path combination that controls at least one funded account on the network.

Set `HTTP_PROXY` / `HTTPS_PROXY` if your environment requires outbound proxy access when the script needs to reach remote RPC endpoints.

## Usage

Run the commands through Node.js:

```bash
node index.mjs <command> [...args]
```

Available subcommands:

| Command | Description |
| --- | --- |
| `derive-address-from-nodekey <nodekey.hex>` | Print the account address embedded in a Besu `nodekey` file. |
| `public-key-from-nodekey <nodekey.hex>` | Output the uncompressed public key associated with the node key. |
| `build-allocs <mnemonic> <basePath> <N>` | Derive `N` HD accounts and emit a JSON allocation map usable in a genesis file. |
| `build-genesis <chainId> <epoch> <blockPeriod> <signerCsv> <allocs.json>` | Generate a Clique genesis file with the supplied signers and allocation JSON. |
| `fund-and-check <rpcUrl> <chainId> <mnemonic> <basePath> <N>` | Transfer 1 ETH from the first derived account to the rest and report their balances. |

## Examples

- Create a vanity genesis file using a test mnemonic:

  ```bash
  node index.mjs build-allocs "test test test test test test test test test test test junk" "m/44'/60'/0'/0" 5 > allocs.json
  node index.mjs build-genesis 1337 30000 5 "0xabc...,0xdef...,0x123..." allocs.json > genesis.json
  ```

- Fund and verify three wallets on a local network:

  ```bash
  node index.mjs fund-and-check http://127.0.0.1:8545 1337 "test test test test test test test test test test test junk" "m/44'/60'/0'/0" 3
  ```

Refer to the inline comments in [`index.mjs`](./index.mjs) for algorithmic details and extension points.
