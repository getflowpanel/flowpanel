const NUMERIC = /^[+-]?\d+(?:\.\d+)?$/;

/** A number in minor units, a `bigint` as Prisma returns a `sum`, or numeric text as node-postgres does, as its amount. */
function amountOf(value: unknown, minorUnits: number): number | null {
  if (typeof value === "number") return value / 10 ** minorUnits;
  if (typeof value === "bigint") return Number(value) / 10 ** minorUnits;
  if (typeof value === "string" && NUMERIC.test(value.trim())) {
    return Number(value) / 10 ** minorUnits;
  }
  return null;
}

/** A result whose `value` is in minor units, as the amount a card shows: `260000` with `minorUnits: 2` is `2600`. */
export function inAmount<R extends { value: unknown }>(result: R, minorUnits?: number): R {
  const amount = minorUnits ? amountOf(result.value, minorUnits) : null;
  return amount === null ? result : Object.assign({}, result, { value: amount });
}
