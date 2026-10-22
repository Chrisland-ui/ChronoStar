export const DEFAULT_SECONDS_PER_LEDGER = 5;

export const SECONDS_PER_LEDGER =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SECONDS_PER_LEDGER
    ? Number(process.env.NEXT_PUBLIC_SECONDS_PER_LEDGER) || DEFAULT_SECONDS_PER_LEDGER
    : DEFAULT_SECONDS_PER_LEDGER;

export const NETWORK_PASSPHRASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE) ||
  "Test SDF Network ; September 2015";

export const STELLAR_RPC_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STELLAR_RPC_URL) ||
  "https://soroban-testnet.stellar.org";

export const VAULT_CONTRACT_ID =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VAULT_CONTRACT_ID) || "";

export const STREAM_CONTRACT_ID =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STREAM_CONTRACT_ID) || "";

export const DCA_CONTRACT_ID =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DCA_CONTRACT_ID) || "";
