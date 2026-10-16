import type { ThemeConfig } from "@flowpanel/core";
import { contrastRatio, hslTriplet } from "./css-color";

const HSL_WRAPPER = /^hsla?\(([^)]*)\)$/i;

/**
 * Design tokens are consumed as `hsl(var(--fp-accent))`, so the variable holds a bare triplet.
 * Any CSS colour is converted to one, so a shadcn `oklch(…)` or a hex value works as it is.
 */
export function normalizeAccent(accent: string): string {
  const converted = hslTriplet(accent);
  if (converted) return converted;
  const match = HSL_WRAPPER.exec(accent.trim());
  const inner = match?.[1] ?? accent;
  return inner
    .trim()
    .replace(/\s*,\s*/g, " ")
    .replace(/\s*\/.*$/, "");
}

const UNSAFE = /[<>{};]/g;

/** The roots `admin.css` draws dark: by FlowPanel's own choice, or by the host's `.dark` in "host" mode. */
const DARK_TARGETS = [
  'html[data-flowpanel-theme="dark"] [data-flowpanel-root]:not([data-scheme="host"])',
  'html[data-flowpanel-theme="dark"]:not(:has([data-scheme="host"])) [data-flowpanel-portal]',
  '[data-flowpanel-root][data-theme="dark"]:not([data-scheme="host"])',
  '[data-flowpanel-portal][data-theme="dark"]',
  'html[class~="dark"] [data-flowpanel-root][data-scheme="host"]',
  'html[class~="dark"]:has([data-scheme="host"]) [data-flowpanel-portal]',
].join(",");

/** Each warning once per process, so a dev server does not repeat it on every request. */
const warned = new Set<string>();

/** In development, names an accent whose button text would read under WCAG's 4.5:1. */
function warnAccentContrast(option: "accent" | "accentDark", accent: string, text: string): void {
  if (process.env.NODE_ENV === "production") return;
  const ratio = contrastRatio(normalizeAccent(accent), normalizeAccent(text));
  const key = `${option}:${accent}:${text}`;
  if (ratio === null || ratio >= 4.5 || warned.has(key)) return;
  warned.add(key);
  const tokens = option === "accent" ? "cssVars" : "cssVarsDark";
  console.warn(
    `[flowpanel] theme.${option} "${accent}" gives its button text ${ratio.toFixed(2)}:1, under the 4.5:1 that text needs. Darken or lighten the accent, or set "--fp-accent-text" in theme.${tokens}.`,
  );
}

/** FlowPanel's colour tokens; the others hold a length, a shadow, a font or a timing, and a host's own tokens are its own. */
const COLOR_TOKEN =
  /^(?:--)?fp-(?:accent|bg-|border-|chart-|data$|err|info|ok|warn|overlay$|ring$|row-tint$|shadow-color$|text-)/;

/** In development, names a colour FlowPanel cannot read, which would leave its buttons or surfaces unpainted. */
function warnUnreadColor(option: string, value: string): void {
  if (process.env.NODE_ENV === "production" || hslTriplet(value) !== null) return;
  const key = `unread:${option}:${value}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `[flowpanel] ${option} "${value}" is not a colour FlowPanel can read: var() and color-mix() are not accepted in config. Use hex, a colour name or a colour function, such as the oklch() value from your globals.css.`,
  );
}

const tokenOf = (values: Record<string, string> | undefined, name: string): string | undefined =>
  values?.[`--${name}`] ?? values?.[name];

function declarations(values: Record<string, string> | undefined): string[] {
  const out: string[] = [];
  for (const [rawName, rawValue] of Object.entries(values ?? {})) {
    const name = rawName.startsWith("--") ? rawName : `--${rawName}`;
    if (!/^--[\w-]+$/.test(name)) continue;
    const value = String(rawValue).replace(UNSAFE, "").trim();
    out.push(`${name}:${hslTriplet(value) ?? value}`);
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
 * Emits theme overrides only inside Flowpanel roots and namespaced portals; host tokens remain untouched.
 * Data fills follow a host accent unless the host sets `--fp-data` itself.
 */
export function ThemeVars({ theme }: { theme: ThemeConfig | undefined }) {
  if (!theme) return null;
  if (theme.accent) warnUnreadColor("theme.accent", theme.accent);
  if (theme.accentDark) warnUnreadColor("theme.accentDark", theme.accentDark);
  const tokenSets: Array<[string, Record<string, string> | undefined]> = [
    ["theme.cssVars", theme.cssVars],
    ["theme.cssVarsDark", theme.cssVarsDark],
  ];
  for (const [option, values] of tokenSets) {
    for (const [name, value] of Object.entries(values ?? {})) {
      if (COLOR_TOKEN.test(name)) warnUnreadColor(`${option}["${name}"]`, String(value));
    }
  }
  if (theme.accent) {
    warnAccentContrast(
      "accent",
      theme.accent,
      tokenOf(theme.cssVars, "fp-accent-text") ?? "0 0% 100%",
    );
  }
  if (theme.accentDark) {
    const text = tokenOf(theme.cssVarsDark, "fp-accent-text") ?? "220 9% 7%";
    warnAccentContrast("accentDark", theme.accentDark, text);
  }
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
  const darkTargets = DARK_TARGETS;
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
  // The host draws its own scheme in "host" mode, browser chrome included.
  if (theme?.mode === "host") return null;
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
