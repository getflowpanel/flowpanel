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

function declarations(values: Record<string, string> | undefined): string[] {
  const out: string[] = [];
  for (const [rawName, rawValue] of Object.entries(values ?? {})) {
    const name = rawName.startsWith("--") ? rawName : `--${rawName}`;
    if (!/^--[\w-]+$/.test(name)) continue;
    out.push(`${name}:${String(rawValue).replace(UNSAFE, "").trim()}`);
  }
  return out;
}

/**
 * Emits theme overrides only inside Flowpanel roots and namespaced portals.
 * Host application tokens and its own dark-mode convention remain untouched.
 */
export function ThemeVars({ theme }: { theme: ThemeConfig | undefined }) {
  if (!theme) return null;
  const decls = declarations(theme.cssVars);
  if (theme.accent)
    decls.unshift(`--fp-accent:${normalizeAccent(theme.accent).replace(UNSAFE, "")}`);
  const targets = "[data-flowpanel-root],[data-flowpanel-portal]";
  const darkTargets =
    'html[data-flowpanel-theme="dark"] [data-flowpanel-root],html[data-flowpanel-theme="dark"] [data-flowpanel-portal],[data-flowpanel-root][data-theme="dark"],[data-flowpanel-portal][data-theme="dark"]';
  const darkDecls = declarations(theme.cssVarsDark);
  if (theme.accentDark) {
    darkDecls.unshift(`--fp-accent:${normalizeAccent(theme.accentDark).replace(UNSAFE, "")}`);
  }
  const dark = darkDecls.length > 0 ? `${darkTargets}{${darkDecls.join(";")}}` : "";
  if (decls.length === 0 && !dark) return null;
  const root = decls.length > 0 ? `${targets}{${decls.join(";")}}` : "";
  return <style>{`${root}${dark}`}</style>;
}
