import { describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { Account, Keypair, MuxedAccount, StrKey } from "@stellar/stellar-sdk";
import {
  addressRouteLimiter,
  createLimiter,
  eventsLimiter,
  globalLimiter,
  isValidStellarAddress,
  validateStellarAddress,
} from "./middleware.js";
import { SorobanClient } from "./soroban-client.js";

const G_ADDRESS = Keypair.random().publicKey();
const C_ADDRESS = StrKey.encodeContract(new Uint8Array(32).fill(9));
const M_ADDRESS = new MuxedAccount(new Account(G_ADDRESS, "1"), "42").accountId();

describe("isValidStellarAddress", () => {
  it("accepts a G account address, a C contract address and an M muxed address", () => {
    assert.strictEqual(isValidStellarAddress(G_ADDRESS), true);
    assert.strictEqual(isValidStellarAddress(C_ADDRESS), true);
    assert.strictEqual(isValidStellarAddress(M_ADDRESS), true);
  });

  it("rejects malformed values", () => {
    for (const bad of [
      "",
      "not-an-address",
      "G123",
      G_ADDRESS.slice(0, -1),
      C_ADDRESS.slice(0, -1),
      M_ADDRESS.slice(0, -1),
      C_ADDRESS.replace(/.$/, C_ADDRESS.endsWith("A") ? "B" : "A"),
      "S" + G_ADDRESS.slice(1),
      undefined,
      null,
      42,
    ]) {
      assert.strictEqual(isValidStellarAddress(bad), false, `should reject ${String(bad)}`);
    }
  });
});

describe("validateStellarAddress middleware", () => {
  const app = express();
  app.get("/a/:address", validateStellarAddress, (req, res) =>
    res.json({ ok: req.params.address }),
  );

  it("lets G, C and M addresses through", async () => {
    for (const address of [G_ADDRESS, C_ADDRESS, M_ADDRESS]) {
      const res = await request(app).get(`/a/${address}`);
      assert.strictEqual(res.status, 200, address);
    }
  });

  it("answers 400 for a malformed address and describes the accepted forms", async () => {
    const res = await request(app).get("/a/not-valid");
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /account \(G\.\.\.\)/);
    assert.match(res.body.error, /contract \(C\.\.\.\)/);
    assert.match(res.body.error, /muxed account \(M\.\.\.\)/);
  });
});

describe("SorobanClient.scvAddress", () => {
  const client = new SorobanClient();

  it("encodes G and C addresses", () => {
    assert.strictEqual(client.scvAddress(G_ADDRESS).switch().name, "scvAddress");
    assert.strictEqual(client.scvAddress(C_ADDRESS).switch().name, "scvAddress");
  });

  it("resolves a muxed account to the account it belongs to", () => {
    const fromMuxed = client.scvAddress(M_ADDRESS).toXDR("base64");
    const fromBase = client.scvAddress(G_ADDRESS).toXDR("base64");
    assert.strictEqual(fromMuxed, fromBase);
  });
});

describe("rate limit headers", () => {
  const limiters = { global: globalLimiter, address: addressRouteLimiter, events: eventsLimiter };

  for (const [name, limiter] of Object.entries(limiters)) {
    it(`${name} limiter emits the standard headers and no legacy headers`, async () => {
      const app = express();
      app.use(limiter);
      app.get("/", (_req, res) => res.json({ ok: true }));
      const res = await request(app).get("/");
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers["ratelimit-limit"], "RateLimit-Limit");
      assert.ok(res.headers["ratelimit-remaining"], "RateLimit-Remaining");
      assert.ok(res.headers["ratelimit-reset"], "RateLimit-Reset");
      assert.ok(res.headers["ratelimit-policy"], "RateLimit-Policy");
      assert.strictEqual(res.headers["x-ratelimit-limit"], undefined);
    });
  }

  it("the three limiters report their own limits", async () => {
    const limits = {};
    for (const [name, limiter] of Object.entries(limiters)) {
      const app = express();
      app.use(limiter);
      app.get("/", (_req, res) => res.json({}));
      limits[name] = (await request(app).get("/")).headers["ratelimit-limit"];
    }
    assert.deepStrictEqual(limits, { global: "500", address: "100", events: "50" });
  });

  it("a throttled response carries the limit headers and Retry-After", async () => {
    const app = express();
    app.use(createLimiter({ max: 2, message: "slow down" }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    await request(app).get("/");
    const second = await request(app).get("/");
    assert.strictEqual(second.headers["ratelimit-remaining"], "0");

    const throttled = await request(app).get("/");
    assert.strictEqual(throttled.status, 429);
    assert.deepStrictEqual(throttled.body, { error: "slow down" });
    assert.strictEqual(throttled.headers["ratelimit-limit"], "2");
    assert.strictEqual(throttled.headers["ratelimit-remaining"], "0");
    assert.ok(Number(throttled.headers["ratelimit-reset"]) > 0);
    assert.ok(throttled.headers["retry-after"]);
  });
});
