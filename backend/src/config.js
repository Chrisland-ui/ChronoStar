export const config = {
  vaultContractId: process.env.VAULT_CONTRACT_ID || '',
  streamContractId: process.env.STREAM_CONTRACT_ID || '',
  dcaContractId: process.env.DCA_CONTRACT_ID || '',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  port: parseInt(process.env.PORT || '3001', 10),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  publicBaseUrl: process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || '',
};

function parseTrustProxy(value) {
  if (value === undefined || value === '') {
    return process.env.NODE_ENV === 'production' ? 1 : false;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}
