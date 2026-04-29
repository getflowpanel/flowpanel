"use client";

/**
 * StatCard — a compact metric tile you own. Edit freely.
 */
import { Card } from "@flowpanel/react";

export interface StatCardProps {
  label: string;
  value: number | string | null;
  prefix?: string;
  suffix?: string;
  trend?: { delta: number; direction: "up" | "down" | "flat" } | null;
}

export function StatCard({ label, value, prefix, suffix, trend }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {prefix}
        {value == null ? "—" : value}
        {suffix}
      </div>
      {trend && (
        <div
          className={
            trend.direction === "up"
              ? "mt-1 text-xs text-green-600"
              : trend.direction === "down"
                ? "mt-1 text-xs text-red-600"
                : "mt-1 text-xs text-muted-foreground"
          }
        >
          {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "·"} {Math.abs(trend.delta)}
        </div>
      )}
    </Card>
  );
}
