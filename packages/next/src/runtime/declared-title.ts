import type {
  DetailHeaderContext,
  DetailOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import type { ReactNode } from "react";
import { cache } from "react";

type Row = Record<string, unknown>;

const titleSlot = cache(
  (
    _config: ResolvedAdminConfig,
    _resource: ResourceConfig,
    _id: string,
    _reqCtx: RequestContext,
  ): { title?: Promise<ReactNode | string | null | undefined> } => ({}),
);

/** `detail.title` for one record, run once per request: the page heading and its `<title>` share it. */
export function declaredTitle(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
  row: Row,
  ctx: DetailHeaderContext,
): Promise<ReactNode | string | null | undefined> {
  const title = (resource.options.detail as DetailOptions<Row> | undefined)?.title;
  if (!title) return Promise.resolve(undefined);
  const slot = titleSlot(config, resource, id, reqCtx);
  slot.title ??= Promise.resolve().then(() => title(row, ctx));
  return slot.title;
}
