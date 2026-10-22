import { afterEach, describe, expect, it, vi } from "vitest";
import { captureException } from "./sentry";
import { ApiTimeoutError, fetchJSON, isAbortError } from "./api";
vi.mock("./sentry", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe("API request deadlines", () => {
  it("rejects a never-resolving fetch and aborts its signal", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        signal = init.signal;
        return new Promise(() => {});
      }),
    );
    const request = fetchJSON("/stalled", { timeoutMs: 100 });
    const rejection = expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
    expect(signal).toHaveProperty("aborted", true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the deadline active while decoding the body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }),
    );
    const request = fetchJSON("/body", { timeoutMs: 100 });
    const rejection = expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await rejection;
  });
  it("distinguishes caller cancellation from timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const controller = new AbortController();
    const request = fetchJSON("/cancel", { signal: controller.signal });
    controller.abort();
    try {
      await request;
      throw new Error("expected cancellation");
    } catch (error) {
      expect(isAbortError(error)).toBe(true);
    }
  });
  it("returns JSON and cleans up the deadline after success", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ready: true }) }),
    );
    await expect(fetchJSON("/ok")).resolves.toEqual({ ready: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start fetch when already cancelled", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchJSON("/cancel", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves HTTP failures and removes the caller listener and deadline", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable", json }),
    );
    await expect(fetchJSON("/unavailable", { signal: controller.signal })).rejects.toThrow(
      "API 503: Service Unavailable",
    );
    expect(json).not.toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalledWith("abort", addListener.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("propagates the original network failure and cleans up", async () => {
    vi.useFakeTimers();
    const failure = new TypeError("Network unavailable");
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(fetchJSON("/network", { signal: controller.signal })).rejects.toBe(failure);
    expect(removeListener).toHaveBeenCalledWith("abort", addListener.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
    expect(captureException).toHaveBeenCalledWith(failure, { path: "/network" });
  });
  it("cleans up cancellation without reporting it as an application error", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const request = fetchJSON("/cancel-cleanup", { signal: controller.signal });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(removeListener).toHaveBeenCalledWith("abort", addListener.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });
  it("reports timeout errors and removes the caller listener", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, "addEventListener");
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const request = fetchJSON("/timeout-report", { signal: controller.signal, timeoutMs: 50 });
    const rejection = expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    expect(captureException).toHaveBeenCalledWith(expect.any(ApiTimeoutError), {
      path: "/timeout-report",
    });
    expect(removeListener).toHaveBeenCalledWith("abort", addListener.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
