export type SystemStatus = "healthy" | "under" | "over";

export function getSystemStatus(latest?: {
  discardRate: number;
  avgLength: number;
} | null): SystemStatus {
  if (!latest) return "healthy";

  if (latest.discardRate > 0.50 || latest.avgLength > 75) {
    return "over";
  }

  if (latest.discardRate < 0.05 || latest.avgLength < 40) {
    return "under";
  }

  return "healthy";
}
