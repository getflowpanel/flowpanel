"use client";

import type { ListWidgetData, SerializedListWidget } from "@flowpanel/core";
import { Skeleton } from "../../ui/skeleton";

export interface ListWidgetProps {
  widget: SerializedListWidget;
  data?: ListWidgetData;
  loading?: boolean;
  error?: string;
}

export function ListWidget({ widget, data, loading, error }: ListWidgetProps) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{widget.label}</h3>
        {widget.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{widget.description}</p>
        )}
      </div>

      {error ? (
        <div className="p-4 text-sm text-destructive">{error}</div>
      ) : loading || !data ? (
        <ul className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </li>
          ))}
        </ul>
      ) : data.items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {widget.emptyMessage ?? `No ${widget.label.toLowerCase()} yet`}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.items.map((item, i) => {
            const inner = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.primary}</div>
                  {item.secondary && (
                    <div className="truncate text-xs text-muted-foreground">{item.secondary}</div>
                  )}
                </div>
                {item.badge !== undefined && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                    {item.badge}
                  </span>
                )}
                {item.meta && <span className="text-xs text-muted-foreground">{item.meta}</span>}
              </>
            );
            return (
              <li key={i}>
                {item.href ? (
                  <a
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
