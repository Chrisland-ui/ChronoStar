import { STELLAR_RPC_URL } from "./network";

/**
 * Reads the latest closed ledger sequence from a Soroban RPC endpoint.
 * Throws when the endpoint is unreachable or answers with something that is
 * not a positive ledger number, so callers never display a guessed value.
 */
export async function fetchLatestLedger(
  rpcUrl: string = STELLAR_RPC_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const res = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }),
  });
  if (!res.ok) throw new Error(`getLatestLedger failed with status ${res.status}`);
  const body = await res.json();
  const sequence = Number(body?.result?.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("getLatestLedger returned no ledger sequence");
  }
  return sequence;
}
