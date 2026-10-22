import type {
  VaultEntry,
  StreamEntry,
  DCAEntry,
  DCAExecutionHistory,
  ScheduleEvent,
  Stats,
} from "@/types";
import { captureException, addBreadcrumb } from "./sentry";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const configuredTimeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS);
const DEFAULT_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0 && configuredTimeout <= 2_147_483_647
    ? configuredTimeout
    : 10_000;

export interface ApiRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ApiTimeoutError extends Error {
  constructor() {
    super("The request timed out. Please retry.");
    this.name = "ApiTimeoutError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof ApiTimeoutError
    ? error.message
    : "Failed to load data. Please check your connection and try again.";
}

export async function fetchJSON<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  addBreadcrumb({ category: "api", message: `Fetching ${path}`, level: "info" });
  if (options.signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
  const controller = new AbortController();
  const cancel = () => controller.abort(new DOMException("Request cancelled", "AbortError"));
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort(controller.signal.reason);
  controller.signal.addEventListener("abort", onAbort, { once: true });
  options.signal?.addEventListener("abort", cancel, { once: true });
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutMs =
    Number.isFinite(requestedTimeout) && requestedTimeout > 0 && requestedTimeout <= 2_147_483_647
      ? requestedTimeout
      : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(new ApiTimeoutError()), timeoutMs);
  try {
    const request = async (): Promise<T> => {
      const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
      return (await res.json()) as T;
    };
    return await Promise.race([request(), aborted]);
  } catch (error) {
    const failure = controller.signal.aborted ? controller.signal.reason : error;
    if (!isAbortError(failure)) captureException(failure, { path });
    throw failure;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export const api = {
  getSchedules: (address: string, options?: ApiRequestOptions) =>
    fetchJSON<VaultEntry[]>(`/api/schedules/${address}`, options),
  getStreams: (address: string, options?: ApiRequestOptions) =>
    fetchJSON<StreamEntry[]>(`/api/streams/${address}`, options),
  getDCA: (address: string, options?: ApiRequestOptions) =>
    fetchJSON<DCAEntry[]>(`/api/dca/${address}`, options),
  getDCAHistory: (
    address: string,
    dcaId: number,
    start = 1,
    limit = 50,
    options?: ApiRequestOptions,
  ) =>
    fetchJSON<DCAExecutionHistory>(
      `/api/dca/${address}/${dcaId}/history?start=${start}&limit=${limit}`,
      options,
    ),
  getEvents: (limit?: number, options?: ApiRequestOptions) =>
    fetchJSON<ScheduleEvent[]>(`/api/events${limit ? `?limit=${limit}` : ""}`, options),
  getStats: (options?: ApiRequestOptions) => fetchJSON<Stats>("/api/stats", options),
};
