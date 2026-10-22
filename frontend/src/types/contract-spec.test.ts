import { describe, it, expect } from "vitest";
import {
  VaultStatusName,
  StreamStatusName,
  DCAStatusName,
  VAULT_STATUS_NAMES,
  STREAM_STATUS_NAMES,
  DCA_STATUS_NAMES,
  formatVaultStatus,
  formatStreamStatus,
  formatDCAStatus,
  VaultEntry,
  StreamEntry,
  DCAEntry,
} from "./index";

describe("Contract Entity Types & Status Mapping (#289)", () => {
  it("includes all ScheduleVault status variants and formats ordinals", () => {
    const expectedStatuses: VaultStatusName[] = [
      "Active",
      "Released",
      "Cancelled",
      "Paused",
      "Reclaimed",
    ];
    expect(Object.values(VAULT_STATUS_NAMES)).toEqual(expectedStatuses);

    expect(formatVaultStatus(0)).toBe("Active");
    expect(formatVaultStatus(1)).toBe("Released");
    expect(formatVaultStatus(2)).toBe("Cancelled");
    expect(formatVaultStatus(3)).toBe("Paused");
    expect(formatVaultStatus(4)).toBe("Reclaimed");
    expect(formatVaultStatus("Paused")).toBe("Paused");
  });

  it("includes all RecurringStream status variants and formats ordinals", () => {
    const expectedStatuses: StreamStatusName[] = ["Active", "Paused", "Completed", "Cancelled"];
    expect(Object.values(STREAM_STATUS_NAMES)).toEqual(expectedStatuses);

    expect(formatStreamStatus(0)).toBe("Active");
    expect(formatStreamStatus(1)).toBe("Paused");
    expect(formatStreamStatus(2)).toBe("Completed");
    expect(formatStreamStatus(3)).toBe("Cancelled");
    expect(formatStreamStatus("Completed")).toBe("Completed");
  });

  it("includes all DCAPolicy status variants and formats ordinals", () => {
    const expectedStatuses: DCAStatusName[] = ["Active", "Exhausted", "Cancelled"];
    expect(Object.values(DCA_STATUS_NAMES)).toEqual(expectedStatuses);

    expect(formatDCAStatus(0)).toBe("Active");
    expect(formatDCAStatus(1)).toBe("Exhausted");
    expect(formatDCAStatus(2)).toBe("Cancelled");
    expect(formatDCAStatus("Exhausted")).toBe("Exhausted");
  });

  it("verifies all expected contract fields exist on entity interfaces", () => {
    const vault: VaultEntry = {
      id: 1,
      owner: "G...",
      recipient: "G...",
      token: "C...",
      amount: "100",
      release_ledger: 1000,
      created_ledger: 500,
      label: "test",
      status: "Active",
      paused_at_ledger: 750,
      expires_after_ledger: 2000,
    };
    expect(vault.paused_at_ledger).toBe(750);
    expect(vault.expires_after_ledger).toBe(2000);

    const stream: StreamEntry = {
      id: 1,
      owner: "G...",
      recipient: "G...",
      token: "C...",
      total_amount: "100",
      claimed_amount: "0",
      start_ledger: 100,
      end_ledger: 200,
      last_claimed_ledger: 100,
      label: "stream",
      status: "Active",
      grace_period_ledgers: 50,
      paused_at_ledger: 120,
      paused_ledgers: 10,
    };
    expect(stream.grace_period_ledgers).toBe(50);
    expect(stream.paused_at_ledger).toBe(120);
    expect(stream.paused_ledgers).toBe(10);

    const dca: DCAEntry = {
      id: 1,
      owner: "G...",
      token_in: "C...",
      token_out: "C_OUT...",
      router: "C_ROUTER...",
      swap_receiver: "G_REC...",
      total_budget: "1000",
      remaining_budget: "900",
      amount_per_swap: "100",
      min_output_per_swap: "95",
      last_swap_output: "98",
      interval_ledgers: 10,
      last_executed_ledger: 100,
      next_execution_ledger: 110,
      executions_completed: 1,
      label: "dca",
      status: "Active",
    };
    expect(dca.token_out).toBe("C_OUT...");
    expect(dca.router).toBe("C_ROUTER...");
    expect(dca.min_output_per_swap).toBe("95");
    expect(dca.last_swap_output).toBe("98");
  });
});
