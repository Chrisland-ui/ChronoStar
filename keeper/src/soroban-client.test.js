import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { SorobanClient } from './soroban-client.js';
import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { Account } from "@stellar/stellar-sdk";
import { SorobanClient } from "./soroban-client.js";
import { config } from "./config.js";

const TEST_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const TEST_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("SorobanClient", () => {
  it("builds transaction with memo and returns correlationId and hash", async () => {
    const client = new SorobanClient();
    client.sourceAccount = new Account(TEST_ACCOUNT, "1");
    client.sourceKeypair = {
      publicKey: () => TEST_ACCOUNT,
      sign: () => {},
    };

    client.server = {
      getAccount: mock.fn(async () => new Account(TEST_ACCOUNT, "1")),
      simulateTransaction: mock.fn(async () => ({
        result: { retval: null },
        transactionData: {},
      })),
      sendTransaction: mock.fn(async () => ({
        status: "SUCCESS",
        hash: "txhash1234567890",
      })),
    };

    const result = await client.invokeContract('C123', 'test_method', [], 'test-correlation-id-12345');
    assert.strictEqual(result.hash, 'txhash1234567890');
    assert.strictEqual(result.correlationId, 'test-correlation-id-12345');
  });

  it('refreshes source account sequence on submission failure', async () => {
    client._assemble = mock.fn(() => ({
      sign: () => {},
    }));

    const result = await client.invokeContract(
      TEST_CONTRACT,
      "test_method",
      [],
      "test-correlation-id-12345",
    );
    assert.strictEqual(result.hash, "txhash1234567890");
    assert.strictEqual(result.correlationId, "test-correlation-id-12345");
    assert.strictEqual(client._assemble.mock.callCount(), 1);
  });

  it("refreshes source account sequence on submission failure", async () => {
    const client = new SorobanClient();
    let getAccountCalls = 0;

    const originalAttempts = config.retryMaxAttempts;
    const originalDelay = config.retryBaseDelayMs;
    config.retryMaxAttempts = 1;
    config.retryBaseDelayMs = 0;

    client.sourceKeypair = {
      publicKey: () => 'GBANKKEY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
      publicKey: () => TEST_ACCOUNT,
      sign: mock.fn(),
    };

    client.server = {
      getAccount: mock.fn(async () => {
        getAccountCalls++;
        return new Account(TEST_ACCOUNT, String(100 + getAccountCalls));
      }),
      simulateTransaction: mock.fn(async () => ({ error: 'sim_error' })),
      simulateTransaction: mock.fn(async () => ({ error: "sim_error" })),
    };

    client.sourceAccount = new Account(TEST_ACCOUNT, "100");

    await assert.rejects(
      async () => {
        await client.invokeContract('C123', 'test_method', []);
      },
      /test_method simulation failed: sim_error/
    );
    assert.strictEqual(getAccountCalls > 0, true);
    try {
      await assert.rejects(
        () => client.invokeContract(TEST_CONTRACT, "test_method", []),
        /test_method simulation failed: sim_error/,
      );
      assert.ok(getAccountCalls > 0);
    } finally {
      config.retryMaxAttempts = originalAttempts;
      config.retryBaseDelayMs = originalDelay;
    }
  });
});
