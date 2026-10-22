import { Router } from "express";

const DEFAULT_REPLAY_BUFFER_SIZE = 100;

/**
 * Parses the id a client says it last received, from the `Last-Event-ID`
 * header (sent automatically by `EventSource`) or, for clients that rebuild
 * the connection themselves, a `lastEventId` query parameter.
 */
export function parseLastEventId(req) {
  const raw =
    req.get?.("last-event-id") ?? req.headers?.["last-event-id"] ?? req.query?.lastEventId;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * Server-sent events for live schedule updates.
 *
 * Every event carries a monotonically increasing `id:`. Events go to every
 * connected client from one shared poller, and the most recent
 * `replayBufferSize` events are kept so a client that reconnects with
 * `Last-Event-ID` receives exactly the events it missed, without duplicates.
 * The buffer is bounded; if the client is further behind than the buffer
 * reaches, it gets the whole buffer and a `: replay-gap` comment. Ids restart
 * at 1 when the server restarts, so an id from a previous run (ahead of the
 * newest id) is treated as a fresh connection.
 */
export function createLiveStreamRouter(
  clients,
  log,
  pollIntervalMs = 5000,
  { replayBufferSize = DEFAULT_REPLAY_BUFFER_SIZE, heartbeatMs = 15000 } = {},
) {
  const router = Router();

  const buffer = [];
  const connections = new Set();
  let nextId = 1;
  let pollTimer = null;
  let publishing = null;

  const frame = (event) =>
    `id: ${event.id}\nevent: schedule-update\ndata: ${JSON.stringify(event.data)}\n\n`;

  const collectStats = async () => {
    const stats = { timestamp: new Date().toISOString(), status: "ok" };
    if (clients && clients.vault) {
      try {
        const vaultCount = await clients.vault.client.readContract(
          clients.vault.contractId,
          "vault_count",
          [],
        );
        stats.vaultCount = vaultCount !== undefined ? Number(vaultCount) : 0;
      } catch {
        // ignore rpc error in stream pulse
      }
    }
    return stats;
  };

  const publish = () => {
    if (publishing) return publishing;
    publishing = (async () => {
      try {
        const event = { id: nextId++, data: await collectStats() };
        buffer.push(event);
        if (buffer.length > replayBufferSize) buffer.shift();
        for (const res of connections) res.write(frame(event));
      } catch (err) {
        if (log) log.warn({ err: err.message }, "SSE stream update failed");
      } finally {
        publishing = null;
      }
    })();
    return publishing;
  };

  const startPolling = () => {
    if (!pollTimer) pollTimer = setInterval(publish, pollIntervalMs);
  };
  const stopPollingIfIdle = () => {
    if (connections.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  router.get("/", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    res.write(": connected\n\n");

    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), heartbeatMs);
    req.on("close", () => {
      clearInterval(heartbeat);
      connections.delete(res);
      stopPollingIfIdle();
      res.end();
    });

    let lastId = parseLastEventId(req);
    if (lastId !== null && lastId >= nextId) lastId = null; // id from before a restart

    // Replay synchronously, before joining the broadcast, so an event
    // published while replaying cannot be delivered twice.
    let needsFreshEvent = true;
    if (lastId !== null) {
      needsFreshEvent = false;
      const missed = buffer.filter((event) => event.id > lastId);
      const oldest = buffer[0];
      if (oldest && lastId < oldest.id - 1) res.write(": replay-gap\n\n");
      for (const event of missed) res.write(frame(event));
    }
    connections.add(res);
    startPolling();

    if (needsFreshEvent) await publish();
  });

  return router;
}
