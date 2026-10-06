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

/** The first line of an error and its cause: a driver puts query parameters, and so submitted values, on later lines. */
function summarize(error: Error): string {
  const firstLine = (value: Error) => `${value.name}: ${value.message.split("\n", 1)[0]}`;
  return error.cause instanceof Error
    ? `${firstLine(error)} (cause: ${firstLine(error.cause)})`
    : firstLine(error);
}

function normalizeUnexpected(error: unknown): Error {
  return error instanceof Error ? error : new Error("Non-Error value was thrown", { cause: error });
}

/** Invoke the diagnostic hook, or log with the request id when none is set, at most once per Error object. */
export async function reportUnexpectedError(
  thrown: unknown,
  context: ErrorContext,
  onError?: (error: Error, context: ErrorContext) => void | Promise<void>,
): Promise<void> {
  if (thrown instanceof FlowpanelError) return;
  const error = normalizeUnexpected(thrown);
  if (reportedErrors.has(error)) return;
  reportedErrors.add(error);
  if (!onError) {
    const where = context.operation ?? context.route ?? `${context.method} ${context.url}`;
    const prefix = `[flowpanel] ${where} failed, requestId ${context.requestId}:`;
    if (process.env.NODE_ENV === "production") console.error(prefix, summarize(error));
    else console.error(prefix, error);
    return;
  }
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
