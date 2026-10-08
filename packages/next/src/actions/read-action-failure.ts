import { type ActionFormFieldErrors, mapActionIssuesToFieldErrors } from "./action-form-field";

function asFieldErrors(value: unknown): ActionFormFieldErrors | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: ActionFormFieldErrors = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === "string") out[key] = message;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function asIssues(value: unknown): { path: (string | number)[]; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue: unknown) =>
    typeof issue === "object" &&
    issue !== null &&
    "message" in issue &&
    typeof issue.message === "string" &&
    "path" in issue &&
    Array.isArray(issue.path)
      ? [
          {
            path: issue.path.map((p: unknown) => (typeof p === "number" ? p : String(p))),
            message: issue.message,
          },
        ]
      : [],
  );
}

/**
 * The message and field errors of a failed action body. Routes answer `{ error: string, fieldErrors }`;
 * an `{ error: { message } }` envelope or an `issues` list from an older server reads the same.
 */
export function readActionFailure(body: unknown): {
  message?: string;
  fieldErrors?: ActionFormFieldErrors;
} {
  if (typeof body !== "object" || body === null) return {};
  const error = "error" in body ? body.error : undefined;
  const nested = typeof error === "object" && error !== null ? error : undefined;
  const nestedMessage =
    nested && "message" in nested && typeof nested.message === "string"
      ? nested.message
      : undefined;
  const issues = asIssues("issues" in body ? body.issues : undefined);
  const message =
    typeof error === "string"
      ? error
      : (nestedMessage ?? issues.find((issue) => issue.path.length === 0)?.message);
  const fields =
    asFieldErrors("fieldErrors" in body ? body.fieldErrors : undefined) ??
    asFieldErrors(nested && "fieldErrors" in nested ? nested.fieldErrors : undefined) ??
    mapActionIssuesToFieldErrors(issues.filter((issue) => issue.path.length > 0));
  return { ...(message ? { message } : {}), ...(fields ? { fieldErrors: fields } : {}) };
}
