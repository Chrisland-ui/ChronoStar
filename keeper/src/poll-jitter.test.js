import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert";
import { withJitter } from "./poll-jitter.js";

function stubRandom(value) {
  mock.method(Math, "random", () => value);
}

describe("withJitter", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("scales the interval by 0.8x when random is at its lowest", () => {
    stubRandom(0);
    assert.strictEqual(withJitter(10_000), 8_000);
  });

  it("scales the interval by 1.2x when random is at its highest", () => {
    stubRandom(1);
    assert.strictEqual(withJitter(10_000), 12_000);
  });

  it("leaves the interval unchanged at the midpoint", () => {
    stubRandom(0.5);
    assert.strictEqual(withJitter(10_000), 10_000);
  });

  it("stays within the 0.8x–1.2x band for a range of intervals and random values", () => {
    for (const interval of [1_000, 2_500, 5_000, 30_000, 60_000, 3_600_000]) {
      for (const r of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        stubRandom(r);
        const result = withJitter(interval);
        assert.ok(result >= Math.round(interval * 0.8), `${result} < 0.8x of ${interval} (r=${r})`);
        assert.ok(result <= Math.round(interval * 1.2), `${result} > 1.2x of ${interval} (r=${r})`);
        mock.restoreAll();
      }
    }
  });

  it("applies the 1000 ms floor for intervals of 0, 1 and 500", () => {
    for (const r of [0, 0.5, 1]) {
      stubRandom(r);
      for (const interval of [0, 1, 500]) {
        assert.strictEqual(withJitter(interval), 1_000, `interval ${interval}, r=${r}`);
      }
      mock.restoreAll();
    }
  });

  it("applies the floor when jitter pushes a small interval below 1000 ms", () => {
    stubRandom(0);
    assert.strictEqual(withJitter(1_100), 1_000); // 880 -> floored
  });

  it("lands exactly on the floor at 0.8x of 1250 ms and is not floored above it", () => {
    stubRandom(0);
    assert.strictEqual(withJitter(1_250), 1_000); // 1000 exactly
    assert.strictEqual(withJitter(1_300), 1_040);
  });

  it("always returns an integer", () => {
    for (const r of [0, 0.123456, 0.5, 0.987654, 1]) {
      stubRandom(r);
      assert.ok(Number.isInteger(withJitter(33_333)), `non-integer for r=${r}`);
      assert.ok(Number.isInteger(withJitter(1_001)), `non-integer for r=${r}`);
      mock.restoreAll();
    }
  });

  it("is deterministic for a stubbed random value", () => {
    stubRandom(0.3);
    assert.strictEqual(withJitter(7_777), withJitter(7_777));
  });
});
