/**
 * Built-in theme presets — each produces a CSS variable bundle that
 * override the base tokens in `tokens.css`. Users pick one via the
 * `theme.preset` config field, or drop their own object into
 * `theme.tokens` for full custom control.
 */

export interface ThemeTokens {
  /** HSL channels, space-separated. Accepts any CSS color if you prefer. */
  background?: string;
  foreground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  primary?: string;
  primaryForeground?: string;
  destructive?: string;
  destructiveForeground?: string;
  success?: string;
  successForeground?: string;
  /** CSS length (e.g. "0.5rem"). */
  radius?: string;
  /** Scalar multiplier for built-in spacing. 1 = default, 0.9 = denser. */
  density?: number;
  fontSans?: string;
  fontMono?: string;
}

export type PresetName = "default" | "violet" | "emerald" | "slate";

export const THEME_PRESETS: Record<PresetName, ThemeTokens> = {
  // Default ships as-is in tokens.css — the preset intentionally matches.
  default: {
    primary: "221 83% 53%",
    ring: "221 83% 53%",
  },
  violet: {
    primary: "262 83% 58%",
    ring: "262 83% 58%",
  },
  emerald: {
    primary: "160 84% 39%",
    ring: "160 84% 39%",
    success: "160 84% 39%",
  },
  slate: {
    primary: "215 20% 35%",
    ring: "215 20% 35%",
    radius: "0.375rem",
  },
};

/** Convert ThemeTokens into a CSS `style` map with `--fp-*` variables. */
export function tokensToStyle(tokens: ThemeTokens): Record<string, string> {
  const map: Record<string, string> = {};
  const set = (k: keyof ThemeTokens, cssVar: string) => {
    const v = tokens[k];
    if (v != null && v !== "") map[cssVar] = String(v);
  };
  set("background", "--fp-background");
  set("foreground", "--fp-foreground");
  set("muted", "--fp-muted");
  set("mutedForeground", "--fp-muted-foreground");
  set("border", "--fp-border");
  set("input", "--fp-input");
  set("ring", "--fp-ring");
  set("primary", "--fp-primary");
  set("primaryForeground", "--fp-primary-foreground");
  set("destructive", "--fp-destructive");
  set("destructiveForeground", "--fp-destructive-foreground");
  set("success", "--fp-success");
  set("successForeground", "--fp-success-foreground");
  set("radius", "--fp-radius");
  set("fontSans", "--fp-font-sans");
  set("fontMono", "--fp-font-mono");
  if (tokens.density != null) map["--fp-density"] = String(tokens.density);
  return map;
}

/** Resolve a preset + user overrides into final style. Overrides win. */
export function resolvePresetStyle(
  preset: PresetName | undefined,
  overrides: ThemeTokens | undefined,
): Record<string, string> {
  const base = preset ? THEME_PRESETS[preset] : {};
  return tokensToStyle({ ...base, ...(overrides ?? {}) });
}
