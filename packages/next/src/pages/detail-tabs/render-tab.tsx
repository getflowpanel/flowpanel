import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import type { ReactNode } from "react";
import { buildDetailTabContext } from "../../runtime/widget-context";
import { renderFieldsTab } from "./render-fields-tab";
import { renderRelatedTab } from "./render-related-tab";
import { renderWidgetsTab } from "./render-widgets-tab";

export { RELATED_PAGE_PREFIX, RELATED_SORT_PREFIX } from "./render-related-tab";

export interface DetailTabArgs<Row extends Record<string, unknown>> {
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  resource: ResourceConfig;
  row: Row;
  tab: DetailTab<Row>;
  req: Request;
  searchParams: URLSearchParams;
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
}: DetailTabArgs<Row>): Promise<ReactNode> {
  if (tab.render) return tab.render(row, buildDetailTabContext(config, reqCtx, req, row));
  if (tab.widgets !== undefined) return renderWidgetsTab(config, reqCtx, row, tab, req);
  if (tab.resource) return renderRelatedTab(config, reqCtx, row, tab, req, searchParams);
  return renderFieldsTab<Row>(config, reqCtx, resource, row, {
    ...(tab.fields ? { fields: tab.fields } : {}),
    ...(tab.sections ? { sections: tab.sections } : {}),
  });
}

/** Keep the tab list, but execute only the selected visible tab on the server. */
export async function renderDetailTabs<Row extends Record<string, unknown>>(
  args: Omit<DetailTabArgs<Row>, "tab"> & {
    visible: DetailTab<Row>[];
    active: DetailTab<Row> | undefined;
  },
): Promise<Array<{ key: string; label: string; content: ReactNode }>> {
  const { visible, active, ...rest } = args;
  const out: Array<{ key: string; label: string; content: ReactNode }> = [];
  for (const tab of visible) {
    out.push({
      key: tab.key,
      label: tab.label,
      content: tab === active ? await renderDetailTab({ ...rest, tab }) : null,
    });
  }
  return out;
}

/** Build a tab's explicitly declared field dependencies without reading `*` as a DB wildcard. */
export function detailFieldsForTab<Row>(baseFields: Set<string>, tab: DetailTab<Row>): Set<string> {
  const fields = new Set(baseFields);
  const add = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (typeof entry === "string" || typeof entry === "number" || typeof entry === "symbol") {
        fields.add(String(entry));
      } else if (entry && typeof entry === "object" && typeof entry.name === "string") {
        fields.add(entry.name);
      }
    }
  };
  add(tab.fields);
  for (const section of tab.sections ?? []) add(section.fields);
  return fields;
}
