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

function declares(values: Record<string, string> | undefined, name: string): boolean {
  return values !== undefined && (`--${name}` in values || name in values);
}

function accentDecl(accent: string): string {
  return `--fp-accent:${normalizeAccent(accent).replace(UNSAFE, "")}`;
}

/**
 * Emits theme overrides only inside Flowpanel roots and namespaced portals.
 * Host application tokens and its own dark-mode convention remain untouched.
 * Data fills follow a host accent unless the host sets `--fp-data` itself.
 */
export function ThemeVars({ theme }: { theme: ThemeConfig | undefined }) {
  if (!theme) return null;
  const decls = declarations(theme.cssVars);
  const dataFollowsAccent = !!theme.accent && !declares(theme.cssVars, "fp-data");
  if (theme.accent) {
    decls.unshift(accentDecl(theme.accent));
    if (dataFollowsAccent) decls.splice(1, 0, "--fp-data:var(--fp-accent)");
  }
  const darkDecls = declarations(theme.cssVarsDark);
  if (!declares(theme.cssVarsDark, "fp-data")) {
    if (theme.accentDark) darkDecls.unshift("--fp-data:var(--fp-accent)");
    else if (dataFollowsAccent) darkDecls.push("--fp-data:var(--fp-chart-1)");
  }
  if (theme.accentDark) darkDecls.unshift(accentDecl(theme.accentDark));
  const targets = "[data-flowpanel-root],[data-flowpanel-portal]";
  const darkTargets =
    'html[data-flowpanel-theme="dark"] [data-flowpanel-root],html[data-flowpanel-theme="dark"] [data-flowpanel-portal],[data-flowpanel-root][data-theme="dark"],[data-flowpanel-portal][data-theme="dark"]';
  const dark = darkDecls.length > 0 ? `${darkTargets}{${darkDecls.join(";")}}` : "";
  if (decls.length === 0 && !dark) return null;
  const root = decls.length > 0 ? `${targets}{${decls.join(";")}}` : "";
  return <style>{`${root}${dark}`}</style>;
}

/** `--fp-bg-2`, the page behind every card, per scheme, as `admin.css` declares it. */
export const PAGE_COLOR = { light: "220 9% 96.9%", dark: "220 9% 7%" } as const;

const TRIPLET = /^[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$/;

function pageColor(values: Record<string, string> | undefined, fallback: string): string {
  const own = (values?.["--fp-bg-2"] ?? values?.["fp-bg-2"])?.replace(UNSAFE, "").trim();
  if (own && !TRIPLET.test(normalizeAccent(own))) return own;
  return `hsl(${normalizeAccent(own ?? fallback)})`;
}

function schemeMedia(theme: ThemeConfig | undefined, scheme: "light" | "dark"): string {
  const mode = theme?.mode;
  if (mode === "light" || mode === "dark") return mode === scheme ? "all" : "not all";
  return `(prefers-color-scheme: ${scheme})`;
}

/** Mobile browser chrome in the page colour of each scheme; the theme toggle picks one. */
export function ThemeColor({ theme }: { theme: ThemeConfig | undefined }) {
  return (
    <>
      <meta
        name="theme-color"
        media={schemeMedia(theme, "light")}
        content={pageColor(theme?.cssVars, PAGE_COLOR.light)}
        data-flowpanel="light"
      />
      <meta
        name="theme-color"
        media={schemeMedia(theme, "dark")}
        content={pageColor(theme?.cssVarsDark, PAGE_COLOR.dark)}
        data-flowpanel="dark"
      />
    </>
  );
}
