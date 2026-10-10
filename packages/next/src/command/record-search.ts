import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { createResourceController } from "../controllers/resource-controller";
import { readableByCaller, resourceNavName } from "../runtime/nav";
import { resolveReadableFieldSet } from "../runtime/readable-fields";
import { pluralLabel } from "../runtime/resource-title";
import { openRowHrefs } from "../runtime/row-click";
import { rowIdentity, rowKeyOf } from "../runtime/row-identity";
import { withGuards } from "../runtime/with-guards";
import {
  MIN_RECORD_QUERY,
  type RecordSearchGroup,
  type RecordSearchItem,
} from "./record-search-wire";

const PER_RESOURCE = 5;

/** The row's own words for a result line: its first two non-empty search fields. */
function lineOf(row: Record<string, unknown>, fields: string[]): string[] {
  return fields
    .map((field) => row[field])
    .filter(
      (value): value is string | number => typeof value === "string" || typeof value === "number",
    )
    .map(String)
    .filter((text) => text.trim() !== "")
    .slice(0, 2);
}

async function searchResource(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  query: string,
  reqCtx: RequestContext,
): Promise<RecordSearchGroup | null> {
  if (!(await readableByCaller(resource, reqCtx))) return null;
  // A caller who may read none of the search fields would get rows the query never matched.
  const fields = [
    ...(await resolveReadableFieldSet(
      (resource.options.search ?? []).map(String),
      resource.options.fieldAccess,
      reqCtx,
    )),
  ];
  if (fields.length === 0) return null;
  const result = await createResourceController(config, resource, reqCtx).list({
    search: query,
    pageSize: PER_RESOURCE,
  });
  if (!result.ok) return null;
  const name = resourceNavName(resource);
  const rowKey = rowKeyOf(resource);
  const rows: Record<string, unknown>[] = result.data.rows;
  const hrefs = openRowHrefs(config, name, resource, rows, rowKey) ?? [];
  const items = rows.flatMap((row, index): RecordSearchItem[] => {
    const href = hrefs[index];
    if (!href) return [];
    const [title, detail] = lineOf(row, fields);
    return [
      { title: title ?? rowIdentity(row, rowKey) ?? "", ...(detail ? { detail } : {}), href },
    ];
  });
  return items.length > 0 ? { resource: name, label: pluralLabel(resource, name), items } : null;
}

/**
 * `GET <api>/palette/search?q=` — the command palette's record search. Each resource with
 * `search` fields answers through its own list read, so access, scope and field rules apply.
 */
export function recordSearchRoute(config: ResolvedAdminConfig) {
  return function GET(req: Request): Promise<Response> {
    return withGuards(config, req, { operation: "read", write: false }, async (reqCtx) => {
      const query = (new URL(req.url).searchParams.get("q") ?? "").trim();
      if (query.length < MIN_RECORD_QUERY) return Response.json({ ok: true, groups: [] });
      const searchable = [...config.resourcesByName.values()].filter(
        (resource) => !resource.options.hidden && (resource.options.search?.length ?? 0) > 0,
      );
      const groups = await Promise.all(
        searchable.map((resource) => searchResource(config, resource, query, reqCtx)),
      );
      return Response.json({
        ok: true,
        groups: groups.filter((group): group is RecordSearchGroup => group !== null),
      });
    });
  };
}
