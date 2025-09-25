#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Besu Clique automation with transaction smoke test
# - Parametric bootnodes/miners/RPC nodes
# - Prefund via genesis: 10 mnemonic accounts + all miner coinbases
# - Validates the chain by transferring funds across derived accounts
# - Readiness: RPC up and ≥1 peer. Prints peers and block in DECIMAL.
# ============================================================

# ---------------- Defaults ----------------
CHAIN_ID=13371337
EPOCH=30000
BLOCK_PERIOD=4
IMAGE="hyperledger/besu:latest"
NETWORK_NAME="besu-net"
SUBNET_CIDR="172.28.0.0/16"
BOOTNODES=1
MINERS=1
RPC_PORTS_CSV="8545,8546"
MNEMONIC="test test test test test test test test test test test junk"
DERIVATION_PATH="m/44'/60'/0'/0"
TX_ACCOUNT_COUNT=10
ROOT_DIR="$(pwd)/network"
NODE_HELPER="./index.mjs"
FRESH=0
: "${READINESS_TIMEOUT_SECS:=180}"
: "${VERBOSE:=0}"

# ---------------- Utilities ----------------
log(){ printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }
need docker; need node; need jq; need openssl; need curl; need sed; need awk

# Hex → decimal safe
hex_to_dec(){ local h="${1:-}"; [[ "$h" =~ ^0x[0-9a-fA-F]+$ ]] || { echo 0; return; }; echo $((16#${h:2})); }

# ---------------- Arg parsing --------------
CMD="${1:-}"; shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-ports)   RPC_PORTS_CSV="${2:?}"; shift 2;;
    --chain-id)    CHAIN_ID="${2:?}"; shift 2;;
    --epoch)       EPOCH="${2:?}"; shift 2;;
    --blockperiod) BLOCK_PERIOD="${2:?}"; shift 2;;
    --image)       IMAGE="${2:?}"; shift 2;;
    --network)     NETWORK_NAME="${2:?}"; shift 2;;
    --bootnodes)   BOOTNODES="${2:?}"; shift 2;;
    --miners)      MINERS="${2:?}"; shift 2;;
    --fresh)       FRESH=1; shift;;
    --verbose)     VERBOSE=1; shift;;
    *) break;;
  esac
done

# ---------------- Name helpers -------------
miner_dir() {
  local idx="$1"
  if (( MINERS == 1 )); then
    echo "${ROOT_DIR}/miner"
  else
    echo "${ROOT_DIR}/miner${idx}"
  fi
}
bootnode_dir() {
  local idx="$1"
  if (( BOOTNODES == 1 )); then
    echo "${ROOT_DIR}/bootnode"
  else
    echo "${ROOT_DIR}/bootnode${idx}"
  fi
}
miner_name() {
  local idx="$1"
  if (( MINERS == 1 )); then
    echo "besu-miner"
  else
    echo "besu-miner${idx}"
  fi
}
bootnode_name() {
  local idx="$1"
  if (( BOOTNODES == 1 )); then
    echo "besu-bootnode"
  else
    echo "besu-bootnode${idx}"
  fi
}
rpc_name()      { echo "besu-rpc$1"; }
bootnode_enode_file(){ echo "$(bootnode_dir "$1")/enode.txt"; }
bootnode_pubkey_file(){ echo "$(bootnode_dir "$1")/publickey.hex"; }

