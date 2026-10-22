import { Router } from "express";
import { eventsLimiter } from "../middleware.js";

export function createEventsRouter(clients, logger, store) {
  const router = Router();

  router.get("/", eventsLimiter, async (req, res, next) => {
    const correlationId = req.id;
    if (logger && typeof logger.info === "function") {
      logger.info({ correlationId });
    }

    let limit = 50;
    if (req.query.limit !== undefined) {
      const parsed = Number(req.query.limit);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({
          error: "Invalid limit parameter. Must be a positive integer between 1 and 100.",
          code: "INVALID_LIMIT",
        });
      }
      limit = Math.min(parsed, 100);
    }

    try {
      const events = [];

      for (const [key, { client, contractId }] of Object.entries(clients)) {
        const countFn =
          key === "vault" ? "vault_count" : key === "stream" ? "stream_count" : "dca_count";
        const getFn = key === "vault" ? "get_vault" : key === "stream" ? "get_stream" : "get_dca";
        const statusField = "status";
        const timeField =
          key === "vault"
            ? "release_ledger"
            : key === "stream"
              ? "end_ledger"
              : "next_execution_ledger";

        const count = await client.readContract(contractId, countFn, []);
        if (!count) continue;

        const current = await client.readContract(contractId, "current_ledger", []);

        for (let i = 1; i <= count; i++) {
          const item = await client.readContract(contractId, getFn, [client.scvU64(i)]);
          if (!item || item[statusField] !== 0) continue;

          const targetLedger = item[timeField];
          events.push({
            type: key,
            id: i,
            targetLedger,
            remainingLedgers: targetLedger - current,
          });
        }
      }

      events.sort((a, b) => a.remainingLedgers - b.remainingLedgers);
      if (store) await store.append(events);
      res.json(events.slice(0, limit));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
