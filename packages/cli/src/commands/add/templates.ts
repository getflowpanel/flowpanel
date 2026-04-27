/**
 * Widget templates copied by `flowpanel add <name>`. Each template is a
 * self-contained React component the user edits freely.
 *
 * Intentionally small: the point is to give you a useful starting point
 * that you own, not a dependency you track. Templates must only import
 * from @flowpanel/react + core UI libs already in the user's project.
 */

export interface WidgetTemplate {
  filename: string;
  exportName: string;
  /** Raw TSX source. `__NAME__` is substituted with the requested name. */
  source: string;
}

export const WIDGETS: Record<string, WidgetTemplate> = {
  "stat-card": {
    filename: "StatCard.tsx",
    exportName: "StatCard",
    source: `"use client";

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
`,
  },
  timeline: {
    filename: "Timeline.tsx",
    exportName: "Timeline",
    source: `"use client";

/**
 * Timeline — vertical list of timestamped events. Edit freely.
 */
import { Card } from "@flowpanel/react";

export interface TimelineItem {
  id: string | number;
  at: Date | string;
  title: string;
  detail?: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <Card className="p-4">
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="flex gap-3 text-sm">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">
              {new Date(it.at).toLocaleString()}
            </span>
            <div>
              <div className="font-medium">{it.title}</div>
              {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
`,
  },
  kv: {
    filename: "KV.tsx",
    exportName: "KV",
    source: `"use client";

/**
 * KV — labeled key/value grid. Edit freely.
 */
import { Card } from "@flowpanel/react";

export function KV({ items }: { items: Record<string, unknown> }) {
  return (
    <Card className="p-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {Object.entries(items).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{String(v ?? "—")}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
`,
  },
};

export function renderWidgetTemplate(name: string, template: WidgetTemplate): string {
  return template.source.replaceAll("__NAME__", name);
}
