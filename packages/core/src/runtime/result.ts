import type { ErrorContext } from "../types/context";
import { FlowpanelError, FlowpanelValidationError } from "../types/error";
import {
  FLOWPANEL_ERROR_STATUS,
  type FlowpanelResult,
  type FlowpanelResultError,
} from "../types/result";

const reportedErrors = new WeakSet<object>();

export function errorResult(error: unknown, requestId: string): FlowpanelResult<never> {
  if (error instanceof FlowpanelError) {
    const resultError: FlowpanelResultError = {
      code: error.code,
      message: error.safeMessage,
      requestId,
      ...(error instanceof FlowpanelValidationError ? { fieldErrors: error.fieldErrors } : {}),
    };
    return { ok: false, error: resultError };
  }
  return {
    ok: false,
    error: { code: "internal", message: "Internal server error", requestId },
  };
}

function normalizeUnexpected(error: unknown): Error {
  return error instanceof Error ? error : new Error("Non-Error value was thrown", { cause: error });
}

/** Invoke the diagnostic hook at most once for the same unexpected Error object. */
export async function reportUnexpectedError(
  thrown: unknown,
  context: ErrorContext,
  onError?: (error: Error, context: ErrorContext) => void | Promise<void>,
): Promise<void> {
  if (thrown instanceof FlowpanelError) return;
  const error = normalizeUnexpected(thrown);
  if (reportedErrors.has(error)) return;
  reportedErrors.add(error);
  if (!onError) return;
  try {
    await onError(error, context);
  } catch (hookError) {
    console.error("[flowpanel] onError hook failed", hookError);
  }
}

export function resultResponse<T>(result: FlowpanelResult<T>): Response {
  const status = result.ok ? 200 : FLOWPANEL_ERROR_STATUS[result.error.code];
  return Response.json(result, { status });
}
