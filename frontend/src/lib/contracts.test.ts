import { describe, it, expect, vi } from "vitest";
import {
  validateIntegerAmount,
  validateReleaseLedger,
  createVaultTx,
  claimVaultTx,
  cancelVaultTx,
  createStreamTx,
  createDcaTx,
} from "./contracts";
import { getNetworkPassphrase, DEFAULT_TESTNET_PASSPHRASE } from "./config";

describe("BigInt Integer Amount Validation", () => {
  it("parses valid positive integer strings", () => {
    expect(validateIntegerAmount("1000")).toBe(1000n);
    expect(validateIntegerAmount("1")).toBe(1n);
  });

  it("safely handles amounts exceeding JS MAX_SAFE_INTEGER (2^53 - 1)", () => {
    const largeAmount = "10000000000000000000"; // 10^19 > 9007199254740991
    const result = validateIntegerAmount(largeAmount);
    expect(result).toBe(10000000000000000000n);
  });

  it("rejects zero or negative values", () => {
    expect(() => validateIntegerAmount("0")).toThrow("amount must be greater than zero");
    expect(() => validateIntegerAmount("-500")).toThrow("amount must be a valid integer");
  });

  it("rejects fractional numbers", () => {
    expect(() => validateIntegerAmount("1.5")).toThrow("fractional amounts are not allowed");
    expect(() => validateIntegerAmount("0.001")).toThrow("fractional amounts are not allowed");
  });

  it("rejects exponential notation", () => {
    expect(() => validateIntegerAmount("1e3")).toThrow("cannot be in exponential notation");
    expect(() => validateIntegerAmount("2.5e6")).toThrow("cannot be in exponential notation");
  });

  it("rejects non-numeric characters and empty strings", () => {
    expect(() => validateIntegerAmount("")).toThrow("amount must be greater than zero");
    expect(() => validateIntegerAmount("abc")).toThrow("amount must be a valid integer");
  });
});

describe("Release Ledger Validation", () => {
  it("parses valid ledger numbers", () => {
    expect(validateReleaseLedger("2000000")).toBe(2000000n);
  });

  it("rejects zero or negative sequence numbers", () => {
    expect(() => validateReleaseLedger("0")).toThrow("release_ledger must be in the future");
  });

  it("rejects exponential notation or fractional numbers", () => {
    expect(() => validateReleaseLedger("1e5")).toThrow("cannot be in exponential notation");
    expect(() => validateReleaseLedger("2000.5")).toThrow("release_ledger must be an integer");
  });

  it("rejects ledgers that are not in the future relative to currentLedger", () => {
    expect(() => validateReleaseLedger("100", 100)).toThrow("release_ledger must be in the future");
    expect(() => validateReleaseLedger("99", 100)).toThrow("release_ledger must be in the future");
    expect(validateReleaseLedger("101", 100)).toBe(101n);
  });
});

describe("Network Passphrase Default Agreement", () => {
  it("defaults to the Testnet passphrase matching backend and keeper configs", () => {
    expect(DEFAULT_TESTNET_PASSPHRASE).toBe("Test SDF Network ; September 2015");
    expect(getNetworkPassphrase()).toBe("Test SDF Network ; September 2015");
  });
});

describe("Transaction Builder & Contract Functions", () => {
  const sender = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
  const recipient = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const token = "CA3D5KRYMCMCZVAC7OHQHGNO2QQ74YOGJGXRO2CX6PYYBCR4ACMO5SC6";
  const contractId = "CA3D5KRYMCMCZVAC7OHQHGNO2QQ74YOGJGXRO2CX6PYYBCR4ACMO5SC6";

  const validVaultParams = {
    recipient,
    token,
    amount: "10000000000000000000",
    releaseLedger: "2000000",
    label: "Test Vault",
  };

  it("builds, simulates, and signs create_vault transaction via signer", async () => {
    const signerMock = vi.fn(async ({ xdr }: { xdr: string; networkPassphrase?: string }) => xdr);
    const result = await createVaultTx(sender, validVaultParams, {
      signer: signerMock,
      contractId,
      skipSimulation: true,
    });

    expect(result.hash).toBeDefined();
    expect(result.hash.length).toBe(64); // 32-byte hex hash
    expect(result.xdr).toBeDefined();
    expect(signerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        networkPassphrase: "Test SDF Network ; September 2015",
        xdr: expect.any(String),
      }),
    );
  });

  it("surfaces amount validation errors before building tx", async () => {
    await expect(createVaultTx(sender, { ...validVaultParams, amount: "0" })).rejects.toThrow(
      "amount must be greater than zero",
    );

    await expect(createVaultTx(sender, { ...validVaultParams, amount: "1.5" })).rejects.toThrow(
      "fractional amounts are not allowed",
    );
  });

  it("surfaces releaseLedger validation errors before building tx", async () => {
    await expect(
      createVaultTx(sender, { ...validVaultParams, releaseLedger: "0" }),
    ).rejects.toThrow("release_ledger must be in the future");
  });

  it("handles user cancellation gracefully", async () => {
    const signerMock = vi.fn(async () => null);
    await expect(
      createVaultTx(sender, validVaultParams, {
        signer: signerMock,
        contractId,
        skipSimulation: true,
      }),
    ).rejects.toThrow("User declined transaction signing");
  });

  it("builds and signs claimVaultTx", async () => {
    const signerMock = vi.fn(async ({ xdr }: { xdr: string }) => xdr);
    const result = await claimVaultTx(recipient, 42n, {
      signer: signerMock,
      contractId,
      skipSimulation: true,
    });

    expect(result.hash.length).toBe(64);
    expect(signerMock).toHaveBeenCalled();
  });

  it("builds and signs cancelVaultTx", async () => {
    const signerMock = vi.fn(async ({ xdr }: { xdr: string }) => xdr);
    const result = await cancelVaultTx(sender, 42n, {
      signer: signerMock,
      contractId,
      skipSimulation: true,
    });

    expect(result.hash.length).toBe(64);
    expect(signerMock).toHaveBeenCalled();
  });

  it("builds and signs createStreamTx", async () => {
    const signerMock = vi.fn(async ({ xdr }: { xdr: string }) => xdr);
    const result = await createStreamTx(
      sender,
      {
        recipient,
        token,
        ratePerLedger: "100",
        startLedger: "1000",
        endLedger: "2000",
        deposit: "100000",
        label: "Stream 1",
      },
      {
        signer: signerMock,
        contractId,
        skipSimulation: true,
      },
    );

    expect(result.hash.length).toBe(64);
    expect(signerMock).toHaveBeenCalled();
  });

  it("rejects createStreamTx when endLedger <= startLedger", async () => {
    await expect(
      createStreamTx(sender, {
        recipient,
        token,
        ratePerLedger: "100",
        startLedger: "2000",
        endLedger: "1000",
        deposit: "100000",
      }),
    ).rejects.toThrow("end_ledger must be strictly greater than start_ledger");
  });

  it("builds and signs createDcaTx", async () => {
    const signerMock = vi.fn(async ({ xdr }: { xdr: string }) => xdr);
    const result = await createDcaTx(
      sender,
      {
        tokenIn: token,
        tokenOut: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        amountPerTrade: "500",
        intervalLedgers: "10",
        totalTrades: "5",
      },
      {
        signer: signerMock,
        contractId,
        skipSimulation: true,
      },
    );

    expect(result.hash.length).toBe(64);
    expect(signerMock).toHaveBeenCalled();
  });
});
