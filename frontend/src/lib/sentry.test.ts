import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isUserRejectionError, initSentry, addBreadcrumb, captureException } from "./sentry";

describe("Frontend Sentry Monitoring (#292)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("filters out user rejection wallet signatures", () => {
    expect(isUserRejectionError("User declined transaction")).toBe(true);
    expect(isUserRejectionError(new Error("Transaction rejected by user"))).toBe(true);
    expect(isUserRejectionError(new Error("Request rejected"))).toBe(true);
    expect(isUserRejectionError(new Error("Network connection failed"))).toBe(false);
  });

  it("disables Sentry initialization when DSN is absent", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const initialized = initSentry();
    expect(initialized).toBe(false);
  });

  it("initializes Sentry when NEXT_PUBLIC_SENTRY_DSN is present", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example.com/1";
    process.env.NEXT_PUBLIC_ENVIRONMENT = "testnet";
    process.env.NEXT_PUBLIC_RELEASE = "1.2.0";

    const initialized = initSentry();
    expect(initialized).toBe(true);
    expect(window.__SENTRY_CONFIG__?.enabled).toBe(true);
    expect(window.__SENTRY_CONFIG__?.dsn).toBe("https://public@sentry.example.com/1");
  });

  it("captures non-rejection exceptions with context and breadcrumbs", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example.com/1";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    addBreadcrumb({ category: "api", message: "POST /api/schedules" });
    captureException(new Error("Backend API 500 error"), { vaultId: "V123" });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("drops user rejection from captureException and adds a benign breadcrumb", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example.com/1";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    captureException(new Error("User declined transaction"));
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
