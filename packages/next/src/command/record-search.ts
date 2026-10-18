import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { formatColumnValue, type ResolvedFormatting } from "@flowpanel/core/format";
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

/** The row's non-empty search fields, as text. */
function wordsOf(row: Record<string, unknown>, fields: string[]): string[] {
  return fields
    .map((field) => row[field])
    .filter(
      (value): value is string | number => typeof value === "string" || typeof value === "number",
    )
    .map(String)
    .filter((text) => text.trim() !== "");
}

/** Each row's title and second line: the field that matched, else the next one, else one that tells look-alikes apart. */
export function resultLines(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: string[],
  query: string,
  shown: ReadonlyArray<ReadonlyArray<string>> = [],
): Array<[title: string | undefined, detail: string | undefined]> {
  const needle = query.toLowerCase();
  const words = rows.map((row) => wordsOf(row, fields));
  const lines = words.map(([title, ...rest]): [string | undefined, string | undefined] => {
    const matched = title?.toLowerCase().includes(needle)
      ? undefined
      : rest.find((text) => text.toLowerCase().includes(needle));
    return [title, matched ?? rest[0]];
  });
  const seen = new Map<string, number>();
  for (const [title, detail] of lines) {
    const key = `${title}\u0000${detail}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return lines.map(([title, detail], index) => {
    if ((seen.get(`${title}\u0000${detail}`) ?? 0) < 2) return [title, detail];
    const twins = lines.flatMap((line, other) =>
      line[0] === title && line[1] === detail ? [other] : [],
    );
    const differs = (texts: ReadonlyArray<ReadonlyArray<string>>, from: number) =>
      (texts[index] ?? []).find(
        (text, at) =>
          at >= from &&
          text !== "" &&
          twins.filter((twin) => texts[twin]?.[at] === text).length === 1,
      );
    return [title, differs(words, 1) ?? differs(shown, 0) ?? detail];
  });
}

/** A row's list columns outside its search fields, as its cells show them, to tell look-alike results apart. */
function shownColumns(
  resource: ResourceConfig,
  rows: ReadonlyArray<Record<string, unknown>>,
  skip: ReadonlySet<string>,
  formatting: ResolvedFormatting,
): string[][] {
  const columns = (resource.options.columns ?? []).flatMap((column) => {
    const def = typeof column === "string" ? { field: column } : column;
    const field = def.field === undefined ? "" : String(def.field);
    return field === "" || skip.has(field) || def.reference ? [] : [{ field, format: def.format }];
  });
  return rows.map((row) =>
    columns.map(({ field, format }) => {
      const value = row[field];
      if (format !== undefined)
        return value == null || value === "" ? "" : formatColumnValue(value, format, formatting);
      return typeof value === "string" || typeof value === "number" ? String(value) : "";
    }),
  );
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
  const lines = resultLines(
    rows,
    fields,
    query,
    shownColumns(
      resource,
      rows,
      new Set([...fields, rowKey]),
      resolveFormatting(config.formatting),
    ),
  );
  const items = rows.flatMap((row, index): RecordSearchItem[] => {
    const href = hrefs[index];
    if (!href) return [];
    const [title, detail] = lines[index] ?? [];
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
