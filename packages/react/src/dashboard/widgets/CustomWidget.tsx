"use client";

import type { CustomWidgetData, SerializedCustomWidget } from "@flowpanel/core";
import type { ComponentType } from "react";

export interface CustomWidgetProps {
  widget: SerializedCustomWidget;
  data?: CustomWidgetData;
  loading?: boolean;
  error?: string;
  /** Map of widget id → React component (consumer-provided). */
  components?: Record<string, ComponentType<{ data: unknown; loading: boolean }>>;
}

export function CustomWidget({ widget, data, loading, error, components }: CustomWidgetProps) {
  const Component = components?.[widget.id];

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{widget.label}</h3>
        {widget.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{widget.description}</p>
        )}
      </div>
      <div className="p-4">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : Component ? (
          <Component data={data?.data ?? null} loading={Boolean(loading)} />
        ) : (
          <div className="text-sm text-muted-foreground">
            Pass a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">components</code> prop
            to <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">DashboardPage</code>{" "}
            mapping this widget id (
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{widget.id}</code>) to
            a React component.
          </div>
        )}
      </div>
    </div>
  );
}
