import type { ResolvedAdminConfig } from "@flowpanel/core";
import { FlowpanelValidationError, mergeLabels } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { revalidatePath } from "next/cache";
import { actionFailure } from "../runtime/action-failure";
import { notFoundResponse, safeErrorMessage } from "../runtime/action-helpers";
import { coerceRowByColumns } from "../runtime/coerce-values";
import { buildHref } from "../runtime/href";
import { resourceNavName } from "../runtime/nav";
import { parseImport } from "../runtime/parse-import";
import { publishResource } from "../runtime/publish";
import { withGuards } from "../runtime/with-guards";
import { makeActions } from "./resource-actions";

function pick(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in row) out[k] = row[k];
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

/** Per-row failure message. */
function rowErrorMessage(err: unknown): string {
  if (err instanceof FlowpanelValidationError) {
    const details = Object.entries(err.fieldErrors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join("; ");
    if (details) return details;
  }
  return safeErrorMessage(err);
}

/** Hard caps on a single import request. */
const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB of decoded text
const MAX_IMPORT_REQUEST_BYTES = MAX_IMPORT_BYTES * 2;

/** POST /api/flowpanel/<resource>/import — bulk-create rows from an uploaded CSV / JSON file. */
export function importRoute(config: ResolvedAdminConfig) {
  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string }> },
  ): Promise<Response> {
    const { resource: resourceName } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    const importOpt = resource.options.import;
    if (!importOpt) {
      return actionFailure("not_found", "import not enabled");
    }

    if (resource.options.create?.disabled) {
      return actionFailure("operation_disabled", "create is disabled");
    }

    return withGuards(config, req, { resource, operation: "create" }, async (reqCtx) => {
      const declaredLength = req.headers.get("content-length");
      if (declaredLength !== null && Number(declaredLength) > MAX_IMPORT_REQUEST_BYTES) {
        return actionFailure("payload_too_large", "file too large");
      }

      let raw: string;
      try {
        raw = await readBodyCapped(req, MAX_IMPORT_REQUEST_BYTES);
      } catch (e) {
        if (e instanceof BodyTooLargeError) {
          return actionFailure("payload_too_large", "file too large");
        }
        return actionFailure("bad_request", "bad request");
      }

      let body: { format?: unknown; content?: unknown };
      try {
        body = JSON.parse(raw);
      } catch {
        return actionFailure("bad_request", "bad request");
      }
      const format = body.format === "json" ? "json" : "csv";
      const formats = importOpt.formats ?? ["csv", "json"];
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

      const allowed = importOpt.fields as string[] | undefined;
      const { columns } = config.adapter.introspect(writeTarget(resource));
      const labels = mergeLabels(config.labels);
      const actions = makeActions(config, resource, { reqCtx, publish: false });
      let imported = 0;
      const failed: { row: number; error: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
          failed.push({ row: i + 1, error: "row is not an object" });
          continue;
        }
        try {
          const picked = allowed ? pick(rawRow, allowed) : rawRow;
          const { values, fieldErrors } = coerceRowByColumns(columns, picked, labels);
          if (Object.keys(fieldErrors).length > 0) throw new FlowpanelValidationError(fieldErrors);
          await actions.create(values);
          imported++;
        } catch (e) {
          failed.push({ row: i + 1, error: rowErrorMessage(e) });
        }
      }
      if (imported > 0) {
        // Rows are already committed, so a failed notify must never turn this into a retryable error.
        try {
          const name = resourceNavName(resource);
          revalidatePath(buildHref(config, name));
          await publishResource(name, { action: "create" });
        } catch {}
      }
      return Response.json({ ok: true, imported, failed });
    });
  };
}
