import type { PrismaDmmf } from "./introspect";

interface DecimalLike {
  toFixed(digits?: number): string;
  toString(): string;
}

function isDecimal(value: unknown): value is DecimalLike {
  if (typeof value !== "object" || value === null) return false;
  if (typeof (value as { toFixed?: unknown }).toFixed !== "function") return false;
  return Object.prototype.toString.call(value) === "[object Decimal]";
}

const MAX_SCALE = 20;

/** Each `Decimal` field's scale from `@db.Decimal(p, s)`, or `null` when the schema names none. */
function decimalScales(dmmf: PrismaDmmf, modelName: string): Map<string, number | null> {
  const model = dmmf.datamodel.models.find((entry) => entry.name === modelName);
  const scales = new Map<string, number | null>();
  for (const field of model?.fields ?? []) {
    if (field.type !== "Decimal") continue;
    const scale = Number(field.nativeType?.[1]?.[1]);
    scales.set(field.name, Number.isInteger(scale) && scale <= MAX_SCALE ? scale : null);
  }
  return scales;
}

/** Prisma `Decimal` values as strings at the column's scale, so `49.90` stays `"49.90"`. */
export function plainDecimals<Row>(rows: Row[], dmmf: PrismaDmmf, modelName: string): Row[] {
  const scales = decimalScales(dmmf, modelName);
  if (scales.size === 0) return rows;
  return rows.map((row) => {
    if (typeof row !== "object" || row === null) return row;
    let out: Record<string, unknown> | undefined;
    for (const [name, scale] of scales) {
      const value = (row as Record<string, unknown>)[name];
      if (!isDecimal(value)) continue;
      out ??= { ...(row as Record<string, unknown>) };
      out[name] = scale === null ? value.toString() : value.toFixed(scale);
    }
    return (out ?? row) as Row;
  });
}
