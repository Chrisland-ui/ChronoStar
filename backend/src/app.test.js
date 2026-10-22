import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import pino from "pino";
import { createApp } from "./app.js";
import { createEventStore } from "./store.js";

const VALID_ADDRESS = "GBXGQJYF4VCR6J7QCRDMYNCHTSONGZXYQHG7OFNZFLZJGXA7ZUGA7AJE";

const silentLog = pino({ level: "silent" });

function clientsWith(readContract) {
  const client = {
    readContract,
    scvU64: (v) => v,
    scvU32: (v) => v,
    scvAddress: (a) => a,
    scvVecU64: (v) => v,
  };
  return {
    vault: { client, contractId: "C-VAULT" },
    stream: { client, contractId: "C-STREAM" },
    dca: { client, contractId: "C-DCA" },
  };
}

function appWith(readContract = async () => null, options) {
  return createApp(clientsWith(readContract), silentLog, createEventStore("memory"), options);
}

describe("unknown routes", () => {
  it("returns a JSON 404 with a machine-readable code", async () => {
    const res = await request(appWith()).get("/api/nope");
    assert.strictEqual(res.status, 404);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.deepStrictEqual(res.body, { error: "Route not found.", code: "NOT_FOUND" });
  });

  it("returns JSON for unknown routes outside /api and for other methods", async () => {
    const app = appWith();
    const root = await request(app).get("/");
    assert.strictEqual(root.status, 404);
    assert.strictEqual(root.body.code, "NOT_FOUND");
    const post = await request(app).post("/api/streams/" + VALID_ADDRESS);
    assert.strictEqual(post.status, 404);
    assert.strictEqual(post.body.code, "NOT_FOUND");
  });
});

describe("error bodies", () => {
  it("reports INTERNAL_ERROR without leaking the internal message", async () => {
    const app = appWith(async () => {
      throw new Error("secret rpc credentials at http://internal:8000");
    });
    const res = await request(app).get(`/api/schedules/${VALID_ADDRESS}`);
    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.body, { error: "internal server error", code: "INTERNAL_ERROR" });
    assert.ok(!JSON.stringify(res.body).includes("secret"));
  });

  it("logs the internal error message server-side", async () => {
    const lines = [];
    const log = pino({ level: "error" }, { write: (line) => lines.push(JSON.parse(line)) });
    const app = createApp(
      clientsWith(async () => {
        throw new Error("boom detail");
      }),
      log,
      createEventStore("memory"),
    );
    await request(app).get(`/api/schedules/${VALID_ADDRESS}`);
    assert.ok(lines.some((l) => l.err === "boom detail"));
  });

  it("keeps client errors from middleware as 4xx with a code", async () => {
    const res = await request(appWith())
      .post("/api/streams")
      .set("Content-Type", "application/json")
      .send('{"broken":');
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, { error: "Bad request.", code: "BAD_REQUEST" });
  });

  it("adds a code to an invalid address response", async () => {
    const res = await request(appWith()).get("/api/streams/not-valid");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, "INVALID_ADDRESS");
    assert.match(res.body.error, /Invalid Stellar address/);
  });

  it("adds codes to the DCA history errors", async () => {
    const app = appWith(async (_id, method) => (method === "get_dcas_by_owner" ? [1] : null));
    const badId = await request(app).get(`/api/dca/${VALID_ADDRESS}/abc/history`);
    assert.strictEqual(badId.status, 400);
    assert.strictEqual(badId.body.code, "INVALID_DCA_ID");
    const missing = await request(app).get(`/api/dca/${VALID_ADDRESS}/9/history`);
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.code, "DCA_NOT_FOUND");
  });

  it("keeps the INVALID_LIMIT code on /api/events", async () => {
    const res = await request(appWith()).get("/api/events?limit=abc");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, "INVALID_LIMIT");
  });
});

describe("GET /healthz", () => {
  it("reports ok for a valid configuration", async () => {
    const res = await request(appWith()).get("/healthz");
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { status: "ok" });
  });

  it("reports 503 with the problems when the configuration is invalid", async () => {
    const problems = [
      "At least one of VAULT_CONTRACT_ID, STREAM_CONTRACT_ID, DCA_CONTRACT_ID must be set",
    ];
    const res = await request(appWith(undefined, { configProblems: problems })).get("/healthz");
    assert.strictEqual(res.status, 503);
    assert.deepStrictEqual(res.body, { status: "error", code: "INVALID_CONFIG", problems });
  });
});
