import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { WalletProvider, useWallet } from "./store";
import * as freighter from "@stellar/freighter-api";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

describe("WalletProvider Freighter Events (#291)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (freighter.isConnected as any).mockResolvedValue(true);
    (freighter.getPublicKey as any).mockResolvedValue("GBZXN7PIRZGNMHGA728RGRTDG");
    (freighter.getNetworkDetails as any).mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates address when accountChanged event fires", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );
    const { result } = renderHook(() => useWallet(), { wrapper });

    // Initial check
    await act(async () => {});
    expect(result.current.address).toBe("GBZXN7PIRZGNMHGA728RGRTDG");

    // Trigger accountChanged
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("accountChanged", {
          detail: { address: "GCLWGQBMKQLZSG5VYLXNV7FRW" },
        }),
      );
    });

    expect(result.current.address).toBe("GCLWGQBMKQLZSG5VYLXNV7FRW");
  });

  it("detects network mismatch and updates state when networkChanged fires", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {});
    expect(result.current.isNetworkMismatch).toBe(false);

    // Switch to Public Network (different from Testnet passphrase)
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("networkChanged", {
          detail: {
            network: "PUBLIC",
            networkPassphrase: "Public Global Stellar Network ; September 2015",
          },
        }),
      );
    });

    expect(result.current.isNetworkMismatch).toBe(true);
    expect(result.current.network).toBe("PUBLIC");
  });

  it("removes event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider>{children}</WalletProvider>
    );
    const { unmount } = renderHook(() => useWallet(), { wrapper });

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("accountChanged", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("networkChanged", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
  });
});
