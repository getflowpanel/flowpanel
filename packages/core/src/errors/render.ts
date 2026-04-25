/**
 * Renders a FlowPanelConfigError into a multi-line, human-friendly message.
 *
 *   ❌ FlowPanel config error: <message>
 *
 *     at src/flowpanel.ts:42:15
 *
 *     40 │ ...
 *   > 41 │ ... problematic line ...
 *        │              ^
 *     42 │ ...
 *
 *     Hint: <hint>
 *     Did you mean: "plan" (instead of "plna")?
 *     Docs: https://...
 *
 * No color — tools that want ANSI wrap the output themselves.
 */

import { renderCodeFrame } from "./codeFrame";

export interface ConfigErrorContext {
  /** Location — file path, optionally with 1-indexed line/column. */
  source?: { file: string; line?: number; column?: number };
  /** Single-line actionable hint. */
  hint?: string;
  /** Similar config keys suggested via string distance. */
  didYouMean?: string[];
  /** Documentation URL appended to the rendered error. */
  docs?: string;
  /** The value that failed — rendered in a small "Received:" block. */
  received?: unknown;
}

export function renderConfigError(message: string, ctx: ConfigErrorContext): string {
  const parts: string[] = [];
  parts.push(`FlowPanel config error: ${message}`);

  if (ctx.source) {
    const { file, line, column } = ctx.source;
    const loc = [line, column].filter((n) => n != null).join(":");
    parts.push("");
    parts.push(`  at ${file}${loc ? `:${loc}` : ""}`);

    if (line) {
      const frame = renderCodeFrame(file, { line, ...(column ? { column } : {}) });
      if (frame) {
        parts.push("");
        parts.push(indent(frame, "  "));
      }
    }
  }

  if (ctx.received !== undefined) {
    parts.push("");
    parts.push(`  Received: ${stringifyReceived(ctx.received)}`);
  }

  if (ctx.hint) {
    parts.push("");
    parts.push(`  Hint: ${ctx.hint}`);
  }

  if (ctx.didYouMean && ctx.didYouMean.length > 0) {
    const list = ctx.didYouMean.map((s) => `"${s}"`).join(", ");
    parts.push(`  Did you mean: ${list}?`);
  }

  if (ctx.docs) {
    parts.push(`  Docs: ${ctx.docs}`);
  }

  return parts.join("\n");
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function stringifyReceived(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null)
    return String(value);
  if (value === undefined) return "undefined";
  try {
    const s = JSON.stringify(value);
    return s.length > 120 ? `${s.slice(0, 117)}...` : s;
  } catch {
    return String(value);
  }
}
