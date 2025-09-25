// ============================================================
// index.mjs - Helpers for Besu network automation
// Requires: ethers v6, elliptic, js-sha3
// ============================================================

import fs from 'fs';
import elliptic from 'elliptic';
import sha3 from 'js-sha3';
import { ethers } from 'ethers';

const { ec: EC } = elliptic;
const { keccak_256 } = sha3;
const ec = new EC('secp256k1');

/**
 * Convert a 32 byte private key to the uncompressed 65 byte public key buffer.
 * Besu nodekeys are stored as raw hex private keys, so this is the first step
 * when translating a nodekey to an Ethereum address.
 */
function privToPubUncompressed(privHex) {
  const key = ec.keyFromPrivate(privHex, 'hex');
  const pub = key.getPublic();
  const x = pub.getX().toArray('be', 32);
  const y = pub.getY().toArray('be', 32);
  return Buffer.concat([Buffer.from([0x04]), Buffer.from(x), Buffer.from(y)]);
}
/**
 * Derive the EOA address associated with an uncompressed public key.
 * Only the x/y coordinates (without the 0x04 prefix) are hashed with keccak.
 */
function pubToAddress(pubUncompressed) {
  const hash = keccak_256(pubUncompressed.slice(1));
  return "0x" + hash.slice(24);
}
/**
 * Read a Besu nodekey from disk and return the lowercase account address.
 */
function nodekeyFileToAddress(nodekeyPath) {
  const privHex = fs.readFileSync(nodekeyPath, 'utf8').trim();
  const pub = privToPubUncompressed(privHex);
  return pubToAddress(pub).toLowerCase();
}

/**
 * Read a Besu nodekey from disk and return the hex encoded uncompressed public key.
 */
function nodekeyFileToPublicKey(nodekeyPath) {
  const privHex = fs.readFileSync(nodekeyPath, 'utf8').trim();
  const pub = privToPubUncompressed(privHex);
  return Buffer.from(pub.slice(1)).toString('hex');
}

/**
 * Build the Clique extraData field containing vanity bytes, sorted signers and
 * a 65 byte placeholder signature. Besu expects signers in lowercase.
 */
function buildCliqueExtraData(signers) {
  const uniq = Array.from(new Set(signers.map((s) => s.toLowerCase())));
  uniq.sort();
  const vanity = Buffer.alloc(32, 0);
  const sig = Buffer.alloc(65, 0);
  const addrs = Buffer.concat(uniq.map((a) => Buffer.from(a.slice(2), 'hex')));
  return "0x" + Buffer.concat([vanity, addrs, sig]).toString('hex');
}

/**
 * Produce a minimal Clique genesis file for Besu that disables London/Berlin
 * forks and uses the provided accounts as initial signers and allocations.
 */
function buildGenesis(chainId, epoch, blockPeriod, signers, allocs) {
  return {
    config: {
      chainId,
      berlinBlock: 0,
      londonBlock: 0,
      clique: { blockperiodseconds: blockPeriod, epochlength: epoch }
    },
    nonce: "0x0",
    timestamp: "0x0",
    extraData: buildCliqueExtraData(signers),
    gasLimit: "0x47b760",
    difficulty: "0x1",
    mixHash: "0x" + "00".repeat(32),
    coinbase: "0x" + "00".repeat(20),
    alloc: allocs,
    number: "0x0",
    gasUsed: "0x0",
    parentHash: "0x" + "00".repeat(32)
  };
}

/**
 * Deterministically derive the first N accounts from a mnemonic + derivation path.
 */
function deriveFirstNAccounts(mnemonic, basePath, n) {
  const root = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, "m");
  const rel = basePath.startsWith("m/") ? basePath.slice(2) : basePath;
  const res = [];
  for (let i = 0; i < n; i++) {
    const child = root.derivePath(`${rel}/${i}`);
    res.push({ index: i, address: child.address, privateKey: child.privateKey });
  }
  return res;
}
/**
 * Turn a derived account list into Besu alloc entries with 10k ETH each.
 */
function buildAllocsFromAccounts(accounts) {
  const balanceHex = "0x" + (10_000n * 10n ** 18n).toString(16);
  const allocs = {};
  for (const a of accounts) allocs[a.address.toLowerCase()] = { balance: balanceHex };
  return allocs;
}

/**
 * Send 1 ETH from account[0] to each derived account and report their balances.
 */
async function fundAndCheck(rpcUrl, chainId, mnemonic, basePath, n) {
  const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: Number(chainId), name: "besu-clique" });
  const accounts = deriveFirstNAccounts(mnemonic, basePath, n);
  const sender = new ethers.Wallet(accounts[0].privateKey, provider);
  for (let i = 1; i < accounts.length; i++) {
    const fee = await provider.getFeeData();
    const tx = await sender.sendTransaction({
      to: accounts[i].address,
      value: ethers.parseEther("1"),
      maxFeePerGas: fee.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas ?? 0n
    });
    await tx.wait();
  }
  const balances = [];
  for (const a of accounts) {
    const bal = await provider.getBalance(a.address);
    balances.push({ index: a.index, address: a.address, balanceWei: bal.toString(), balanceEther: ethers.formatEther(bal) });
  }
  return { rpcUrl, chainId, basePath, funded: accounts.length - 1, balances };
}

/**
 * Simple CLI entry point that dispatches to the helper functions above.
 */
async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === 'derive-address-from-nodekey') {
    const nodekeyPath = args[0];
    console.log(nodekeyFileToAddress(nodekeyPath));
    return;
  }
  if (cmd === 'public-key-from-nodekey') {
    const nodekeyPath = args[0];
    console.log(nodekeyFileToPublicKey(nodekeyPath));
    return;
  }
  if (cmd === 'build-allocs') {
    const [mnemonic, basePath, nStr] = args;
    const accounts = deriveFirstNAccounts(mnemonic, basePath, Number(nStr));
    console.log(JSON.stringify(buildAllocsFromAccounts(accounts), null, 2));
    return;
  }
  if (cmd === 'build-genesis') {
    const [chainIdStr, epochStr, blockPeriodStr, signerCsv, allocsPath] = args;
    const allocs = JSON.parse(fs.readFileSync(allocsPath, 'utf8'));
    const signers = signerCsv.split(',').map((s) => s.toLowerCase());
    const g = buildGenesis(Number(chainIdStr), Number(epochStr), Number(blockPeriodStr), signers, allocs);
    console.log(JSON.stringify(g, null, 2));
    return;
  }
  if (cmd === 'fund-and-check') {
    const [rpcUrl, chainIdStr, mnemonic, basePath, nStr] = args;
    const out = await fundAndCheck(rpcUrl, Number(chainIdStr), mnemonic, basePath, Number(nStr));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.error("Usage:");
  console.error("  derive-address-from-nodekey <nodekey.hex>");
  console.error("  public-key-from-nodekey <nodekey.hex>");
  console.error("  build-allocs <mnemonic> <basePath> <N>");
  console.error("  build-genesis <chainId> <epoch> <blockPeriod> <signerCsv> <allocs.json>");
  console.error("  fund-and-check <rpcUrl> <chainId> <mnemonic> <basePath> <N>");
  process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
