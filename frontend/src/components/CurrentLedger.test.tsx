import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { CurrentLedger } from "./CurrentLedger";
import { Navbar } from "./Navbar";
import { fetchLatestLedger } from "../lib/ledger";

vi.mock("./ConnectButton", () => ({ ConnectButton: () => null }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CurrentLedger", () => {
  it("shows a loading state, then the fetched ledger", async () => {
    let resolve!: (n: number) => void;
    const loadLedger = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    render(<CurrentLedger loadLedger={loadLedger} pollMs={60_000} />);
    expect(screen.getByTestId("current-ledger").getAttribute("data-state")).toBe("loading");

    await act(async () => resolve(1234567));
    expect(screen.getByTestId("current-ledger").getAttribute("data-state")).toBe("live");
    expect(screen.getByTestId("current-ledger").textContent).toContain("1,234,567");
  });

  it("says unavailable instead of a placeholder when the RPC fails", async () => {
    const loadLedger = vi.fn(async () => {
      throw new Error("rpc down");
    });
    render(<CurrentLedger loadLedger={loadLedger} pollMs={60_000} />);
    await waitFor(() =>
      expect(screen.getByTestId("current-ledger").getAttribute("data-state")).toBe("error"),
    );
    expect(screen.getByTestId("current-ledger").textContent).toContain("unavailable");
    expect(screen.getByTestId("current-ledger").textContent).not.toMatch(/1000|2000/);
  });

  it("keeps the last known ledger and marks it stale when a later poll fails", async () => {
    vi.useFakeTimers();
    const loadLedger = vi.fn().mockResolvedValueOnce(500).mockRejectedValueOnce(new Error("blip"));
    render(<CurrentLedger loadLedger={loadLedger} pollMs={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("current-ledger").textContent).toContain("500");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId("current-ledger").getAttribute("data-state")).toBe("stale");
    expect(screen.getByTestId("current-ledger").textContent).toContain("500");
  });

  it("refreshes on an interval and stops polling when unmounted", async () => {
    vi.useFakeTimers();
    const loadLedger = vi.fn(async () => 42);
    const { unmount } = render(<CurrentLedger loadLedger={loadLedger} pollMs={1000} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(loadLedger.mock.calls.length).toBe(3);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(loadLedger.mock.calls.length).toBe(3);
  });
});

describe("Navbar", () => {
  it("shows the current ledger, not a countdown with a made-up target", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ result: { sequence: 99 } }) })),
    );
    render(<Navbar />);
    expect(screen.getByTestId("current-ledger")).toBeTruthy();
    expect(screen.queryByTestId("ledger-clock")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("fetchLatestLedger", () => {
  const okFetch = (body: unknown, ok = true, status = 200) =>
    vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;

  it("returns the ledger sequence from getLatestLedger", async () => {
    const fetchImpl = okFetch({ result: { sequence: 777 } });
    expect(await fetchLatestLedger("https://rpc.test", fetchImpl)).toBe(777);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body).method).toBe("getLatestLedger");
  });

  it("rejects an HTTP error", async () => {
    await expect(fetchLatestLedger("https://rpc.test", okFetch({}, false, 503))).rejects.toThrow(
      /503/,
    );
  });

  it.each([{}, { result: {} }, { result: { sequence: 0 } }, { result: { sequence: "abc" } }])(
    "rejects a response without a valid sequence: %j",
    async (body) => {
      await expect(fetchLatestLedger("https://rpc.test", okFetch(body))).rejects.toThrow(
        /no ledger sequence/,
      );
    },
  );
});
