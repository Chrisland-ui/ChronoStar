import { SECONDS_PER_LEDGER } from "./network";

export { SECONDS_PER_LEDGER };

export function ledgersToHuman(
  ledgers: number,
  secondsPerLedger: number = SECONDS_PER_LEDGER,
): string {
  if (ledgers <= 0) return "now";
  const seconds = ledgers * secondsPerLedger;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `~${(seconds / 3600).toFixed(1).replace(/\.0$/, "")} hours`;
  return `~${(seconds / 86400).toFixed(1).replace(/\.0$/, "")} days`;
}
