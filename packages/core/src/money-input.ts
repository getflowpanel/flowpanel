/** How a `money` column holds its amount: whole minor units (`39999`) or a major-unit decimal (`399.99`). */
export type MoneyStorage = "minor" | "major";

/** The most digits after the decimal point a `money` field may keep; more would not fit a safe integer. */
export const MAX_MINOR_UNITS = 8;

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;
const MINUS = /[−‒–—﹣－]/g;

/** The digits after the decimal point a currency keeps: 2 for USD, 0 for JPY, 3 for KWD. */
export function currencyDigits(currency: string | undefined): number {
  if (!currency) return 2;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
    return digits ?? 2;
  } catch {
    return 2;
  }
}

/** A field's own `minorUnits`, else its currency's, else 2. */
export function moneyMinorUnits(minorUnits: number | undefined, currency?: string): number {
  return minorUnits ?? currencyDigits(currency);
}

/** Where a `money` field keeps its amount: the declared `storage`, else minor units unless the column is a decimal. */
export function moneyStorage(
  storage: MoneyStorage | undefined,
  column: { type: string; integer?: boolean } | undefined,
): MoneyStorage {
  if (storage) return storage;
  return column?.type === "number" && column.integer === false ? "major" : "minor";
}

interface Decimal {
  negative: boolean;
  whole: string;
  fraction: string;
}

function decimalOf(value: unknown): Decimal | null {
  let text: string;
  if (typeof value === "bigint") text = value.toString();
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    text = Number(value.toPrecision(15)).toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: 20,
    });
  } else if (typeof value === "string") text = value.trim().replace(MINUS, "-");
  else return null;
  const match = DECIMAL.exec(text);
  if (!match) return null;
  const [, sign = "", whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  return { negative: sign === "-", whole: whole || "0", fraction };
}

/** The amount moved `places` digits left: minor units to major. */
function shiftLeft({ negative, whole, fraction }: Decimal, places: number): Decimal {
  const padded = whole.padStart(places + 1, "0");
  return {
    negative,
    whole: padded.slice(0, padded.length - places),
    fraction: padded.slice(padded.length - places) + fraction,
  };
}

/** Written with at least `digits` decimals and every further one it has, never rounded. */
function written({ negative, whole, fraction }: Decimal, digits: number): string {
  const kept = fraction.replace(/0+$/, "").padEnd(digits, "0");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const text = kept === "" ? integer : `${integer}.${kept}`;
  return negative && /[1-9]/.test(text) ? `-${text}` : text;
}

/** A stored amount as the text a form edits, with the currency's decimals and any further ones unrounded. */
export function majorUnitsInput(
  value: unknown,
  options: { minorUnits: number; storage?: MoneyStorage; decimalSeparator?: string },
): string {
  if (value === null || value === undefined || value === "") return "";
  const decimal = decimalOf(value);
  if (!decimal) return String(value);
  const major = options.storage === "major" ? decimal : shiftLeft(decimal, options.minorUnits);
  return written(major, options.minorUnits).replace(".", options.decimalSeparator ?? ".");
}

function typed(raw: string): Decimal | null {
  const decimal = decimalOf(raw.replace(/[\s  ]/g, "").replace(",", "."));
  return decimal && { ...decimal, fraction: decimal.fraction.replace(/0+$/, "") };
}

/** How many decimals typed text carries past its trailing zeros, or `null` when it is not an amount. */
export function moneyDecimals(raw: string): number | null {
  const decimal = typed(raw);
  return decimal ? decimal.fraction.length : null;
}

/** Typed text as whole minor units, or `null` when it is not an amount or has more decimals than allowed. */
export function parseMajorUnits(raw: string, minorUnits: number): number | null {
  const decimal = typed(raw);
  if (!decimal || decimal.fraction.length > minorUnits) return null;
  const minor = BigInt(`${decimal.whole}${decimal.fraction.padEnd(minorUnits, "0")}`);
  const value = Number(decimal.negative ? -minor : minor);
  return Number.isSafeInteger(value) ? value : null;
}

/** Typed text as the value a column of `storage` takes: minor units, or major units as exact decimal text. */
export function parseMoney(
  raw: string,
  options: { minorUnits: number; storage?: MoneyStorage },
): number | string | null {
  const minor = parseMajorUnits(raw, options.minorUnits);
  if (minor === null || options.storage !== "major") return minor;
  const units: Decimal = { negative: minor < 0, whole: String(Math.abs(minor)), fraction: "" };
  return written(shiftLeft(units, options.minorUnits), options.minorUnits);
}
