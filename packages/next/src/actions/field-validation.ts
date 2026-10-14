import type {
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelValidationError, formatLabel } from "@flowpanel/core";
import type { z } from "zod";
import { fieldLabels } from "../runtime/field-labels";
import { choiceErrors } from "./field-choices";
import { formOffersField } from "./field-pipeline";

type Field = FieldDef<Record<string, unknown>>;

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

/**
 * `required` fields the form showed as editable that this write leaves empty.
 * On update (`current` set) only submitted keys count, so an untouched field keeps its stored value.
 */
export function missingRequiredErrors(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  labels: ResolvedLabels,
  denied: ReadonlySet<string>,
  labelOf: (name: string) => string = fieldLabels(undefined, fields),
): Record<string, string> {
  const shown = current ?? {};
  const out: Record<string, string> = {};
  for (const field of fields ?? []) {
    if (field.required !== true) continue;
    if (current !== null && !Object.hasOwn(values, field.name)) continue;
    if (!isEmptyValue(values[field.name])) continue;
    if (!formOffersField(field, shown, denied)) continue;
    out[field.name] = formatLabel(labels.form.required, { label: labelOf(field.name) });
  }
  return out;
}

/** Per-field validators, then the choices and references the form offered this caller. */
export async function fieldRuleErrors(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  reqCtx: RequestContext,
  labels: ResolvedLabels,
): Promise<Record<string, string> | null> {
  const errors = {
    ...(await runFieldValidators(fields, values)),
    ...(await choiceErrors(config, resource, fields, values, current, reqCtx, labels)),
  };
  return Object.keys(errors).length > 0 ? errors : null;
}

export async function runFieldValidators(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  values: Record<string, unknown>,
): Promise<Record<string, string> | null> {
  if (!fields) return null;
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.validate === undefined) continue;
    const value = values[f.name];
    if (value === undefined) continue;
    if (typeof f.validate === "function") {
      const msg = await f.validate(value, values);
      if (msg) out[f.name] = msg;
    } else {
      const result = f.validate.safeParse(value);
      const first = result.success ? undefined : result.error.issues[0];
      if (first) out[f.name] = first.message;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** A missing value, as the schema reports one — never an author's own message. */
function isMissingValueIssue(issue: z.core.$ZodIssue): boolean {
  if (issue.code === "invalid_type" || issue.code === "invalid_value") return true;
  // Zod's own ">=1 characters" wording; an authored `.min(1, "…")` passes through.
  return issue.code === "too_small" && issue.minimum === 1 && issue.message.startsWith("Too small");
}

// Zod's own wording only; an authored `z.number({ message })` passes through.
function isNotANumberIssue(issue: z.core.$ZodIssue): boolean {
  return (
    issue.code === "invalid_type" &&
    issue.expected === "number" &&
    issue.message.startsWith("Invalid input")
  );
}

// A value outside an enum, in any Zod locale; an authored enum message gives way to the label too.
function isNotAnOptionIssue(issue: z.core.$ZodIssue): boolean {
  return issue.code === "invalid_value" && Array.isArray(issue.values);
}

/** A schema rejection as per-field messages: missing, not a number and not an option in the admin's words. */
export function friendlyFieldErrors(
  fields: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
  err: z.ZodError,
  labels: ResolvedLabels,
  labelOf: (name: string) => string = fieldLabels(undefined, fields),
): Record<string, string> {
  const values = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".");
    if (!key || key in out) continue;
    const value = values[key];
    const isEmpty = value === undefined || value === null || value === "";
    const label = labelOf(key);
    out[key] =
      isEmpty && isMissingValueIssue(issue)
        ? formatLabel(labels.form.required, { label })
        : isNotANumberIssue(issue)
          ? formatLabel(labels.form.invalidNumber, { label })
          : isNotAnOptionIssue(issue)
            ? formatLabel(labels.form.invalidOption, { label })
            : issue.message;
  }
  return out;
}

/** Schema, `required`, validators, choices and references: every field error at once, or the values to write. */
export async function checkedValues(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  labels: ResolvedLabels,
  schema: z.ZodTypeAny | undefined,
  fields: Field[] | undefined,
  values: Record<string, unknown>,
  current: Record<string, unknown> | null,
  reqCtx: RequestContext,
  denied: ReadonlySet<string>,
  decoded: Readonly<Record<string, string>> = {},
): Promise<Record<string, unknown>> {
  const labelOf = fieldLabels(resource, fields);
  const missing = {
    ...missingRequiredErrors(fields, values, current, labels, denied, labelOf),
    ...decoded,
  };
  // An adapter without a usable schema leaves the values to the field rules and the database.
  const parsed =
    typeof schema?.safeParse === "function"
      ? schema.safeParse(values)
      : { success: true as const, data: values };
  if (!parsed.success) {
    const fieldErrors = friendlyFieldErrors(fields, values, parsed.error, labels, labelOf);
    throw new FlowpanelValidationError({ ...fieldErrors, ...missing });
  }
  if (Object.keys(missing).length > 0) throw new FlowpanelValidationError(missing);
  const data = parsed.data as Record<string, unknown>;
  const ruleErrors = await fieldRuleErrors(config, resource, fields, data, current, reqCtx, labels);
  if (ruleErrors) throw new FlowpanelValidationError(ruleErrors);
  return data;
}
