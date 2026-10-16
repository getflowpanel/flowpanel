import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  FlowpanelOperationDisabledError,
  FlowpanelValidationError,
  mergeLabels,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { safeErrorMessage } from "../runtime/action-helpers";
import { applyActionResult } from "../runtime/apply-action-result";
import { coerceRowByColumns } from "../runtime/coerce-values";
import { fieldLabels } from "../runtime/field-labels";
import { buildHref } from "../runtime/href";
import { decodeMoneyCells, moneyDigits } from "../runtime/money-field";
import { resourceNavName } from "../runtime/nav";
import { parseImport } from "../runtime/parse-import";
import { declaredFormFields } from "../runtime/resolve-form-fields";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";
import { makeActions } from "./resource-actions";

function pick(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in row) out[k] = row[k];
  return out;
}

/** Each cell under its field's name, so a header may be the name, the export's header or the form's label, in any case. */
function byFieldName(
  row: Record<string, unknown>,
  fields: readonly string[],
  labelsOf: ReadonlyArray<(name: string) => string>,
): Record<string, unknown> {
  const fieldOf = new Map<string, string>();
  const key = (text: string) => text.trim().toLowerCase();
  for (const labelOf of labelsOf) {
    for (const field of fields)
      if (!fieldOf.has(key(labelOf(field)))) fieldOf.set(key(labelOf(field)), field);
  }
  for (const field of fields) fieldOf.set(key(field), field);
  const out: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(row)) {
    const field = fieldOf.get(key(header)) ?? header;
    if (!(field in out) || field === header) out[field] = value;
  }
  return out;
}

class BodyTooLargeError extends Error {}

/** Reads `req`'s body, aborting once `maxBytes` is exceeded — chunked requests have no
 *  `content-length` to pre-check, so the cap has to be enforced while streaming. */
async function readBodyCapped(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(out);
}

/** Per-row failure message: each field's, in the form's words, named by the field's label. */
function rowErrorMessage(err: unknown, labelOf: (name: string) => string): string {
  if (err instanceof FlowpanelValidationError) {
    const details = Object.entries(err.fieldErrors)
      .map(([field, msg]) => {
        const label = labelOf(field);
        return msg.includes(label) ? msg : `${label}: ${msg}`;
      })
      .join("; ");
    if (details) return details;
  }
  return safeErrorMessage(err);
}

/** Hard caps on a single import request. */
const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB of decoded text
const MAX_IMPORT_REQUEST_BYTES = MAX_IMPORT_BYTES * 2;

/** The posted `{ format, content }` parsed into rows, or the 4xx that answers it. */
async function readImportRows(
  req: Request,
  formats: readonly ("csv" | "json")[],
): Promise<Record<string, unknown>[] | Response> {
  const declaredLength = req.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_IMPORT_REQUEST_BYTES) {
    return actionFailure("payload_too_large", "file too large");
  }
  let raw: string;
  try {
    raw = await readBodyCapped(req, MAX_IMPORT_REQUEST_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return actionFailure("payload_too_large", "file too large");
    return actionFailure("bad_request", "bad request");
  }
  let body: { format?: unknown; content?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return actionFailure("bad_request", "bad request");
  }
  const format = body.format === "json" ? "json" : "csv";
  if (!formats.includes(format)) {
    return actionFailure("bad_request", `format "${format}" not allowed`);
  }
  if (typeof body.content !== "string") {
    return actionFailure("bad_request", "missing file content");
  }
  if (body.content.length > MAX_IMPORT_BYTES) {
    return actionFailure("payload_too_large", "file too large");
  }
  let rows: Record<string, unknown>[];
  try {
    rows = parseImport(format, body.content);
  } catch (e) {
    return actionFailure("bad_request", safeErrorMessage(e));
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return actionFailure("validation_failed", `too many rows (max ${MAX_IMPORT_ROWS})`);
  }
  return rows;
}

/** POST /api/flowpanel/<resource>/import — each row goes through the create path; one publish at the end. */
export function importRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string }, ResourceConfig>(config, {
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      return { spec: { resource, operation: "create" }, target: resource };
    },
    handle: async ({ req, reqCtx, target: resource }) => {
      const importOpt = resource.options.import;
      if (!importOpt) return actionFailure("not_found", "import not enabled");
      if (resource.options.create?.disabled) {
        throw new FlowpanelOperationDisabledError("Create is disabled for this resource.");
      }
      const rows = await readImportRows(req, importOpt.formats ?? ["csv", "json"]);
      if (rows instanceof Response) return rows;

      const allowed = importOpt.fields as string[] | undefined;
      const { columns } = config.adapter.introspect(writeTarget(resource));
      const labels = mergeLabels(config.labels);
      const labelOf = fieldLabels(resource, declaredFormFields(resource, "create"));
      const named =
        allowed ??
        columns
          .filter((column) => !column.primaryKey && column.writableOnCreate !== false)
          .map((column) => column.name);
      const headerLabels = [fieldLabels(resource), labelOf];
      const digits = moneyDigits(config, resource);
      const actions = makeActions(config, resource, { reqCtx, publish: false });
      let imported = 0;
      const failed: { row: number; error: string }[] = [];
      for (const [index, rawRow] of rows.entries()) {
        if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
          failed.push({ row: index + 1, error: labels.importer.notObject });
          continue;
        }
        try {
          const keyed = byFieldName(rawRow, named, headerLabels);
          const picked = allowed || columns.length > 0 ? pick(keyed, named) : keyed;
          const money = decodeMoneyCells(picked, digits, labelOf, labels);
          const coerced = coerceRowByColumns(columns, money.values, labels, undefined, labelOf);
          await actions.create(coerced.values, {
            decodeErrors: { ...coerced.fieldErrors, ...money.fieldErrors },
          });
          imported++;
        } catch (e) {
          failed.push({ row: index + 1, error: rowErrorMessage(e, labelOf) });
        }
      }
      if (imported > 0) {
        // Rows are already committed, so a failed notify must never turn this into a retryable error.
        const name = resourceNavName(resource);
        await applyActionResult(
          { ok: true },
          { resourceName: name, change: { action: "create" }, pathname: buildHref(config, name) },
        );
      }
      return Response.json({ ok: true, imported, failed });
    },
  });
}
