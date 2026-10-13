import type { ColumnMeta, FieldDef, ResolvedFormatting } from "@flowpanel/core";
import {
  type MoneyStorage,
  majorUnitsInput,
  moneyMinorUnits,
  moneyStorage,
} from "@flowpanel/core/format";

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
