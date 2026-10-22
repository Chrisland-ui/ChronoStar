export const DEFAULT_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const DEFAULT_MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function getNetworkPassphrase(): string {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE) {
      return process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
    }
    if (process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE) {
      return process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
    }
    const env = (
      process.env.NEXT_PUBLIC_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "testnet"
    ).toLowerCase();
    if (env === "mainnet" || env === "production") {
      return DEFAULT_MAINNET_PASSPHRASE;
    }
  }
  return DEFAULT_TESTNET_PASSPHRASE;
}

export const config = {
  vaultContractId:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_VAULT_CONTRACT_ID) || "",
  streamContractId:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STREAM_CONTRACT_ID) || "",
  dcaContractId: (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DCA_CONTRACT_ID) || "",
  rpcUrl:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_STELLAR_RPC_URL) ||
    "https://soroban-testnet.stellar.org",
  networkPassphrase: getNetworkPassphrase(),
  environment:
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ENVIRONMENT) || "testnet",
};
