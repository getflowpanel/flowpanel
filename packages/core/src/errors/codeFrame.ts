/**
 * Minimal code-frame renderer for terminal output. Given a file path and
 * optional line/column, reads ±2 lines around the target and returns a
 * gutter-formatted snippet with a caret indicator.
 *
 * No color codes — the caller picks up formatting. Returns null when the
 * file can't be read (missing, binary, etc.) — the caller renders without
 * a frame in that case.
 */

import { readFileSync } from "node:fs";

export interface CodeFrameOptions {
  /** 1-indexed. */
  line?: number;
  /** 1-indexed. */
  column?: number;
  /** Lines of context on each side of `line`. Default 2. */
  context?: number;
}

export function renderCodeFrame(filePath: string, opts: CodeFrameOptions = {}): string | null {
  let source: string;
  try {
    source = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  const lines = source.split(/\r?\n/);
  if (lines.length === 0) return null;

  const target = opts.line ?? 1;
  const context = opts.context ?? 2;
  const start = Math.max(1, target - context);
  const end = Math.min(lines.length, target + context);

  const gutterWidth = String(end).length;
  const rendered: string[] = [];
  for (let i = start; i <= end; i++) {
    const isTarget = i === target;
    const marker = isTarget ? ">" : " ";
    const num = String(i).padStart(gutterWidth, " ");
    const text = lines[i - 1] ?? "";
    rendered.push(`${marker} ${num} │ ${text}`);
    if (isTarget && opts.column && opts.column > 0) {
      const pad = " ".repeat(marker.length + 1 + gutterWidth + 3 + (opts.column - 1));
      rendered.push(`${pad}^`);
    }
  }
  return rendered.join("\n");
}
