import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEventStore } from './store.js';
import { describe, it } from "node:test";
import assert from "node:assert";
import { createEventStore } from "./store.js";

describe("EventStore Drivers", () => {
  const sampleEvent = { type: "vault", id: 1, targetLedger: 1000 };

  for (const driverName of ["memory", "file", "postgres", "sqlite"]) {
    it(`driver "${driverName}" implements append, load, and list`, async () => {
      const store = createEventStore(driverName);
      const initial = await store.load();
      assert.strictEqual(Array.isArray(initial), true);

      const appended = await store.append(sampleEvent);
      assert.strictEqual(appended.length > 0, true);

      const listed = await store.list(10);
      assert.strictEqual(listed.length > 0, true);
      assert.strictEqual(listed[0].type, 'vault');
      assert.ok(appended.length > 0);

      const listed = await store.list(10);
      assert.ok(listed.length > 0);
      assert.strictEqual(listed[0].type, "vault");
    });
  }
});
