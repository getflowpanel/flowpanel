import type { SmokeConsoleMessage } from "./page";

const UNREADABLE = Symbol("unreadable");

function shown(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** The console's own rendering of `console.error(format, ...args)`: `%c` styles dropped, `%s` and the rest filled in. */
export function formatConsoleArgs(values: readonly unknown[]): string {
  const [first, ...rest] = values;
  let used = 0;
  const head =
    typeof first === "string"
      ? first.replace(/%[csdifoO%]/g, (token) => {
          if (token === "%%") return "%";
          if (used >= rest.length) return token === "%c" ? "" : token;
          const value = rest[used++];
          return token === "%c" ? "" : shown(value);
        })
      : shown(first);
  return [head, ...rest.slice(used).map(shown)].join(" ").replace(/\s+/g, " ").trim();
}

/** A console message as a person reads it, without React's `%c` badge styling. */
export async function consoleText(message: SmokeConsoleMessage): Promise<string> {
  const handles = message.args?.() ?? [];
  const values = await Promise.all(
    handles.map((handle) => handle.jsonValue().catch(() => UNREADABLE)),
  );
  if (values.length > 0 && !values.includes(UNREADABLE)) return formatConsoleArgs(values);
  return message.text().replaceAll("%c", "").replace(/\s+/g, " ").trim();
}
