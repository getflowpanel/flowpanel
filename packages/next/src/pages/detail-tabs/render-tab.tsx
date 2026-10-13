import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetContext,
} from "@flowpanel/core";
import { resolveResourceName } from "@flowpanel/core";
import type { ReactNode } from "react";
import { rowKeyOf } from "../../runtime/row-identity";
import { buildWidgetContext, detailTabDateRange, tabContextOf } from "../../runtime/widget-context";
import { renderFieldsTab } from "./render-fields-tab";
import { renderRelatedTab } from "./render-related-tab";
import { renderWidgetsTab } from "./render-widgets-tab";
import { tabCountLabels } from "./tab-counts";

export { RELATED_PAGE_PREFIX, RELATED_SORT_PREFIX } from "./render-related-tab";

export interface DetailTabArgs<Row extends Record<string, unknown>> {
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  resource: ResourceConfig;
  row: Row;
  tab: DetailTab<Row>;
  req: Request;
  searchParams: URLSearchParams;
  /** The context the page's tabs share; built from the row when absent. */
  ctx?: WidgetContext;
}

/** One detail tab, in declaration precedence: custom, widgets, related, fields. */
export async function renderDetailTab<Row extends Record<string, unknown>>({
  config,
  reqCtx,
  resource,
  row,
  tab,
  req,
  searchParams,
  ctx,
}: DetailTabArgs<Row>): Promise<ReactNode> {
  const rowKey = rowKeyOf(resource);
  const name = resolveResourceName(resource);
  const shared =
    ctx ?? buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row, rowKey, name);
  if (tab.render) return tab.render(row, tabContextOf(shared));
  if (tab.widgets !== undefined && tab.resource) {
    return (
      <div className="fp-space-y-4">
        {await renderWidgetsTab(config, reqCtx, row, tab, req, rowKey, name, shared)}
        {await renderRelatedTab(config, reqCtx, row, tab, req, searchParams)}
      </div>
    );
  }
  if (tab.widgets !== undefined)
    return renderWidgetsTab(config, reqCtx, row, tab, req, rowKey, name, shared);
  if (tab.resource) return renderRelatedTab(config, reqCtx, row, tab, req, searchParams);
  return renderFieldsTab<Row>(config, reqCtx, resource, row, {
    ...(tab.fields ? { fields: tab.fields } : {}),
    ...(tab.sections ? { sections: tab.sections } : {}),
    ...(tab.emptyState ? { emptyState: tab.emptyState } : {}),
  });
}

/** Keep the tab list, but execute only the selected visible tab on the server; count the counted ones. */
export async function renderDetailTabs<Row extends Record<string, unknown>>(
  args: Omit<DetailTabArgs<Row>, "tab"> & {
    visible: DetailTab<Row>[];
    active: DetailTab<Row> | undefined;
  },
): Promise<Array<{ key: string; label: string; content: ReactNode }>> {
  const { visible, active, ...rest } = args;
  const rowKey = rowKeyOf(rest.resource);
  const ctx =
    rest.ctx ??
    buildWidgetContext(
      rest.config,
      rest.reqCtx,
      rest.req,
      detailTabDateRange(),
      rest.row,
      rowKey,
      resolveResourceName(rest.resource),
    );
  const [labels, content] = await Promise.all([
    tabCountLabels(ctx, rest.row, visible as DetailTab<Record<string, unknown>>[]),
    active ? renderDetailTab({ ...rest, ctx, tab: active }) : Promise.resolve(null),
  ]);
  return visible.map((tab) => ({
    key: tab.key,
    label: labels.get(tab.key) ?? tab.label,
    content: tab === active ? content : null,
  }));
}
