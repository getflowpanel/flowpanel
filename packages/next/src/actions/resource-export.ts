import type {
  ErrorContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { humanize, reportUnexpectedError } from "@flowpanel/core";
import { csvField } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { actorIdFromSession, buildAuditEvent, maybeEmitAudit } from "../runtime/action-helpers";
import { columnDefs } from "../runtime/column-defs";
import { listRequestFromParams } from "../runtime/list-request";
import { type ListRowsPage, type ListRowsQuery, listRows } from "../runtime/list-rows";
import { resourceNavName } from "../runtime/nav";
import { declaredFieldName } from "../runtime/readable-fields";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";
import { toWireValue } from "../wire/serialize";

const DEFAULT_MAX_ROWS = 10_000;
const BATCH = 500;

type Format = "csv" | "json";
type Row = Record<string, unknown>;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Header text per field: the column's label, else the field humanized. */
function headers(resource: ResourceConfig, fields: readonly string[]): string[] {
  const labels = new Map<string, string>();
  for (const column of columnDefs(resource)) {
    if (column.field && column.label) labels.set(column.field, column.label);
  }
  return fields.map((field) => labels.get(field) ?? humanize(field));
}

/** The columns, in table order, unless `export.fields` names its own. */
function exportFields(resource: ResourceConfig, readable: ReadonlySet<string>): string[] {
  const options = resource.options.export;
  const wanted = options ? (options.fields ?? []) : [];
  const named =
    wanted.length > 0
      ? wanted.map(String)
      : (resource.options.columns ?? []).flatMap((column) => {
          const field = declaredFieldName(column);
          return field ? [field] : [];
        });
  return [...new Set(named)].filter((field) => readable.has(field));
}

/** `customers-filtered-first-10000-2026-10-09.csv`: what is in the file, read from its name. */
function fileName(
  name: string,
  filtered: boolean,
  capped: number | null,
  format: Format,
  now: Date,
): string {
  const parts = [
    name,
    filtered ? "filtered" : "all",
    ...(capped === null ? [] : [`first-${capped}`]),
    now.toISOString().slice(0, 10),
  ];
  return `${parts.join("-").replace(/[^A-Za-z0-9._-]+/g, "-")}.${format}`;
}

function encodeRows(format: Format, fields: readonly string[], rows: Row[], first: boolean) {
  if (format === "csv") {
    return rows
      .map((row) => `${fields.map((field) => csvField(cellText(row[field]))).join(",")}\r\n`)
      .join("");
  }
  return rows
    .map((row, index) => {
      const item = Object.fromEntries(
        fields.map((field) => [field, toWireValue(row[field] ?? null, field)]),
      );
      return `${first && index === 0 ? "" : ","}\n${JSON.stringify(item)}`;
    })
    .join("");
}

function exportErrorContext(
  config: ResolvedAdminConfig,
  req: Request,
  reqCtx: RequestContext,
): ErrorContext {
  return {
    requestId: reqCtx.requestId ?? "export",
    route: "export",
    method: req.method,
    url: req.url,
    actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
    ip: reqCtx.ip,
    userAgent: reqCtx.userAgent,
  };
}

/** GET /export/<resource>?format=csv&<list params>: every row the list would show, in batches. */
export function exportRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string }, ResourceConfig>(config, {
    write: false,
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      return { spec: { resource, operation: "read" }, target: resource };
    },
    handle: async ({ req, reqCtx, target: resource }) => {
      const options = resource.options.export;
      if (!options) return actionFailure("not_found", "export not enabled");
      const params = new URL(req.url).searchParams;
      const format: Format = params.get("format") === "json" ? "json" : "csv";
      if (!(options.formats ?? ["csv"]).includes(format)) {
        return actionFailure("bad_request", `format "${format}" not allowed`);
      }

      const listing = await listRequestFromParams(config, resource, reqCtx, params);
      const fields = exportFields(resource, listing.query.readable ?? new Set());
      const maxRows = Math.max(1, options.maxRows ?? DEFAULT_MAX_ROWS);
      const query: ListRowsQuery = {
        ...listing.query,
        fields,
        operationalFields: [],
        stableOrder: true,
      };
      const firstPage = await listRows(config, resource, reqCtx, {
        ...query,
        page: 1,
        pageSize: Math.min(BATCH, maxRows),
      });
      const capped = firstPage.total > maxRows ? maxRows : null;
      const name = resourceNavName(resource);
      const filtered =
        listing.search !== "" || Object.keys(listing.filters).length > 0 || !!query.includeDeleted;

      await maybeEmitAudit(
        { ok: true },
        config,
        resource.options.audit,
        buildAuditEvent(config, reqCtx, { action: `${name}.export`, resource: name }),
      );

      const encoder = new TextEncoder();
      const pageSize = Math.min(BATCH, maxRows);
      let page: ListRowsPage | null = firstPage;
      let index = 1;
      let sent = 0;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              format === "csv" ? `${headers(resource, fields).map(csvField).join(",")}\r\n` : "[",
            ),
          );
        },
        async pull(controller) {
          try {
            page ??= await listRows(config, resource, reqCtx, { ...query, page: index, pageSize });
            const rows = page.rows.slice(0, maxRows - sent);
            controller.enqueue(encoder.encode(encodeRows(format, fields, rows, sent === 0)));
            sent += rows.length;
            const done =
              rows.length === 0 ||
              sent >= maxRows ||
              page.rows.length < page.pageSize ||
              sent >= page.total;
            page = null;
            index += 1;
            if (!done) return;
            if (format === "json") controller.enqueue(encoder.encode("\n]\n"));
            controller.close();
          } catch (err) {
            await reportUnexpectedError(
              err,
              exportErrorContext(config, req, reqCtx),
              config.hooks?.onError,
            );
            controller.error(err);
          }
        },
      });

      return new Response(body, {
        headers: {
          "content-type":
            format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${fileName(name, filtered, capped, format, new Date())}"`,
          "cache-control": "no-store",
          ...(capped === null ? {} : { "x-flowpanel-export-capped": String(capped) }),
        },
      });
    },
  });
}
