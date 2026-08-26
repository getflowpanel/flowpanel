import type { ResolvedAdminConfig } from "@flowpanel/core";
import { FlowpanelValidationError } from "@flowpanel/core";
import { revalidatePath } from "next/cache";
import { safeErrorMessage } from "../runtime/action-helpers";
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
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    const importOpt = resource.options.import;
    if (!importOpt) {
      return Response.json({ ok: false, error: "import not enabled" }, { status: 404 });
    }

    if (resource.options.create?.disabled) {
      return Response.json({ ok: false, error: "create is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "create" }, async (reqCtx) => {
      const declaredLength = req.headers.get("content-length");
      if (declaredLength !== null && Number(declaredLength) > MAX_IMPORT_REQUEST_BYTES) {
        return Response.json({ ok: false, error: "file too large" }, { status: 413 });
      }

      let raw: string;
      try {
        raw = await readBodyCapped(req, MAX_IMPORT_REQUEST_BYTES);
      } catch (e) {
        if (e instanceof BodyTooLargeError) {
          return Response.json({ ok: false, error: "file too large" }, { status: 413 });
        }
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }

      let body: { format?: unknown; content?: unknown };
      try {
        body = JSON.parse(raw);
      } catch {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      const format = body.format === "json" ? "json" : "csv";
      const formats = importOpt.formats ?? ["csv", "json"];
      if (!formats.includes(format)) {
        return Response.json(
          { ok: false, error: `format "${format}" not allowed` },
          { status: 400 },
        );
      }
      if (typeof body.content !== "string") {
        return Response.json({ ok: false, error: "missing file content" }, { status: 400 });
      }
      if (body.content.length > MAX_IMPORT_BYTES) {
        return Response.json({ ok: false, error: "file too large" }, { status: 413 });
      }

      let rows: Record<string, unknown>[];
      try {
        rows = parseImport(format, body.content);
      } catch (e) {
        return Response.json({ ok: false, error: safeErrorMessage(e) }, { status: 400 });
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        return Response.json(
          { ok: false, error: `too many rows (max ${MAX_IMPORT_ROWS})` },
          { status: 422 },
        );
      }

      const allowed = importOpt.fields as string[] | undefined;
      const { columns } = config.adapter.introspect(resource.ref);
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
          const { values, fieldErrors } = coerceRowByColumns(columns, picked);
          if (Object.keys(fieldErrors).length > 0) throw new FlowpanelValidationError(fieldErrors);
          await actions.create(values);
          imported++;
        } catch (e) {
          failed.push({ row: i + 1, error: rowErrorMessage(e) });
        }
      }
      if (imported > 0) {
        // Rows are already committed and create is not idempotent, so a failed
        // notify must never turn a partial import into a retryable error.
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
