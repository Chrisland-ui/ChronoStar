"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getPublicKey, isConnected, getNetworkDetails } from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "./network";

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  network: string | null;
  networkPassphrase: string | null;
  isNetworkMismatch: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  isConnected: false,
  network: null,
  networkPassphrase: null,
  isNetworkMismatch: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [isNetworkMismatch, setIsNetworkMismatch] = useState<boolean>(false);

  const checkNetwork = useCallback((passphrase: string | null) => {
    if (!passphrase) {
      setIsNetworkMismatch(false);
      return;
    }
    const mismatch = passphrase !== NETWORK_PASSPHRASE;
    setIsNetworkMismatch(mismatch);
  }, []);

  const syncWalletState = useCallback(async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        setAddress(null);
        setNetwork(null);
        setNetworkPassphrase(null);
        setIsNetworkMismatch(false);
        return;
      }

      const pubKey = await getPublicKey();
      setAddress(pubKey || null);

      try {
        const details = await getNetworkDetails();
        if (details && !details.error) {
          setNetwork(details.network || null);
          setNetworkPassphrase(details.networkPassphrase || null);
          checkNetwork(details.networkPassphrase || null);
        }
      } catch {
        // Fallback if getNetworkDetails is not supported in the active Freighter version
      }
    } catch {
      setAddress(null);
      setIsNetworkMismatch(false);
    }
  }, [checkNetwork]);

  useEffect(() => {
    syncWalletState();

    // 1. Freighter WatchWalletChanges utility (if present)
    let watcher: any = null;
    try {
      const freighter = require("@stellar/freighter-api");
      if (freighter?.WatchWalletChanges) {
        watcher = new freighter.WatchWalletChanges(1000);
        watcher.watch((changes: any) => {
          if (changes?.address !== undefined) {
            setAddress(changes.address || null);
          }
          if (changes?.networkPassphrase !== undefined) {
            setNetworkPassphrase(changes.networkPassphrase);
            checkNetwork(changes.networkPassphrase);
          }
        });
      }
    } catch {
      // Not in bundled environment
    }

    // 2. Custom DOM event listeners
    const handleAccountChange = (event: any) => {
      const newAddress =
        event?.detail?.address ||
        event?.detail?.publicKey ||
        (typeof event?.detail === "string" ? event.detail : null);
      if (newAddress) {
        setAddress(newAddress);
      } else {
        syncWalletState();
      }
    };

    const handleNetworkChange = (event: any) => {
      const newPassphrase = event?.detail?.networkPassphrase;
      const newNetwork = event?.detail?.network;
      if (newNetwork) setNetwork(newNetwork);
      if (newPassphrase) {
        setNetworkPassphrase(newPassphrase);
        checkNetwork(newPassphrase);
      } else {
        syncWalletState();
      }
    };

    const handleFocus = () => {
      syncWalletState();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("accountChanged", handleAccountChange);
      window.addEventListener("networkChanged", handleNetworkChange);
      window.addEventListener("freighter:accountChanged", handleAccountChange);
      window.addEventListener("freighter:networkChanged", handleNetworkChange);
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      if (watcher && typeof watcher.stop === "function") {
        watcher.stop();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("accountChanged", handleAccountChange);
        window.removeEventListener("networkChanged", handleNetworkChange);
        window.removeEventListener("freighter:accountChanged", handleAccountChange);
        window.removeEventListener("freighter:networkChanged", handleNetworkChange);
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [syncWalletState, checkNetwork]);

  const connect = useCallback(async () => {
    try {
      const pubKey = await getPublicKey();
      setAddress(pubKey || null);
      try {
        const details = await getNetworkDetails();
        if (details && !details.error) {
          setNetwork(details.network || null);
          setNetworkPassphrase(details.networkPassphrase || null);
          checkNetwork(details.networkPassphrase || null);
        }
      } catch {}
    } catch {
      setAddress(null);
    }
  }, [checkNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setNetworkPassphrase(null);
    setIsNetworkMismatch(false);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        network,
        networkPassphrase,
        isNetworkMismatch,
        connect,
        disconnect,
      }}
    >
      {isNetworkMismatch && (
        <div
          data-testid="network-mismatch-banner"
          className="bg-accent-red/90 text-white text-xs px-4 py-2 text-center font-medium sticky top-0 z-50 flex items-center justify-center gap-2"
        >
          <span>
            ⚠️ Wallet network mismatch: Connected to {network || "unknown"}, but this app requires{" "}
            {NETWORK_PASSPHRASE}. Please switch network in Freighter.
          </span>
        </div>
      )}
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
