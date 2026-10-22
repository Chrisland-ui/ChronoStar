import { describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import http from "node:http";
import { createLiveStreamRouter } from "./live-stream.js";

describe("Live Stream SSE Router", () => {
  it("GET /api/stream sets SSE headers and streams updates", async () => {
    const clients = {
      vault: {
        client: {
          readContract: async () => 5,
        },
        contractId: "C...",
      },
    };

    const app = express();
    app.use("/api/stream", createLiveStreamRouter(clients, undefined, 100));

    await new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const { port } = server.address();
        const req = http.get(`http://127.0.0.1:${port}/api/stream`, (res) => {
          assert.match(res.headers["content-type"], /text\/event-stream/);
          assert.strictEqual(res.headers["cache-control"], "no-cache");
          assert.strictEqual(res.headers["connection"], "keep-alive");

          let data = "";
          res.on("data", (chunk) => {
            data += chunk.toString();
            if (data.includes("event: schedule-update")) {
              assert.strictEqual(data.includes(": connected"), true);
              req.destroy();
              server.close(() => resolve());
            }
          });
        });

        req.on("error", (err) => {
          if (err.code !== "ECONNRESET") reject(err);
        });
      });
    });
  });
});
