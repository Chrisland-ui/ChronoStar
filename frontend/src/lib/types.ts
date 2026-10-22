export * from "@/types";

export type ContractEntry =
  import("@/types").VaultEntry | import("@/types").StreamEntry | import("@/types").DCAEntry;

export const isContractEntry = (v: unknown): v is ContractEntry =>
  typeof v === "object" && v !== null && "id" in v && "status" in v;
