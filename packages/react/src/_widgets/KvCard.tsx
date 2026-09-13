import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";

export interface KvCardItem {
  label: string;
  /** Already formatted on the server, so the card renders it verbatim. */
  value: React.ReactNode;
  tone?: Tone;
  /** Renders the value as a link. */
  href?: string;
}

export interface KvCardProps {
  label?: string;
  items: KvCardItem[];
  columns?: 1 | 2;
}

/** The facts about one thing, as a `kv()` widget. */
export function KvCard({ label, items, columns = 2 }: KvCardProps) {
  return (
    <Card className="h-full">
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={label ? "pt-0" : ""}>
        <dl className={cn("grid gap-3", columns === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {items.map((item) => (
            <div key={item.label} data-tone={item.tone}>
              <dt className="truncate text-xs uppercase tracking-wide text-fp-text-3">
                {item.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-medium tabular-nums text-fp-text-1">
                {item.href ? (
                  <a href={item.href} className="hover:underline">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
