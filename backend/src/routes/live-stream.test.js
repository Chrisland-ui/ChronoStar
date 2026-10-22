import { describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import http from "node:http";
import { createLiveStreamRouter, parseLastEventId } from "./live-stream.js";

function makeClients(counter = { n: 0 }) {
  return {
    vault: {
      client: { readContract: async () => ++counter.n },
      contractId: "C...",
    },
  };
}

/** Starts the router on a free port and returns helpers to connect and shut down. */
async function startServer(router) {
  const app = express();
  app.use("/api/stream", router);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const open = [];

  /** Connects and collects frames until `until(data)` is true, then closes the connection. */
  const connect = (headers = {}, path = "/api/stream", until = () => true) =>
    new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}${path}`, { headers }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString();
          if (until(data)) {
            req.destroy();
            resolve({ headers: res.headers, data });
          }
        });
      });
      open.push(req);
      req.on("error", (err) => {
        if (err.code !== "ECONNRESET") reject(err);
      });
    });

  const close = () =>
    new Promise((resolve) => {
      open.forEach((r) => r.destroy());
      server.closeAllConnections?.();
      server.close(() => resolve());
    });

  return { connect, close };
}

const ids = (data) => [...data.matchAll(/^id: (\d+)$/gm)].map((m) => Number(m[1]));
const eventCount = (n) => (data) => ids(data).length >= n;

describe("Live Stream SSE Router", () => {
  it("GET /api/stream sets SSE headers and streams updates", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 100),
    );
    try {
      const { headers, data } = await connect({}, "/api/stream", (d) =>
        d.includes("event: schedule-update"),
      );
      assert.match(headers["content-type"], /text\/event-stream/);
      assert.strictEqual(headers["cache-control"], "no-cache");
      assert.strictEqual(headers["connection"], "keep-alive");
      assert.strictEqual(data.includes(": connected"), true);
    } finally {
      await close();
    }
  });

  it("gives every event a monotonically increasing id", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 30),
    );
    try {
      const { data } = await connect({}, "/api/stream", eventCount(4));
      const seen = ids(data);
      assert.strictEqual(seen[0], 1);
      for (let i = 1; i < seen.length; i++) assert.strictEqual(seen[i], seen[i - 1] + 1);
    } finally {
      await close();
    }
  });

  it("resumes after Last-Event-ID without duplicating events", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 30),
    );
    try {
      const first = await connect({}, "/api/stream", eventCount(3));
      const lastSeen = Math.max(...ids(first.data));

      const resumed = await connect(
        { "Last-Event-ID": String(lastSeen) },
        "/api/stream",
        eventCount(2),
      );
      const seen = ids(resumed.data);
      assert.ok(
        seen.every((id) => id > lastSeen),
        `resumed ids ${seen} should all be > ${lastSeen}`,
      );
      assert.strictEqual(new Set(seen).size, seen.length);
      assert.strictEqual(seen[0], lastSeen + 1);
    } finally {
      await close();
    }
  });

  it("replays exactly the missed events from the buffer", async () => {
    const counter = { n: 0 };
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(counter), undefined, 20),
    );
    try {
      await connect({}, "/api/stream", eventCount(5)); // let events accumulate
      await new Promise((r) => setTimeout(r, 120)); // all clients gone, polling stops
      const stoppedAt = counter.n;
      await new Promise((r) => setTimeout(r, 100));
      assert.strictEqual(counter.n, stoppedAt, "polling should stop when no client is connected");

      const resumed = await connect(
        { "Last-Event-ID": "2" },
        "/api/stream",
        (d) => ids(d).length >= 3,
      );
      assert.deepStrictEqual(ids(resumed.data).slice(0, 3), [3, 4, 5]);
    } finally {
      await close();
    }
  });

  it("bounds the replay buffer and flags a gap", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 10, { replayBufferSize: 3 }),
    );
    try {
      await connect({}, "/api/stream", eventCount(8));
      const resumed = await connect({ "Last-Event-ID": "1" }, "/api/stream", eventCount(3));
      assert.ok(resumed.data.includes(": replay-gap"));
      const seen = ids(resumed.data);
      assert.ok(seen[0] > 2, `buffer should have dropped early events, got ${seen}`);
    } finally {
      await close();
    }
  });

  it("treats a Last-Event-ID from before a restart as a fresh connection", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 1000),
    );
    try {
      const { data } = await connect({ "Last-Event-ID": "9999" }, "/api/stream", eventCount(1));
      assert.deepStrictEqual(ids(data), [1]);
    } finally {
      await close();
    }
  });

  it("accepts the id as a lastEventId query parameter", async () => {
    const { connect, close } = await startServer(
      createLiveStreamRouter(makeClients(), undefined, 30),
    );
    try {
      await connect({}, "/api/stream", eventCount(3));
      const resumed = await connect({}, "/api/stream?lastEventId=2", eventCount(1));
      assert.strictEqual(ids(resumed.data)[0], 3);
    } finally {
      await close();
    }
  });
});

describe("parseLastEventId", () => {
  const req = (header, query) => ({
    get: (name) => (name === "last-event-id" ? header : undefined),
    query: query ?? {},
  });

  it("reads a numeric header or query value", () => {
    assert.strictEqual(parseLastEventId(req("12")), 12);
    assert.strictEqual(parseLastEventId(req(undefined, { lastEventId: "7" })), 7);
    assert.strictEqual(parseLastEventId(req("0")), 0);
  });

  it("ignores missing, non-numeric, negative and oversized values", () => {
    for (const bad of [undefined, "", "abc", "-1", "1.5", "1e3", "99999999999999999999"]) {
      assert.strictEqual(parseLastEventId(req(bad)), null, String(bad));
    }
  });
});
