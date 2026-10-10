import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { fallbackTitle } from "../pages/detail-page/detail-header";
import { declaredTitle } from "./declared-title";
import { rowVisibility, withSoftDeleteColumn } from "./deleted-row";
import { detailReadPlan } from "./detail-read-plan";
import { projectRowFields, selectKnownFields } from "./project-row";
import { readRecord } from "./record-read";
import { rowKeyOf } from "./row-identity";
import { buildWidgetContext, detailTabDateRange } from "./widget-context";

/** The record page's heading as text for its `<title>`, or `null` where the caller would see not found. */
export async function recordTitle(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  name: string,
  id: string,
  reqCtx: RequestContext,
): Promise<string | null> {
  const plan = await detailReadPlan(config, resource, reqCtx, new URL(reqCtx.req.url).searchParams);
  const known = config.adapter.introspect(resource.ref).columns;
  const row = await readRecord(
    config,
    resource,
    id,
    reqCtx,
    withSoftDeleteColumn(resource, selectKnownFields(plan.firstRead, known)),
  );
  if (!row || (await rowVisibility(resource, row, reqCtx)) === "hidden") return null;
  const projected = projectRowFields(row, plan.readableBaseFields);
  const ctx = buildWidgetContext(
    config,
    reqCtx,
    reqCtx.req,
    detailTabDateRange(),
    projected,
    rowKeyOf(resource),
    name,
  );
  const declared = await declaredTitle(config, resource, id, reqCtx, projected, {
    format: ctx.format,
    labels: ctx.labels,
    link: ctx.link,
  });
  if (typeof declared === "string" || typeof declared === "number") return String(declared);
  return fallbackTitle(resource, name, projected);
}
