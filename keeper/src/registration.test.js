import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { registerKeeper, unregisterKeeper } from "./registration.js";

function fakeLog() {
  return { info: mock.fn(), warn: mock.fn(), error: mock.fn() };
}

function fakeClient({ registered = false, registerError, isRegisteredError } = {}) {
  return {
    isRegistered: mock.fn(async () => {
      if (isRegisteredError) throw isRegisteredError;
      return registered;
    }),
    register: mock.fn(async () => {
      if (registerError) throw registerError;
    }),
    unregister: mock.fn(async () => {}),
  };
}

describe("registerKeeper", () => {
  it("does nothing when coordination is disabled", async () => {
    const client = fakeClient();
    const log = fakeLog();
    assert.strictEqual(
      await registerKeeper(client, { coordinatorContractId: "" }, log),
      "disabled",
    );
    assert.strictEqual(client.isRegistered.mock.callCount(), 0);
    assert.strictEqual(client.register.mock.callCount(), 0);
    assert.match(log.info.mock.calls[0].arguments[0], /coordination disabled/);
  });

  it("registers the keeper when coordination is enabled", async () => {
    const client = fakeClient();
    const log = fakeLog();
    assert.strictEqual(
      await registerKeeper(client, { coordinatorContractId: "CCOORD" }, log),
      "registered",
    );
    assert.deepStrictEqual(client.register.mock.calls[0].arguments, ["CCOORD"]);
    assert.match(log.info.mock.calls[0].arguments[1], /registered with coordinator/);
  });

  it("treats an already-registered keeper as success without sending a transaction", async () => {
    const client = fakeClient({ registered: true });
    const log = fakeLog();
    assert.strictEqual(
      await registerKeeper(client, { coordinatorContractId: "CCOORD" }, log),
      "already-registered",
    );
    assert.strictEqual(client.register.mock.callCount(), 0);
  });

  it("warns loudly and reports failure when registration fails", async () => {
    const client = fakeClient({ registerError: new Error("rpc down") });
    const log = fakeLog();
    assert.strictEqual(
      await registerKeeper(client, { coordinatorContractId: "CCOORD" }, log),
      "failed",
    );
    assert.strictEqual(log.warn.mock.callCount(), 1);
    assert.strictEqual(log.warn.mock.calls[0].arguments[0].err, "rpc down");
    assert.match(log.warn.mock.calls[0].arguments[1], /FAILED/);
  });

  it("reports failure when the registration check itself fails", async () => {
    const client = fakeClient({ isRegisteredError: new Error("read failed") });
    const log = fakeLog();
    assert.strictEqual(
      await registerKeeper(client, { coordinatorContractId: "CCOORD" }, log),
      "failed",
    );
    assert.strictEqual(client.register.mock.callCount(), 0);
  });
});

describe("unregisterKeeper", () => {
  it("does nothing when coordination is disabled", async () => {
    const client = fakeClient();
    assert.strictEqual(
      await unregisterKeeper(client, { coordinatorContractId: "" }, fakeLog()),
      "disabled",
    );
    assert.strictEqual(client.unregister.mock.callCount(), 0);
  });

  it("unregisters when enabled", async () => {
    const client = fakeClient();
    assert.strictEqual(
      await unregisterKeeper(client, { coordinatorContractId: "CCOORD" }, fakeLog()),
      "unregistered",
    );
    assert.deepStrictEqual(client.unregister.mock.calls[0].arguments, ["CCOORD"]);
  });

  it("never throws when unregistration fails", async () => {
    const client = fakeClient();
    client.unregister = mock.fn(async () => {
      throw new Error("nope");
    });
    const log = fakeLog();
    assert.strictEqual(
      await unregisterKeeper(client, { coordinatorContractId: "CCOORD" }, log),
      "failed",
    );
    assert.strictEqual(log.warn.mock.callCount(), 1);
  });
});
