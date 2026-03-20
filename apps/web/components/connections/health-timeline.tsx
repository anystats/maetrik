"use client";

import type { HealthBucket } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

const BUCKET_MS = 30 * 60 * 1000; // 30 minutes

interface HealthTimelineProps {
  /** Array of health buckets from the API */
  healthLog: HealthBucket[];
  /** Number of 30-min blocks to display (default: 96 = 48h) */
  blocks?: number;
  /** Current health status — used for empty state color hint */
  healthStatus?: "green" | "yellow" | "red";
}

export function HealthTimeline({
  healthLog,
  blocks = 96,
  healthStatus,
}: HealthTimelineProps) {
  // Build a map of bucket_start -> bucket for fast lookup
  const bucketMap = new Map<number, HealthBucket>();
  for (const bucket of healthLog) {
    const ts = new Date(bucket.bucket_start).getTime();
    bucketMap.set(ts, bucket);
  }

  // Generate the time slots from (now - blocks * 30min) to now
  const now = Date.now();
  const currentBucket = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const slots: { time: number; bucket?: HealthBucket }[] = [];

  for (let i = blocks - 1; i >= 0; i--) {
    const time = currentBucket - i * BUCKET_MS;
    slots.push({ time, bucket: bucketMap.get(time) });
  }

  return (
    <div
      className="flex items-center"
      style={{ height: "4px", gap: "1px" }}
      title={
        healthStatus
          ? `Status: ${healthStatus}`
          : undefined
      }
    >
      {slots.map((slot) => {
        const status = slot.bucket?.health_status;
        const colorClass = status
          ? STATUS_COLORS[status] ?? "bg-muted"
          : "bg-muted";

        return (
          <div
            key={slot.time}
            className={`rounded-[0.5px] h-full ${colorClass}`}
            style={{ width: "2px", minWidth: "2px" }}
            title={
              slot.bucket
                ? `${new Date(slot.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${slot.bucket.health_status}${slot.bucket.degradation_message ? `: ${slot.bucket.degradation_message}` : ""}`
                : new Date(slot.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          />
        );
      })}
    </div>
  );
}
