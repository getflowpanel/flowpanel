const INITIALISMS = new Set([
  "id",
  "url",
  "uri",
  "api",
  "ip",
  "uuid",
  "ui",
  "ux",
  "http",
  "https",
  "sql",
  "json",
  "csv",
  "xml",
  "html",
  "css",
  "dns",
  "tcp",
  "udp",
  "ssl",
  "tls",
  "jwt",
  "otp",
  "sms",
  "db",
  "sku",
  "ean",
  "gtin",
  "isbn",
  "iban",
  "vat",
  "mrr",
  "arr",
  "ltv",
  "kpi",
  "roi",
  "seo",
  "sso",
  "pdf",
  "cpu",
  "gpu",
  "ai",
  "utc",
  "iso",
  "eta",
  "faq",
  "smtp",
  "ssh",
]);

/** A trailing unit reads in parentheses: `durationMs` is "Duration (ms)", `priceUsd` "Price (USD)". */
const UNITS = new Map([
  ["ms", "ms"],
  ["sec", "s"],
  ["secs", "s"],
  ["kb", "KB"],
  ["mb", "MB"],
  ["gb", "GB"],
  ["tb", "TB"],
  ["px", "px"],
  ["pct", "%"],
  ["cents", "cents"],
  ["usd", "USD"],
  ["eur", "EUR"],
  ["gbp", "GBP"],
]);

/** The words a money column's name ends in when it stores minor units. */
const MINOR_UNITS = new Set(["cents", "minor", "pence", "kopecks"]);

function splitTokens(input: string): string[] {
  return input
    .replace(/[_\-\s]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function word(token: string, first: boolean): string {
  const lower = token.toLowerCase();
  if (lower === "ms") return lower;
  if (INITIALISMS.has(lower)) return lower.toUpperCase();
  const single = lower.endsWith("s") ? lower.slice(0, -1) : "";
  if (single.length > 1 && INITIALISMS.has(single)) return `${single.toUpperCase()}s`;
  return first ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
}

function joinTokens(tokens: readonly string[]): string {
  const unit = tokens.length > 1 ? UNITS.get(tokens[tokens.length - 1]?.toLowerCase() ?? "") : "";
  const words = (unit ? tokens.slice(0, -1) : tokens).map((tok, i) => word(tok, i === 0));
  return unit ? `${words.join(" ")} (${unit})` : words.join(" ");
}

/** `created_at` reads "Created at"; initialisms stay upper case ("SKU", "Order ID", "URLs") and a trailing unit reads "Duration (ms)". */
export function humanize(name: string): string {
  return joinTokens(splitTokens(name));
}

/** A foreign key's label without its key suffix: `customerId` and `customer_id` read "Customer". */
export function humanizeReference(name: string): string {
  const tokens = splitTokens(name);
  const last = tokens[tokens.length - 1]?.toLowerCase();
  if (tokens.length < 2 || (last !== "id" && last !== "uuid")) return humanize(name);
  return joinTokens(tokens.slice(0, -1));
}

/** A money field's label without its minor-unit suffix: `amount_cents` shown as money reads "Amount". */
export function humanizeAmount(name: string): string {
  const tokens = splitTokens(name);
  const last = tokens[tokens.length - 1]?.toLowerCase() ?? "";
  if (tokens.length < 2 || !MINOR_UNITS.has(last)) return humanize(name);
  return joinTokens(tokens.slice(0, -1));
}

/** Resolve the display label for a column / field descriptor. */
export function resolveFieldLabel(label: string | undefined, field: string): string {
  if (label !== undefined) return label;
  return humanize(field);
}
