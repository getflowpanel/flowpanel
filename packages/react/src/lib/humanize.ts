/**
 * Turn a raw field identifier (camelCase, snake_case, kebab-case, or PascalCase)
 * into a human-readable label using sentence case — the convention used across
 * FlowPanel's built-in chrome.
 *
 * Examples:
 *   email       -> "Email"
 *   firstName   -> "First name"
 *   created_at  -> "Created at"
 *   telegramId  -> "Telegram ID"
 *   apiKey      -> "API key"
 *   userIdUrl   -> "User ID URL"
 *
 * Common all-caps initialisms (ID, URL, API, IP, UUID, UI, URI, HTTP, SQL, JSON,
 * CSV, XML, HTML, CSS, DNS) are preserved uppercase regardless of position.
 */
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
  // Normalize separators first, then split camelCase / PascalCase boundaries.
  // The lookahead/lookbehind handles "URLPath" → "URL", "Path" by detecting
  // an upper-run followed by a Title-cased word.
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

/**
 * Resolve the display label for a column / field descriptor.
 *
 * - If the user supplied an explicit `label` (including an empty string used to
 *   intentionally hide the header text), respect it verbatim.
 * - Otherwise humanize the raw field name.
 */
export function resolveFieldLabel(label: string | undefined, field: string): string {
  if (label !== undefined) return label;
  return humanize(field);
}
