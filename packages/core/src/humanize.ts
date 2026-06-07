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
  "ms",
  "db",
]);

function splitTokens(input: string): string[] {
  return input
    .replace(/[_\-\s]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function humanize(name: string): string {
  if (!name) return "";
  const tokens = splitTokens(name);
  if (tokens.length === 0) return "";
  return tokens
    .map((tok, i) => {
      const lower = tok.toLowerCase();
      if (INITIALISMS.has(lower)) return lower.toUpperCase();
      if (i === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
}

/** Resolve the display label for a column / field descriptor. */
export function resolveFieldLabel(label: string | undefined, field: string): string {
  if (label !== undefined) return label;
  return humanize(field);
}
