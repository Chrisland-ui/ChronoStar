import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExplorerPage from "./page";

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

describe("Explorer request lifecycle", () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("leaves loading after a stalled request times out and can retry successfully", async () => {
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    render(<ExplorerPage />);
    expect(screen.queryByText("No upcoming events.")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText("The request timed out. Please retry.")).toBeTruthy();
    const firstSignal = fetchMock.mock.calls[0][1]?.signal;
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("No upcoming events.")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels the active fetch when the page unmounts", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const { unmount } = render(<ExplorerPage />);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);

    await act(async () => {
      unmount();
    });

    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
