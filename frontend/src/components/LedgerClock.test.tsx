import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerClock } from "./LedgerClock";
import { ledgersToHuman, SECONDS_PER_LEDGER } from "../lib/utils";

describe("ledgersToHuman", () => {
  it("returns now for zero or negative ledgers", () => {
    expect(ledgersToHuman(0)).toBe("now");
    expect(ledgersToHuman(-5)).toBe("now");
  });

  it("converts ledgers using the default shared constant", () => {
    // 60 ledgers * 5 seconds = 300 seconds = 5 min
    expect(ledgersToHuman(60)).toBe("~5 min");
    // 720 ledgers * 5 seconds = 3600 seconds = 1 hour
    expect(ledgersToHuman(720)).toBe("~1 hours");
  });

  it("accepts a custom secondsPerLedger parameter", () => {
    // 60 ledgers * 10 seconds = 600 seconds = 10 min
    expect(ledgersToHuman(60, 10)).toBe("~10 min");
    // 60 ledgers * 2 seconds = 120 seconds = 2 min
    expect(ledgersToHuman(60, 2)).toBe("~2 min");
  });
});

describe("LedgerClock", () => {
  it("renders countdown and absolute UTC timestamp", () => {
    render(<LedgerClock targetLedger={2000} currentLedger={1000} secondsPerLedger={5} />);
    const clock = screen.getByTestId("ledger-clock");
    expect(clock.textContent).toContain("remaining");
    expect(clock.textContent).toContain("UTC");
  });

  it("renders overdue state when current ledger exceeds target", () => {
    render(<LedgerClock targetLedger={1000} currentLedger={1200} secondsPerLedger={5} />);
    const clock = screen.getByTestId("ledger-clock");
    expect(clock.textContent).toContain("Overdue by 200 ledgers");
  });
});
