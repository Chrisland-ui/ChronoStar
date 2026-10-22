#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONTRACT_DIR="$REPO_ROOT/contract"

cd "$CONTRACT_DIR"

cargo build --release --target wasm32-unknown-unknown --manifest-path "$CONTRACT_DIR/Cargo.toml"

mapfile -t contracts < <(
  cargo metadata --format-version 1 --no-deps --manifest-path "$CONTRACT_DIR/Cargo.toml" \
    | python -c 'import json, sys; data = json.load(sys.stdin); print("\n".join(sorted(pkg["manifest_path"].split("/")[-2] for pkg in data["packages"])))'
)

for contract in "${contracts[@]}"; do
  wasm="$CONTRACT_DIR/target/wasm32-unknown-unknown/release/${contract//-/_}.wasm"
  if [[ ! -f "$wasm" ]]; then
    echo "Missing WASM output for $contract at $wasm" >&2
    exit 1
  fi

  output="$CONTRACT_DIR/$contract/spec.json"
  stellar contract bindings json --wasm "$wasm" --output "$output"
  echo "Wrote $output"
done
