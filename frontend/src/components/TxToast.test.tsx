import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TxToast } from "./TxToast";

describe("TxToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    [undefined, "https://stellar.expert/explorer/testnet"],
    ["", "https://stellar.expert/explorer/testnet"],
    ["https://stellar.expert/explorer/public", "https://stellar.expert/explorer/public"],
    ["https://stellar.expert/explorer/public///", "https://stellar.expert/explorer/public"],
  ])("uses configured explorer %s with the testnet fallback", (base, expected) => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_EXPLORER", base ?? "");
    if (base === undefined) delete process.env.NEXT_PUBLIC_STELLAR_EXPLORER;
    render(<TxToast status="success" hash="abc123" />);
    const link = screen.getByRole("link", { name: "View on explorer" });
    expect(link.getAttribute("href")).toBe(`${expected}/tx/abc123`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps pending receipts visible beyond 30 seconds and dismisses after confirmation", () => {
    const onClose = vi.fn();
    const { rerender } = render(<TxToast status="pending" hash="abc123" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("link", { name: "View on explorer" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    rerender(<TxToast status="success" hash="abc123" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByText("success")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("link")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves error dismissal after five seconds without requiring a hash", () => {
    const onClose = vi.fn();
    render(<TxToast status="error" onClose={onClose} />);
    expect(screen.queryByRole("link")).toBeNull();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText("error")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clears its timer on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(<TxToast status="error" onClose={onClose} />);
    expect(screen.queryByRole("link")).toBeNull();
    unmount();
    act(() => vi.advanceTimersByTime(5_000));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels a terminal dismissal when a new pending transaction starts", () => {
    const onClose = vi.fn();
    const { rerender } = render(<TxToast status="error" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(2_000));
    rerender(<TxToast status="pending" onClose={onClose} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("pending")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
