import { MAX_MINOR_UNITS } from "../../money-input";
import { FlowpanelConfigError } from "../../types/config-error";
import type { FieldDef, ResourceConfig } from "../../types/resource";

type Field = Pick<FieldDef<Record<string, unknown>>, "name" | "type" | "minorUnits" | "currency">;

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
export function assertMoneyFields(resource: ResourceConfig, name: string): void {
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
