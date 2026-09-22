import type { DetailTab, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { WidgetErrorBoundary } from "@flowpanel/next/client";
import { ErrorCard, Section } from "@flowpanel/react";
import type { ReactNode } from "react";
import { renderWidget } from "../../runtime/render-widget";
import { buildWidgetContext, detailTabDateRange } from "../../runtime/widget-context";
import { widgetSlotClassName } from "../widget-slot";

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Dashboard widgets, in the dashboard's own grid, queried against one record. */
export async function renderWidgetsTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  row: Row,
  tab: DetailTab<Row>,
  req: Request,
): Promise<ReactNode> {
  const widgets = tab.widgets ?? [];
  if (widgets.length === 0) {
    return (
      <Section columns={tab.columns ?? 2}>
        <p className="text-sm text-fp-text-3">{mergeLabels(config.labels).widget.empty}</p>
      </Section>
    );
  }

  const ctx = buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row);
  // The tab payload is awaited before it reaches the client, so one rejected
  // query has to become one card here rather than reject the whole page.
  const rendered = await Promise.all(
    widgets.map(async (widget, index) => {
      try {
        return {
          className: widgetSlotClassName(widget),
          node: await renderWidget(widget, ctx, config, reqCtx),
        };
      } catch (cause) {
        console.error(`[flowpanel] detail widget "${tab.key}.w${index}" failed`, cause);
        return {
          className: widgetSlotClassName(widget),
          node: <ErrorCard error={asError(cause)} />,
        };
      }
    }),
  );

  return (
    <Section columns={tab.columns ?? 2}>
      {rendered.map((slot, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: widget order is stable
          key={index}
          className={slot.className}
        >
          <WidgetErrorBoundary widgetId={`${tab.key}.w${index}`}>{slot.node}</WidgetErrorBoundary>
        </div>
      ))}
    </Section>
  );
}
