import { describe, it } from "node:test";
import assert from "node:assert";
import { StrKey } from "@stellar/stellar-sdk";
import { getConfigProblems, validateConfig } from "./config.js";

const CONTRACT_A = StrKey.encodeContract(new Uint8Array(32).fill(1));
const CONTRACT_B = StrKey.encodeContract(new Uint8Array(32).fill(2));

function validConfig(overrides = {}) {
  return {
    vaultContractId: CONTRACT_A,
    streamContractId: CONTRACT_B,
    dcaContractId: "",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    port: 3001,
    ...overrides,
  };
}

describe("getConfigProblems / validateConfig", () => {
  it("accepts a valid configuration", () => {
    assert.deepStrictEqual(getConfigProblems(validConfig()), []);
    assert.doesNotThrow(() => validateConfig(validConfig()));
  });

  it("accepts a single configured contract id", () => {
    const cfg = validConfig({ streamContractId: "" });
    assert.deepStrictEqual(getConfigProblems(cfg), []);
  });

  it("rejects a configuration with no contract id", () => {
    const cfg = validConfig({ vaultContractId: "", streamContractId: "", dcaContractId: "" });
    assert.deepStrictEqual(getConfigProblems(cfg), [
      "At least one of VAULT_CONTRACT_ID, STREAM_CONTRACT_ID, DCA_CONTRACT_ID must be set",
    ]);
    assert.throws(() => validateConfig(cfg), /At least one of/);
  });

  it("rejects malformed contract ids, naming the variable but not the value", () => {
    const cfg = validConfig({ vaultContractId: "not-a-contract", dcaContractId: "GABC" });
    const problems = getConfigProblems(cfg);
    assert.deepStrictEqual(problems, [
      "VAULT_CONTRACT_ID is not a valid Stellar contract address",
      "DCA_CONTRACT_ID is not a valid Stellar contract address",
    ]);
    assert.ok(problems.every((p) => !p.includes("not-a-contract")));
  });

  it("rejects an account address given as a contract id", () => {
    const account = "GBXGQJYF4VCR6J7QCRDMYNCHTSONGZXYQHG7OFNZFLZJGXA7ZUGA7AJE";
    assert.strictEqual(getConfigProblems(validConfig({ vaultContractId: account })).length, 1);
  });

  it("rejects an unparseable RPC URL and a non-http protocol", () => {
    assert.deepStrictEqual(getConfigProblems(validConfig({ rpcUrl: "not a url" })), [
      "STELLAR_RPC_URL is not a valid URL",
    ]);
    assert.deepStrictEqual(getConfigProblems(validConfig({ rpcUrl: "ftp://example.com" })), [
      "STELLAR_RPC_URL must use http or https",
    ]);
  });

  it("rejects out-of-range and non-integer ports", () => {
    for (const port of [0, -1, 65536, Number.NaN, 3000.5]) {
      assert.deepStrictEqual(
        getConfigProblems(validConfig({ port })),
        ["PORT must be a whole number between 1 and 65535"],
        `port ${port}`,
      );
    }
    assert.deepStrictEqual(getConfigProblems(validConfig({ port: 1 })), []);
    assert.deepStrictEqual(getConfigProblems(validConfig({ port: 65535 })), []);
  });

  it("rejects an empty network passphrase", () => {
    assert.deepStrictEqual(getConfigProblems(validConfig({ networkPassphrase: "" })), [
      "STELLAR_NETWORK_PASSPHRASE must not be empty",
    ]);
  });

  it("lists every problem at once", () => {
    const cfg = validConfig({
      vaultContractId: "",
      streamContractId: "",
      rpcUrl: "%%%",
      port: 70000,
    });
    const problems = getConfigProblems(cfg);
    assert.strictEqual(problems.length, 3);
    assert.throws(
      () => validateConfig(cfg),
      (err) => {
        assert.match(err.message, /At least one of/);
        assert.match(err.message, /STELLAR_RPC_URL/);
        assert.match(err.message, /PORT/);
        return true;
      },
    );
  });
});
