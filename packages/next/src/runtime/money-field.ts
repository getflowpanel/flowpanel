import type {
  ColumnMeta,
  FieldDef,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import { formatLabel, resolveFormatting } from "@flowpanel/core";
import {
  type MoneyStorage,
  majorUnitsInput,
  moneyColumnFactor,
  moneyDecimals,
  moneyMinorUnits,
  moneyStorage,
  parseMajorUnits,
} from "@flowpanel/core/format";
import { writeTarget } from "@flowpanel/core/internal";
import { columnDefs } from "./column-defs";
import { formFieldsOf } from "./form-fields-of";

type MoneyOptions = Pick<FieldDef<Record<string, unknown>>, "currency" | "minorUnits" | "storage">;

/** How one `money` field reads and writes: its currency, digits and the column's storage. */
export interface MoneyShape {
  currency: string;
  minorUnits: number;
  storage: MoneyStorage;
}

export function moneyShape(
  field: MoneyOptions,
  column: Pick<ColumnMeta, "type" | "integer"> | undefined,
  formatting: Pick<ResolvedFormatting, "currency">,
): MoneyShape {
  const currency = field.currency ?? formatting.currency;
  return {
    currency,
    minorUnits: moneyMinorUnits(field.minorUnits, currency),
    storage: moneyStorage(field.storage, column),
  };
}

/** The locale's decimal separator: `.` in en-US, `,` in ru. */
export function decimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")
      ?.value ?? "."
  );
}

/** A stored amount as the money control shows it in `locale`. */
export function moneyInputValue(value: unknown, shape: MoneyShape, locale: string): string {
  return majorUnitsInput(value, { ...shape, decimalSeparator: decimalSeparator(locale) });
}

/** A sample amount at the field's precision, for the message that rejects a typed one. */
export function moneyExample(shape: MoneyShape, locale: string): string {
  return moneyInputValue("12.5", { ...shape, storage: "major" }, locale);
}

/** Drops a posted amount that reads the same as the stored one, so an untouched money field keeps its stored value. */
export function keepUntouchedMoney(
  input: unknown,
  current: Record<string, unknown>,
  shapes: ReadonlyMap<string, MoneyShape>,
): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const out: Record<string, unknown> = { ...input };
  for (const [name, shape] of shapes) {
    if (!(name in out) || current[name] === undefined || current[name] === null) continue;
    if (majorUnitsInput(out[name], shape) === majorUnitsInput(current[name], shape))
      delete out[name];
  }
  return out;
}

/** The `money` fields among `fields`, with how each reads and writes. */
export function moneyShapes(
  fields: ReadonlyArray<FieldDef<Record<string, unknown>>> | undefined,
  columns: ReadonlyArray<ColumnMeta>,
  formatting: Pick<ResolvedFormatting, "currency">,
): Map<string, MoneyShape> {
  const shapes = new Map<string, MoneyShape>();
  for (const field of fields ?? []) {
    if (field.type !== "money") continue;
    shapes.set(
      field.name,
      moneyShape(
        field,
        columns.find((c) => c.name === field.name),
        formatting,
      ),
    );
  }
  return shapes;
}

/** How many stored units make one shown unit, per money column from its format: `100` for cents. */
export function columnMoneyFactors(resource: ResourceConfig): Map<string, number> {
  const factors = new Map<string, number>();
  for (const column of columnDefs(resource)) {
    if (!column.field || typeof column.format !== "object" || column.format.kind !== "money") {
      continue;
    }
    const factor = moneyColumnFactor(column.format);
    if (factor !== 1) factors.set(column.field, factor);
  }
  return factors;
}

/** Digits a money field or column stores past the amount it shows, by field: `2` for cents. */
export function moneyDigits(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
): Map<string, number> {
  const factors = new Map<string, number>();
  const { columns } = config.adapter.introspect(writeTarget(resource));
  const shapes = moneyShapes(formFieldsOf(resource), columns, resolveFormatting(config.formatting));
  for (const [name, shape] of shapes) {
    if (shape.storage === "minor") factors.set(name, 10 ** shape.minorUnits);
  }
  for (const [field, factor] of columnMoneyFactors(resource)) factors.set(field, factor);
  const digits = new Map<string, number>();
  for (const [field, factor] of factors) {
    const places = Math.log10(factor);
    if (Number.isInteger(places) && places > 0) digits.set(field, places);
  }
  return digits;
}

/** A stored amount as plain major-unit text, `59.00`, with no currency sign. */
export function majorAmount(value: unknown, digits: number): unknown {
  if (value === null || value === undefined) return value;
  return majorUnitsInput(value, { minorUnits: digits, storage: "minor" });
}

/** A file row's major-unit amounts as stored units, with the form's message for a cell that is not one. */
export function decodeMoneyCells(
  row: Record<string, unknown>,
  digits: ReadonlyMap<string, number>,
  labelOf: (name: string) => string,
  labels: ResolvedLabels,
): { values: Record<string, unknown>; fieldErrors: Record<string, string> } {
  const values = { ...row };
  const fieldErrors: Record<string, string> = {};
  for (const [name, places] of digits) {
    const raw = values[name];
    if (typeof raw !== "string" && typeof raw !== "number") continue;
    const text = String(raw).trim();
    if (text === "") continue;
    const minor = parseMajorUnits(text, places);
    if (minor !== null) {
      values[name] = minor;
      continue;
    }
    const decimals = moneyDecimals(text);
    const message =
      decimals !== null && decimals > places
        ? labels.form.moneyTooPrecise
        : labels.form.invalidMoney;
    const example = majorUnitsInput("12.5", { minorUnits: places, storage: "major" });
    fieldErrors[name] = formatLabel(message, { label: labelOf(name), example });
    delete values[name];
  }
  return { values, fieldErrors };
}
