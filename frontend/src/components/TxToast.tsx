"use client";

import React, { useState, useEffect } from "react";
import { getTransactionExplorerUrl } from "@/lib/config";

interface TxToastProps {
  hash?: string | null;
  status?: "pending" | "success" | "error" | null;
  message?: string;
  onClose?: () => void;
}

export function TxToast({ hash, status, message, onClose }: TxToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status) {
      setVisible(true);
      if (status === "pending") return;
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!visible || !status) return null;

  const colors = {
    pending: "border-accent-orange text-accent-orange",
    success: "border-accent-green text-accent-green",
    error: "border-accent-red text-accent-red",
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border bg-bg-card ${colors[status]}`}
    >
      <div className="flex items-center gap-2">
        {status === "pending" && (
          <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        )}
        <span className="text-sm">{message || status}</span>
      </div>
      {hash && (
        <a
          href={getTransactionExplorerUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 text-xs text-accent-blue underline"
        >
          View on explorer
        </a>
      )}
    </div>
  );
}
