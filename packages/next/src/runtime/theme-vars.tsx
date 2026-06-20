import type { ThemeConfig } from "@flowpanel/core";

const HSL_WRAPPER = /^hsla?\(([^)]*)\)$/i;

/**
 * Design tokens are consumed as `hsl(var(--fp-accent))`, so the variable holds a
 * bare triplet. `hsl(220 90% 50%)` is the shape people reach for first, so unwrap
 * it rather than emitting `hsl(hsl(...))`.
 */
export function normalizeAccent(accent: string): string {
  const match = HSL_WRAPPER.exec(accent.trim());
  const inner = match?.[1] ?? accent;
  return inner
    .trim()
    .replace(/\s*,\s*/g, " ")
    .replace(/\s*\/.*$/, "");
}

const UNSAFE = /[<>{};]/g;

function declarations(theme: ThemeConfig): string[] {
  const out: string[] = [];
  if (theme.accent) out.push(`--fp-accent:${normalizeAccent(theme.accent).replace(UNSAFE, "")}`);
  for (const [rawName, rawValue] of Object.entries(theme.cssVars ?? {})) {
    const name = rawName.startsWith("--") ? rawName : `--${rawName}`;
    if (!/^--[\w-]+$/.test(name)) continue;
    out.push(`${name}:${String(rawValue).replace(UNSAFE, "").trim()}`);
  }
  return out;
}

/**
 * Emits `theme.accent` and `theme.cssVars` as `:root` overrides. Root scope, not a
 * wrapper element, because dialogs and drawers portal to `document.body` and would
 * otherwise fall back to the defaults.
 */
export function ThemeVars({ theme }: { theme: ThemeConfig | undefined }) {
  if (!theme) return null;
  const decls = declarations(theme);
  if (decls.length === 0) return null;
  return <style>{`:root{${decls.join(";")}}`}</style>;
}
