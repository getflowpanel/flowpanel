import type { FlowpanelErrorCode } from "@flowpanel/core";
import { FLOWPANEL_ERROR_STATUS } from "@flowpanel/core";
import { mapActionIssuesToFieldErrors } from "../actions/action-form-field";
import type { ActionInputIssue } from "./action-schema";

/** How every action and form route answers a failure: the same body `withGuards` sends. */
export interface ActionFailureBody {
  ok: false;
  error: string;
  code: FlowpanelErrorCode;
  requestId?: string;
  fieldErrors?: Record<string, string>;
}

/** A failure in the action/form route shape; the status follows `code` unless given. */
export function actionFailure(
  code: FlowpanelErrorCode,
  error: string,
  extra: { status?: number; requestId?: string; fieldErrors?: Record<string, string> } = {},
): Response {
  const { status = FLOWPANEL_ERROR_STATUS[code], requestId, fieldErrors } = extra;
  const body: ActionFailureBody = {
    ok: false,
    error,
    code,
    ...(requestId ? { requestId } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  };
  return Response.json(body, {
    status,
    ...(requestId ? { headers: { "x-request-id": requestId } } : {}),
  });
}

/** 422 for action input that fails its form: one message per field, or the message itself for the whole input. */
export function validationFailure(issues: ActionInputIssue[], requestId?: string): Response {
  const fieldErrors = mapActionIssuesToFieldErrors(issues.filter((i) => i.path.length > 0));
  const whole = issues.find((i) => i.path.length === 0)?.message;
  return actionFailure("validation_failed", whole ?? "validation failed", {
    ...(requestId ? { requestId } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

/** A failure a guarded handler built itself, stamped with the request id the guards assigned. */
export async function withRequestId(res: Response, requestId: string): Promise<Response> {
  if (res.ok || res.headers.has("x-request-id")) return res;
  if (!res.headers.get("content-type")?.includes("application/json")) return res;
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null);
  if (typeof body !== "object" || body === null || !("ok" in body) || body.ok !== false) return res;
  const headers = new Headers(res.headers);
  headers.set("x-request-id", requestId);
  return Response.json({ ...body, requestId }, { status: res.status, headers });
}
