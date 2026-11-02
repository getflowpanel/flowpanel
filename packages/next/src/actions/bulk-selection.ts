import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { FlowpanelError } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import { invalidJsonResponse } from "../runtime/action-helpers";
import { deleteRow } from "../runtime/delete-row";
import {
  formDataObject,
  type RequestBodyError,
  readJsonObject,
  readRequestFormData,
} from "../runtime/request-body";

type BulkBody =
  | { ok: true; ids: string[]; input: Record<string, unknown> }
  | { ok: false; reason: RequestBodyError | "ids" | "input" };

/** Parses the incoming request body for the array of selected IDs. */
export async function parseBulkBody(req: Request): Promise<BulkBody> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await readJsonObject(req);
    if (!payload.ok) return payload;
    const obj = payload.value as { ids?: unknown; input?: unknown };
    if (!Array.isArray(obj.ids)) return { ok: false, reason: "ids" };
    const ids = obj.ids.filter((v): v is string => typeof v === "string");
    if (ids.length === 0) return { ok: false, reason: "ids" };
    const input = obj.input ?? {};
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, reason: "input" };
    }
    return { ok: true, ids, input: input as Record<string, unknown> };
  }
  const parsedForm = await readRequestFormData(req);
  if (!parsedForm.ok) return parsedForm;
  const form = parsedForm.value;
  const raw = form.getAll("ids");
  const ids: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (v.includes(","))
      ids.push(
        ...v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    else if (v) ids.push(v);
  }
  if (ids.length === 0) return { ok: false, reason: "ids" };
  const input = formDataObject(form);
  delete input.ids;
  return { ok: true, ids, input };
}

/** Hard cap on the number of ids a single bulk action may target. */
export const MAX_BULK = 1000;
export const EXISTENCE_CHECKS_AT_ONCE = 16;

/** Runs `check` over `ids` with at most `limit` in flight; the first rejection rejects the run. */
export async function eachLimited(
  ids: readonly string[],
  limit: number,
  check: (id: string) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    for (let id = ids[next++]; id !== undefined && !failed; id = ids[next++]) {
      try {
        await check(id);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
}

export function bulkBodyFailure(reason: Exclude<BulkBody, { ok: true }>["reason"]): Response {
  if (reason === "input") return actionFailure("bad_request", "input must be an object");
  if (reason === "ids") {
    return actionFailure("bad_request", "ids must be a non-empty array of strings");
  }
  return invalidJsonResponse(reason);
}

/** The whole selection in one transaction where the driver holds one, else row by row up to the first failure. */
export async function deleteSelection(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  ids: readonly string[],
  reqCtx: RequestContext,
): Promise<{ deleted: string[]; failure?: unknown }> {
  const transaction = config.adapter.transaction;
  if (transaction) {
    let started = false;
    try {
      await transaction.call(config.adapter, async (db) => {
        started = true;
        for (const id of ids) await deleteRow(config, resource, id, reqCtx, db);
      });
      return { deleted: [...ids] };
    } catch (err) {
      if (started || err instanceof FlowpanelError) throw err;
    }
  }
  const deleted: string[] = [];
  for (const id of ids) {
    try {
      await deleteRow(config, resource, id, reqCtx);
    } catch (failure) {
      return { deleted, failure };
    }
    deleted.push(id);
  }
  return { deleted };
}
