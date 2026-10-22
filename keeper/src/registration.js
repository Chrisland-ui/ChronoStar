import { logger as defaultLogger } from "./logger.js";

/**
 * Registers the keeper with the coordinator contract at startup (#267).
 *
 * The coordinator only lets a registered keeper take a claim, and an
 * unregistered keeper otherwise looks like contention. Registration is
 * idempotent: an already-registered keeper is a no-op, and the contract's own
 * `register` is safe to repeat. Failure is logged loudly but does not stop the
 * keeper, which keeps running uncoordinated claims out of the picture.
 *
 * @returns {Promise<'disabled'|'already-registered'|'registered'|'failed'>}
 */
export async function registerKeeper(client, cfg, log = defaultLogger) {
  const coordinatorId = cfg.coordinatorContractId;
  if (!coordinatorId) {
    log.info(
      "coordination disabled (COORDINATOR_CONTRACT_ID not set); skipping keeper registration",
    );
    return "disabled";
  }

  try {
    if (await client.isRegistered(coordinatorId)) {
      log.info({ coordinatorId }, "keeper already registered with coordinator");
      return "already-registered";
    }
    await client.register(coordinatorId);
    log.info({ coordinatorId }, "keeper registered with coordinator");
    return "registered";
  } catch (err) {
    log.warn(
      { coordinatorId, err: err.message },
      "keeper registration with coordinator FAILED; claims will be refused until it is registered",
    );
    return "failed";
  }
}

/**
 * Removes the keeper's registration on clean shutdown so another keeper can
 * take over without waiting for the claim TTL. Best effort: never throws.
 *
 * @returns {Promise<'disabled'|'unregistered'|'failed'>}
 */
export async function unregisterKeeper(client, cfg, log = defaultLogger) {
  const coordinatorId = cfg.coordinatorContractId;
  if (!coordinatorId) return "disabled";
  try {
    await client.unregister(coordinatorId);
    log.info({ coordinatorId }, "keeper unregistered from coordinator");
    return "unregistered";
  } catch (err) {
    log.warn({ coordinatorId, err: err.message }, "keeper unregistration failed");
    return "failed";
  }
}
