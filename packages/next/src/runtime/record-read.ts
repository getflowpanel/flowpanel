import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { cache } from "react";
import { readRow } from "./read-row";

/** One record read per render and projection, shared by the record page and its `<title>`. */
const readOnce = cache(
  (
    config: ResolvedAdminConfig,
    resource: ResourceConfig,
    id: string,
    reqCtx: RequestContext,
    select: string,
  ) => readRow(config, resource, id, reqCtx, select.split("\n").filter(Boolean)),
);

export function readRecord(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
  select: readonly string[],
): Promise<Record<string, unknown> | null> {
  return readOnce(config, resource, id, reqCtx, [...new Set(select)].join("\n"));
}
