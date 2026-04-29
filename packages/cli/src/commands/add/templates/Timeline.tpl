"use client";

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
