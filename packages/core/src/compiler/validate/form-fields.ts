import { MAX_MINOR_UNITS } from "../../money-input";
import { didYouMean } from "../../suggest";
import { FlowpanelConfigError } from "../../types/config-error";
import type { FieldDef, ResourceConfig } from "../../types/resource";

type Field = Pick<
  FieldDef<Record<string, unknown>>,
  "name" | "type" | "minorUnits" | "currency" | "options" | "defaultValue"
>;

function formsOf(resource: ResourceConfig): Array<{ path: string; fields: readonly Field[] }> {
  const { create, update, actions, bulkActions, drawer } = resource.options;
  const actionForms = (
    list: ReadonlyArray<{ key: string; form?: unknown }> | undefined,
    at: string,
  ) =>
    (list ?? []).flatMap((action) =>
      Array.isArray(action.form)
        ? [{ path: `${at}["${action.key}"].form`, fields: action.form }]
        : [],
    );
  return [
    { path: "create.fields", fields: create?.fields ?? [] },
    { path: "update.fields", fields: update?.fields ?? [] },
    ...actionForms(actions, "actions"),
    ...actionForms(bulkActions, "bulkActions"),
    ...actionForms(drawer?.actions, "drawer.actions"),
  ];
}

function assertMoneyOptions(where: string, digits: number | undefined, currency?: string): void {
  if (
    digits !== undefined &&
    !(Number.isInteger(digits) && digits >= 0 && digits <= MAX_MINOR_UNITS)
  ) {
    throw new FlowpanelConfigError(
      where,
      `minorUnits is ${digits}. Use a whole number from 0 to ${MAX_MINOR_UNITS}.`,
    );
  }
  if (currency === undefined) return;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency });
  } catch {
    throw new FlowpanelConfigError(
      where,
      `currency "${currency}" is not an ISO 4217 code such as "USD".`,
    );
  }
}

/** A `money` field or column with digits a safe integer cannot hold, or a currency code `Intl` refuses, stops startup. */
function assertMoneyFields(resource: ResourceConfig, name: string): void {
  for (const { path, fields } of formsOf(resource)) {
    for (const field of fields) {
      if (field.type !== "money") continue;
      assertMoneyOptions(
        `resource "${name}" ${path} "${field.name}"`,
        field.minorUnits,
        field.currency,
      );
    }
  }
  for (const column of resource.options.columns ?? []) {
    if (typeof column !== "object" || typeof column.format !== "object") continue;
    const { format } = column;
    if (format.kind !== "money") continue;
    const where = `resource "${name}" columns "${String(column.field)}" format`;
    if (format.minorUnits !== undefined && format.scale !== undefined) {
      throw new FlowpanelConfigError(where, "sets both minorUnits and scale. Keep minorUnits.");
    }
    assertMoneyOptions(where, format.minorUnits, format.currency);
  }
}

const CHOICE_TYPES: ReadonlySet<string> = new Set(["select", "radio", "multiselect"]);

function quoted(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

/** A choice field whose fixed `defaultValue` is not among its fixed `options` stops startup; the form used to drop it. */
function assertChoiceDefaults(resource: ResourceConfig, name: string): void {
  const resourceDefaults: Record<string, unknown> = resource.options.create?.defaultValues ?? {};
  for (const { path, fields } of formsOf(resource)) {
    for (const field of fields) {
      if (!CHOICE_TYPES.has(field.type ?? "") || !Array.isArray(field.options)) continue;
      const choices = field.options.map((option: unknown) =>
        typeof option === "object" && option !== null && "value" in option
          ? String(option.value)
          : String(option),
      );
      const fromResource = path === "create.fields" && Object.hasOwn(resourceDefaults, field.name);
      const value = fromResource ? resourceDefaults[field.name] : field.defaultValue;
      if (value === undefined || value === null || value === "" || typeof value === "function")
        continue;
      if (Array.isArray(value) && value.length === 0) continue;
      const given = Array.isArray(value) ? value.map(String) : [String(value)];
      const missing = given.find((choice) => !choices.includes(choice));
      if (missing === undefined) continue;
      throw new FlowpanelConfigError(
        fromResource
          ? `resource "${name}" create.defaultValues.${field.name}`
          : `resource "${name}" ${path} "${field.name}" defaultValue`,
        `"${missing}" is not one of the field's options, so the form would start empty.` +
          `${didYouMean(missing, choices)} Options: ${quoted(choices)}.`,
      );
    }
  }
}

/** Money options and choice defaults of every form a resource declares. */
export function assertFormFields(resource: ResourceConfig, name: string): void {
  assertMoneyFields(resource, name);
  assertChoiceDefaults(resource, name);
}
