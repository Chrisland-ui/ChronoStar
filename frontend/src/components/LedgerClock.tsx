"use client";

import { useState, useEffect } from "react";
import { SECONDS_PER_LEDGER } from "@/lib/network";

interface LedgerClockProps {
  targetLedger?: number;
  currentLedger?: number;
  secondsPerLedger?: number;
  className?: string;
}

export function LedgerClock({
  targetLedger = 2000,
  currentLedger = 1000,
  secondsPerLedger = SECONDS_PER_LEDGER,
  className = "",
}: LedgerClockProps = {}) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingLedgers = targetLedger - currentLedger;
  const targetSecondsFromNow = remainingLedgers * secondsPerLedger;
  const targetTime = new Date(now.getTime() + targetSecondsFromNow * 1000);
  const isOverdue = remainingLedgers < 0;

  const formattedAbsolute = targetTime.toISOString().replace("T", " ").substring(0, 19) + " UTC";

  let countdownText = "";
  if (isOverdue) {
    countdownText = `Overdue by ${Math.abs(remainingLedgers)} ledgers`;
  } else if (targetSecondsFromNow <= 0) {
    countdownText = "Due now";
  } else {
    const totalSec = Math.floor(targetSecondsFromNow);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (days > 0) countdownText = `${days}d ${hours}h remaining`;
    else if (hours > 0) countdownText = `${hours}h ${mins}m remaining`;
    else if (mins > 0) countdownText = `${mins}m ${secs}s remaining`;
    else countdownText = `${secs}s remaining`;
  }

  return (
    <div
      data-testid="ledger-clock"
      className={`inline-flex flex-col text-xs font-mono bg-bg-card border border-border rounded px-2.5 py-1 ${className}`}
      title={`Target Ledger: ${targetLedger} | Estimated: ${formattedAbsolute}`}
    >
      <span
        className={isOverdue ? "text-accent-red font-semibold" : "text-accent-blue font-semibold"}
      >
        {countdownText}
      </span>
      <span className="text-text-muted text-[10px]">{formattedAbsolute}</span>
    </div>
  );
}