# ---- Cleanup helpers ----
list_besu_containers(){ docker ps -a --format '{{.Names}}' | grep -E '^(besu-bootnode|besu-miner|besu-rpc)' || true; }
kill_all_besu_containers(){ mapfile -t arr < <(list_besu_containers); ((${#arr[@]})) && docker rm -f "${arr[@]}" >/dev/null 2>&1 || true; }
kill_all_besu_networks(){
  mapfile -t nets < <(docker network ls --format '{{.Name}} {{.Labels}}' | awk '/besu.owner=pfm25/ {print $1}')
  nets+=("${NETWORK_NAME}" "besu-net")
  readarray -t nets < <(printf "%s\n" "${nets[@]}" | awk '!seen[$0]++')
  for n in "${nets[@]}"; do docker network rm "$n" >/dev/null 2>&1 || true; done
}

# ---------------- Node env -----------------
ensure_node_env() {
  if [[ ! -f package.json ]]; then
    cat > package.json <<'JSON'
{
  "name": "besu-cli",
  "version": "0.0.1",
  "type": "module",
  "dependencies": {
    "ethers": "^6",
    "elliptic": "^6",
    "js-sha3": "^0.9"
  }
}
JSON
  else
    if ! jq -e '.type=="module"' package.json >/dev/null 2>&1; then
      tmp=$(mktemp); jq '.type="module"' package.json > "$tmp" && mv "$tmp" package.json
    fi
    for dep in ethers elliptic js-sha3; do
      if ! jq -e ".dependencies[\"$dep\"]" package.json >/dev/null 2>&1; then
        tmp=$(mktemp); jq ".dependencies[\"$dep\"]=\"^6\"" package.json > "$tmp" && mv "$tmp" package.json
      fi
    done
  fi
  [[ -d node_modules ]] || npm install >/dev/null
}
write_node_helper_if_missing(){ [[ -f "${NODE_HELPER}" ]] || die "Missing ${NODE_HELPER}"; }

# ---------------- FS + network -------------
clean_everything(){ kill_all_besu_containers; kill_all_besu_networks; rm -rf "${ROOT_DIR}"; }
create_dirs(){
  mkdir -p "${ROOT_DIR}"
  for i in $(seq 1 "${BOOTNODES}"); do mkdir -p "$(bootnode_dir "$i")/data"; done
  for i in $(seq 1 "${MINERS}");    do mkdir -p "$(miner_dir "$i")/data";    done
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"; for p in "${ports[@]}"; do mkdir -p "${ROOT_DIR}/rpc${p}/data"; done
}
ensure_docker_network(){ docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1 || docker network create --subnet "${SUBNET_CIDR}" --label besu.owner=pfm25 "${NETWORK_NAME}" >/dev/null; }
gen_hex32(){ openssl rand -hex 32; }

generate_keys_and_addresses() {
  for i in $(seq 1 "${BOOTNODES}"); do
    local f="$(bootnode_dir "$i")/nodekey.hex"
    local pub="$(bootnode_pubkey_file "$i")"
    if [[ $FRESH -eq 1 || ! -f "$f" ]]; then gen_hex32 > "$f"; fi
    if [[ $FRESH -eq 1 || ! -f "$pub" ]]; then node "${NODE_HELPER}" public-key-from-nodekey "$f" > "$pub"; fi
  done
  for i in $(seq 1 "${MINERS}"); do
    local k="$(miner_dir "$i")/nodekey.hex"; local a="$(miner_dir "$i")/address.txt"
    if [[ $FRESH -eq 1 || ! -f "$k" ]]; then gen_hex32 > "$k"; fi
    if [[ $FRESH -eq 1 || ! -f "$a" ]]; then node "${NODE_HELPER}" derive-address-from-nodekey "$k" > "$a"; fi
  done
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  for p in "${ports[@]}"; do
    local k="${ROOT_DIR}/rpc${p}/nodekey.hex"; if [[ $FRESH -eq 1 || ! -f "$k" ]]; then gen_hex32 > "$k"; fi
  done
}

build_allocs_and_genesis() {
  # Base allocs: 10 mnemonic accounts
  if [[ $FRESH -eq 1 || ! -f "${ROOT_DIR}/allocs.json" ]]; then
    node "${NODE_HELPER}" build-allocs "${MNEMONIC}" "${DERIVATION_PATH}" 10 > "${ROOT_DIR}/allocs.json"
  fi
  # Ensure each miner coinbase is also prefunded in genesis (same amount as mnemonic allocs)
  local balance_hex
  balance_hex="$(jq -r 'to_entries[0].value.balance' "${ROOT_DIR}/allocs.json")"
  local jq_script='.'
  for i in $(seq 1 "${MINERS}"); do
    local addr; addr="$(cat "$(miner_dir "$i")/address.txt")"
    jq_script="${jq_script} | .[\"${addr,,}\"]={\"balance\":\"${balance_hex}\"}"
  done
  tmp=$(mktemp); jq "${jq_script}" "${ROOT_DIR}/allocs.json" > "${tmp}" && mv "${tmp}" "${ROOT_DIR}/allocs.json"

  # Genesis with all miners as Clique signers
  local csv=""; for i in $(seq 1 "${MINERS}"); do local a; a="$(cat "$(miner_dir "$i")/address.txt")"; csv="${csv:+$csv,}${a}"; done
  if [[ $FRESH -eq 1 || ! -f "${ROOT_DIR}/genesis.json" ]]; then
    node "${NODE_HELPER}" build-genesis "${CHAIN_ID}" "${EPOCH}" "${BLOCK_PERIOD}" "${csv}" "${ROOT_DIR}/allocs.json" > "${ROOT_DIR}/genesis.json"
  fi
}

# -------- Bootnodes --------
start_bootnodes_and_get_enodes() {
  local enodes=()
  for i in $(seq 1 "${BOOTNODES}"); do
    local cname; cname="$(bootnode_name "$i")"
    docker rm -f "${cname}" >/dev/null 2>&1 || true
    docker run -d --name "${cname}" --network "${NETWORK_NAME}" \
      -v "$(bootnode_dir "$i"):/conf" -v "${ROOT_DIR}:/net:ro" "${IMAGE}" \
      --data-path=/conf/data --genesis-file=/net/genesis.json \
      --node-private-key-file=/conf/nodekey.hex --network-id="${CHAIN_ID}" \
      --p2p-port=30303 --rpc-http-enabled=true --rpc-http-host=0.0.0.0 \
      --rpc-http-port=8545 --rpc-http-api=ADMIN,NET,WEB3 \
      --host-allowlist=* --sync-mode=FULL --logging=INFO >/dev/null

    # Resolve enode
    local ip resp raw eno
    for _ in {1..90}; do
      ip="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${cname}" 2>/dev/null || true)"
      [[ -n "${ip}" ]] || { sleep 1; continue; }
      curl -s "http://${ip}:8545" >/dev/null 2>&1 || { sleep 1; continue; }
      resp="$(curl -s -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' "http://${ip}:8545" || true)"
      [[ -n "${resp}" ]] || { sleep 1; continue; }
      raw="$(printf '%s' "${resp}" | jq -r '.result.enode' 2>/dev/null || echo null)"
      if [[ -n "${raw}" && "${raw}" != "null" ]]; then
        eno="$(printf "%s" "${raw}" | sed -E "s/@[^:]+:[0-9]+/@${ip}:30303/")"
        printf '%s\n' "${eno}" > "$(bootnode_enode_file "$i")"
        enodes+=("${eno}"); break
      fi
      sleep 1
    done
  done
  (IFS=','; echo "${enodes[*]}")
}

# -------- Miners y RPC --------
start_miners_and_rpcs() {
  local bootnodes_csv="$1"

  # Miners
  for i in $(seq 1 "${MINERS}"); do
    local cname; cname="$(miner_name "$i")"
    docker rm -f "${cname}" >/dev/null 2>&1 || true
    docker run -d --name "${cname}" --network "${NETWORK_NAME}" \
      -v "$(miner_dir "$i"):/conf" -v "${ROOT_DIR}:/net:ro" "${IMAGE}" \
      --data-path=/conf/data --genesis-file=/net/genesis.json \
      --node-private-key-file=/conf/nodekey.hex --network-id="${CHAIN_ID}" \
      --bootnodes="${bootnodes_csv}" --p2p-port=30303 --discovery-enabled=true \
      --sync-mode=FULL --rpc-http-enabled=false --host-allowlist=* \
      --miner-enabled=true --miner-coinbase="$(cat "$(miner_dir "$i")/address.txt")" \
      --logging=INFO >/dev/null
  done

  # RPC nodes
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  for p in "${ports[@]}"; do
    local cname; cname="$(rpc_name "$p")"
    docker rm -f "${cname}" >/dev/null 2>&1 || true
    docker run -d --name "${cname}" --network "${NETWORK_NAME}" -p "${p}:8545" \
      -v "${ROOT_DIR}/rpc${p}:/conf" -v "${ROOT_DIR}:/net:ro" "${IMAGE}" \
      --data-path=/conf/data --genesis-file=/net/genesis.json \
      --node-private-key-file=/conf/nodekey.hex --network-id="${CHAIN_ID}" \
      --bootnodes="${bootnodes_csv}" --p2p-port=30303 --discovery-enabled=true \
      --sync-mode=FULL --rpc-http-enabled=true --rpc-http-host=0.0.0.0 \
      --rpc-http-port=8545 --rpc-http-api=ETH,NET,WEB3,ADMIN,CLIQUE \
      --host-allowlist=* --logging=INFO >/dev/null
  done
}

# ---------------- RPC helpers ----------------
rpc_call(){ local url="$1"; shift; curl -s -H "Content-Type: application/json" -d "$*" "$url"; }

diagnostics_snapshot() {
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  local rpc="http://127.0.0.1:${ports[0]}"
  local peers_hex bn_hex
  peers_hex="$(rpc_call "$rpc" '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
  bn_hex="$(rpc_call "$rpc"    '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
  log "Diagnostics:"
  echo "peers(dec): $(hex_to_dec "$peers_hex")"
  echo "block(dec): $(hex_to_dec "$bn_hex")"
  echo "signers:"; rpc_call "$rpc" '{"jsonrpc":"2.0","method":"clique_getSigners","params":["latest"],"id":1}' | jq -r '.result[]'
}

wait_ready() {
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  local rpc="http://127.0.0.1:${ports[0]}"

  log "Waiting for RPC at ${rpc}"
  for i in {1..90}; do curl -s "${rpc}" >/dev/null 2>&1 && break; printf "."; sleep 1; done; echo

  log "Waiting for >=1 peer"
  for i in $(seq 1 "${READINESS_TIMEOUT_SECS}"); do
    local peers_hex peers; peers_hex="$(rpc_call "$rpc" '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
    peers="$(hex_to_dec "$peers_hex")"
    [[ ${VERBOSE:-0} -eq 1 ]] && printf "[%s] peers=%d\n" "$(date +%H:%M:%S)" "$peers" || printf "[peers=%d]\r" "$peers"
    [[ "$peers" -ge 1 ]] && { [[ ${VERBOSE:-0} -eq 0 ]] && echo; break; }
    sleep 1
  done

  # Print head block in decimal once
  local bn_hex; bn_hex="$(rpc_call "$rpc" '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
  log "RPC ready. peers(dec)=$(hex_to_dec "$peers_hex") block(dec)=$(hex_to_dec "$bn_hex")"
}

smoke_transactions() {
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  local rpc="http://127.0.0.1:${ports[0]}"
  local tmp; tmp="$(mktemp)"
  log "Running transaction smoke test against ${rpc}"
  if ! node "${NODE_HELPER}" fund-and-check "${rpc}" "${CHAIN_ID}" "${MNEMONIC}" "${DERIVATION_PATH}" "${TX_ACCOUNT_COUNT}" >"${tmp}" 2>&1; then
    log "Smoke test failed. Output:"; cat "${tmp}" >&2; rm -f "${tmp}"; die "Transaction smoke test failed"
  fi
  if ! jq -e ".funded >= (${TX_ACCOUNT_COUNT}-1)" "${tmp}" >/dev/null 2>&1; then
    log "Unexpected smoke test result:"; cat "${tmp}"; rm -f "${tmp}"; die "Transaction funding check failed"
  fi
  log "Smoke test balances:"; jq '.balances' "${tmp}" || true
  rm -f "${tmp}"
}

cmd_status() {
  IFS=',' read -r -a ports <<< "${RPC_PORTS_CSV}"
  local rpc="http://127.0.0.1:${ports[0]}"
  local peers_hex bn_hex
  peers_hex="$(rpc_call "$rpc" '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
  bn_hex="$(rpc_call "$rpc"    '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' 2>/dev/null || echo 0x0)"
  log "Status"
  echo "peers(dec): $(hex_to_dec "$peers_hex")"
  echo "block(dec): $(hex_to_dec "$bn_hex")"
  echo "signers:"; rpc_call "$rpc" '{"jsonrpc":"2.0","method":"clique_getSigners","params":["latest"],"id":1}' | jq -r '.result[]'
}

cmd_logs() {
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo
  mapfile -t names < <(list_besu_containers)
  for n in "${names[@]}"; do docker logs --tail 80 "$n" 2>/dev/null || true; done
}

cmd_down(){ kill_all_besu_containers; }
cmd_destroy(){ kill_all_besu_containers; kill_all_besu_networks; rm -rf "${ROOT_DIR}"; }

# ---------------- Entry ---------------------
case "${CMD}" in
  up)       if [[ $FRESH -eq 1 ]]; then log "Fresh run: cleaning all previous resources"; clean_everything; else log "Reusing existing data if present (no cleanup)"; fi
            write_node_helper_if_missing
            ensure_node_env
            create_dirs
            ensure_docker_network
            generate_keys_and_addresses
            build_allocs_and_genesis
            enodes="$(start_bootnodes_and_get_enodes)"; log "Bootnodes: ${enodes}"
            start_miners_and_rpcs "${enodes}"
            log "Containers after start:"; docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            mapfile -t dead < <(docker ps -a --filter "name=^/besu-" --filter "status=exited" --format '{{.Names}}')
            if ((${#dead[@]})); then
              log "Some nodes exited unexpectedly:"; printf ' - %s\n' "${dead[@]}"
              for n in "${dead[@]}"; do echo "---- logs: $n ----"; docker logs "$n" 2>&1 | tail -n 120 || true; done
              die "Startup failed due to exited containers"
            fi
            wait_ready
            smoke_transactions
            diagnostics_snapshot
            log "Network ready. Transaction smoke test completed."
            ;;
  logs)     cmd_logs ;;
  down)     cmd_down ;;
  destroy)  cmd_destroy ;;
  status)   cmd_status ;;
  *)        echo "Usage: $0 {up|logs|down|destroy|status} [--fresh] [--verbose] [--bootnodes N] [--miners N] [--rpc-ports 8545,8546] [--chain-id ID] [--epoch N] [--blockperiod S] [--image IMG] [--network NAME]"; exit 1;;
esac
