import type { ActionResult, FieldDef } from "@flowpanel/core";
import { FlowpanelUnknownFieldError } from "@flowpanel/core";
import type { z } from "zod";

export interface ActionInputIssue {
  path: (string | number)[];
  message: string;
}

function isPromiseLike(value: unknown): value is PromiseLike<string | null> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** Validate a client-supplied action input against its declared form. */
export function validateActionInput(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
): ActionInputIssue[] | null | Promise<ActionInputIssue[] | null> {
  if (!form || form.length === 0) return null;

  const values =
    input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
  if (values === undefined) return [{ path: [], message: "input must be an object" }];

  const issues: ActionInputIssue[] = [];
  const pending: { name: string; result: PromiseLike<string | null> }[] = [];

  for (const field of form) {
    const value = values[field.name];
    if (field.required && (value === undefined || value === null || value === "")) {
      issues.push({ path: [field.name], message: `${field.name} is required` });
      continue;
    }
    if (field.validate === undefined || value === undefined) continue;

    if (typeof field.validate === "function") {
      const result = field.validate(value, values);
      if (isPromiseLike(result)) pending.push({ name: field.name, result });
      else if (result) issues.push({ path: [field.name], message: result });
    } else if (typeof (field.validate as { safeParse?: unknown }).safeParse === "function") {
      const result = (field.validate as z.ZodTypeAny).safeParse(value);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.map((part) =>
            typeof part === "symbol" ? part.toString() : part,
          );
          issues.push({ path: [field.name, ...path], message: issue.message });
        }
      }
    }
  }

  if (pending.length === 0) return issues.length > 0 ? issues : null;
  return (async () => {
    for (const { name, result } of pending) {
      const message = await result;
      if (message) issues.push({ path: [name], message });
    }
    return issues.length > 0 ? issues : null;
  })();
}

/** Action inputs are an allowlist too; unknown keys never reach trusted callbacks. */
export function assertActionInputFields(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  input: Record<string, unknown>,
  inputSchema?: z.ZodTypeAny,
): void {
  const shape = (inputSchema as { shape?: Record<string, unknown> } | undefined)?.shape;
  const allowed = new Set([
    ...(form ?? []).map((field) => field.name),
    ...Object.keys(shape ?? {}),
  ]);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) throw new FlowpanelUnknownFieldError(field);
  }
}

export interface ParsedActionInput {
  data: Record<string, unknown>;
  issues: ActionInputIssue[] | null;
}

/** Validate field rules and the optional cross-field action schema once. */
export async function parseActionInputSchema(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  inputSchema: z.ZodTypeAny | undefined,
  input: Record<string, unknown>,
): Promise<ParsedActionInput> {
  assertActionInputFields(form, input, inputSchema);
  const fieldIssues = await validateActionInput(form, input);
  if (fieldIssues) return { data: input, issues: fieldIssues };
  if (!inputSchema) return { data: input, issues: null };
  const parsed = inputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data as Record<string, unknown>, issues: null };
  return {
    data: input,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === "symbol" ? part.toString() : part)),
      message: issue.message,
    })),
  };
}

/** Ensure arbitrary success data is declared and safe before it crosses the wire. */
export function validateActionOutput(
  outputSchema: z.ZodTypeAny | undefined,
  result: ActionResult<unknown>,
): ActionResult<unknown> {
  if (!result.ok || result.data === undefined) return result;
  if (!outputSchema) throw new Error("An action returned data without declaring outputSchema.");
  const parsed = outputSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("An action returned data that failed outputSchema.");
  return { ...result, data: parsed.data };
}
