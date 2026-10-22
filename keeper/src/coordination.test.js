import { describe, it } from "node:test";
import assert from "node:assert";
import { runCoordinated } from "./coordination.js";

function fakeClient({ claim = true, releaseError } = {}) {
  const calls = [];
  return {
    calls,
    claimExecution: async (resource, id) => {
      calls.push(["claim", resource, id]);
      return claim;
    },
    releaseExecution: async (resource, id) => {
      calls.push(["release", resource, id]);
      if (releaseError) throw releaseError;
    },
  };
}

describe("runCoordinated", () => {
  it("runs the action unguarded when the client has no claimExecution", async () => {
    let ran = 0;
    const result = await runCoordinated({}, "vault", 1, async () => {
      ran++;
      return "done";
    });
    assert.strictEqual(ran, 1);
    assert.strictEqual(result, "done");
  });

  it("claims, runs the action, releases afterwards and returns true", async () => {
    const client = fakeClient();
    const order = [];
    const result = await runCoordinated(client, "vault", 7, async () => {
      order.push(...client.calls.map((c) => c[0]), "action");
    });
    assert.strictEqual(result, true);
    assert.deepStrictEqual(order, ["claim", "action"]);
    assert.deepStrictEqual(client.calls, [
      ["claim", "vault", 7],
      ["release", "vault", 7],
    ]);
  });

  it("does not run the action and returns false when the claim is refused", async () => {
    const client = fakeClient({ claim: false });
    let ran = false;
    const result = await runCoordinated(client, "stream", 3, async () => {
      ran = true;
    });
    assert.strictEqual(result, false);
    assert.strictEqual(ran, false);
    assert.deepStrictEqual(client.calls, [["claim", "stream", 3]]);
  });

  it("releases the claim and rethrows when the action throws", async () => {
    const client = fakeClient();
    const boom = new Error("boom");
    await assert.rejects(
      runCoordinated(client, "dca", 9, async () => {
        throw boom;
      }),
      (err) => err === boom,
    );
    assert.deepStrictEqual(client.calls, [
      ["claim", "dca", 9],
      ["release", "dca", 9],
    ]);
  });

  it("swallows a release error after a successful action", async () => {
    const client = fakeClient({ releaseError: new Error("release failed") });
    const result = await runCoordinated(client, "vault", 1, async () => {});
    assert.strictEqual(result, true);
    assert.strictEqual(client.calls.at(-1)[0], "release");
  });

  it("does not let a release error mask the action error", async () => {
    const client = fakeClient({ releaseError: new Error("release failed") });
    const actionError = new Error("action failed");
    await assert.rejects(
      runCoordinated(client, "vault", 1, async () => {
        throw actionError;
      }),
      (err) => err === actionError,
    );
    assert.strictEqual(client.calls.at(-1)[0], "release");
  });

  it("passes the resource and id through to the claim", async () => {
    const client = fakeClient();
    await runCoordinated(client, "dca", 42, async () => {});
    assert.deepStrictEqual(client.calls[0], ["claim", "dca", 42]);
  });
});
