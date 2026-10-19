import type {
  ColumnFormat,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { formatColumnValue, type ResolvedFormatting } from "@flowpanel/core/format";
import { fieldLabels, namedFields } from "../runtime/field-labels";
import { readableByCaller, resourceNavName } from "../runtime/nav";
import { resolveReadableFieldSet } from "../runtime/readable-fields";
import { readRelatedPage } from "../runtime/require-authorized";
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
  const matches = words.map(([title, ...rest]) =>
    title?.toLowerCase().includes(needle)
      ? undefined
      : rest.find((text) => text.toLowerCase().includes(needle)),
  );
  const lines = words.map(([title, ...rest], index): [string | undefined, string | undefined] => [
    title,
    matches[index] ?? rest[0],
  ]);
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
    const tell = differs(words, 1) ?? differs(shown, 0);
    const matched = matches[index];
    if (tell === undefined) return [title, detail];
    return [title, matched && matched !== tell ? `${matched} · ${tell}` : tell];
  });
}

/** A row's list columns outside its search fields, as "Label: cell", to tell look-alike results apart. */
function shownColumns(
  resource: ResourceConfig,
  rows: ReadonlyArray<Record<string, unknown>>,
  skip: ReadonlySet<string>,
  formatting: ResolvedFormatting,
  labelOf: (field: string) => string,
): string[][] {
  const columns = (resource.options.columns ?? []).flatMap((column) => {
    const def = typeof column === "string" ? { field: column } : column;
    const field = def.field === undefined ? "" : String(def.field);
    return field === "" || skip.has(field) || def.reference ? [] : [{ field, format: def.format }];
  });
  const cell = (value: unknown, format: ColumnFormat | undefined): string => {
    if (format !== undefined)
      return value == null || value === "" ? "" : formatColumnValue(value, format, formatting);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  };
  return rows.map((row) =>
    columns.map(({ field, format }) => {
      const text = cell(row[field], format);
      return text === "" ? "" : `${labelOf(field)}: ${text}`;
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
  const page = await readRelatedPage(config, resource, reqCtx, {
    search: query,
    searchFields: fields,
    pageSize: PER_RESOURCE,
    extraFields: fields,
  });
  if (!page) return null;
  const name = resourceNavName(resource);
  const rowKey = rowKeyOf(resource);
  const rows = page.rows;
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
      fieldLabels(resource, [], namedFields(config)),
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
