import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { Section } from "@flowpanel/react";
import type { ReactNode } from "react";
import { buildWidgetContext, detailTabDateRange } from "../../runtime/widget-context";
import { renderSlots, slotElements } from "../detail-page/widget-slots";
import { sectionColumns } from "../widget-slot";

/** Dashboard widgets, in the dashboard's own grid, queried against one record. */
export async function renderWidgetsTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  row: Row,
  tab: DetailTab<Row>,
  req: Request,
  rowKey: string,
  resource: string,
  shared?: WidgetContext,
): Promise<ReactNode> {
  const widgets = tab.widgets ?? [];
  const columns = sectionColumns(tab.columns, widgets, 2);
  if (widgets.length === 0) {
    return (
      <Section columns={columns}>
        <p className="fp-text-sm fp-text-faint">
          {tab.emptyState ?? mergeLabels(config.labels).widget.empty}
        </p>
      </Section>
    );
  }
  const ctx =
    shared ?? buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row, rowKey, resource);
  const slots = await renderSlots(widgets, ctx, config, reqCtx, `${resource} tab "${tab.key}"`);
  return <Section columns={columns}>{slotElements(slots)}</Section>;
}
