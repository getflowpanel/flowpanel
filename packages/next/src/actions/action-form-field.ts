import type { ActionInputIssue } from "../runtime/action-helpers.js";

/** Wire-safe descriptor for a single form field on a row/bulk/dashboard/drawer action. */
export interface ActionFormField {
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

/** Field-level error map keyed by `ActionFormField.name`. */
export type ActionFormFieldErrors = Record<string, string>;

export function mapActionIssuesToFieldErrors(
  issues: ActionInputIssue[] | undefined | null,
): ActionFormFieldErrors | null {
  if (!issues || issues.length === 0) return null;
  const out: ActionFormFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "";
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}
