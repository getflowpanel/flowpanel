import type {
  ErrorContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { reportUnexpectedError, resolveFormatting } from "@flowpanel/core";
import { csvLine, dayKeyIn } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { exportTarget } from "../runtime/action-gate";
import { actorIdFromSession, buildAuditEvent, maybeEmitAudit } from "../runtime/action-helpers";
import { fieldLabels } from "../runtime/field-labels";
import { listRequestFromParams } from "../runtime/list-request";
import { type ListRowsPage, type ListRowsQuery, listRows } from "../runtime/list-rows";
import { majorAmount, moneyDigits } from "../runtime/money-field";
import { resourceNavName } from "../runtime/nav";
import { declaredFieldName } from "../runtime/readable-fields";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";
import { toWireValue } from "../wire/serialize";

const DEFAULT_MAX_ROWS = 10_000;
const BATCH = 500;

type Format = "csv" | "json";
type Row = Record<string, unknown>;

/** Header text per field: its label, or its name where an earlier column has that label; import reads it back. */
function exportHeaders(resource: ResourceConfig, fields: readonly string[]): string[] {
  const labelOf = fieldLabels(resource);
  const seen = new Set<string>();
  return fields.map((field) => {
    const label = labelOf(field);
    const header = seen.has(label.toLowerCase()) ? field : label;
    seen.add(header.toLowerCase());
    return header;
  });
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
  timeZone: string,
): string {
  const parts = [
    name,
    filtered ? "filtered" : "all",
    ...(capped === null ? [] : [`first-${capped}`]),
    dayKeyIn(now, timeZone),
  ];
  return `${parts.join("-").replace(/[^A-Za-z0-9._-]+/g, "-")}.${format}`;
}

/** A cell as the file holds it: a money amount in major units, `59.00`, anything else as stored. */
function cell(row: Row, field: string, money: ReadonlyMap<string, number>): unknown {
  const digits = money.get(field);
  return digits === undefined ? row[field] : majorAmount(row[field], digits);
}

function encodeRows(
  format: Format,
  fields: readonly string[],
  rows: Row[],
  first: boolean,
  money: ReadonlyMap<string, number>,
) {
  if (format === "csv") {
    return rows
      .map((row) => `${csvLine(fields.map((field) => cell(row, field, money)))}\r\n`)
      .join("");
  }
  return rows
    .map((row, index) => {
      const item = Object.fromEntries(
        fields.map((field) => {
          const value = cell(row, field, money);
          return [
            field,
            money.has(field) && typeof value === "string"
              ? Number(value)
              : toWireValue(value ?? null, field),
          ];
        }),
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
      return { spec: exportTarget(resource), target: resource };
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
      const money = moneyDigits(config, resource);
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
              format === "csv" ? `${csvLine(exportHeaders(resource, fields))}\r\n` : "[",
            ),
          );
        },
        async pull(controller) {
          try {
            page ??= await listRows(config, resource, reqCtx, { ...query, page: index, pageSize });
            const rows = page.rows.slice(0, maxRows - sent);
            controller.enqueue(encoder.encode(encodeRows(format, fields, rows, sent === 0, money)));
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
          "content-disposition": `attachment; filename="${fileName(name, filtered, capped, format, new Date(), resolveFormatting(config.formatting).timeZone)}"`,
          "cache-control": "no-store",
          ...(capped === null ? {} : { "x-flowpanel-export-capped": String(capped) }),
        },
      });
    },
  });
}
