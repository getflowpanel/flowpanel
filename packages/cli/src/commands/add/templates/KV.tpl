"use client";

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
