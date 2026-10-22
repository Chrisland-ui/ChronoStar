import { config, getConfigProblems } from './config.js';
import { logger } from './logger.js';
import { SorobanClient } from './soroban-client.js';
import { createApp } from './app.js';

// Fail fast instead of serving a healthy-looking API that errors on every request.
const configProblems = getConfigProblems();
if (configProblems.length > 0) {
  logger.error(`Invalid backend configuration:\n${configProblems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

const client = new SorobanClient();

const clients = {
  vault: { client, contractId: config.vaultContractId },
  stream: { client, contractId: config.streamContractId },
  dca: { client, contractId: config.dcaContractId },
};

const server = createApp(clients, logger, undefined, { configProblems }).listen(config.port, () => {
  logger.info({ port: config.port }, 'backend listening');
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    logger.info({ signal }, 'draining in-flight connections');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
