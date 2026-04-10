import type { CSSProperties } from "react";

export interface ResolvedTheme {
  accent: string;
  radius: string;
  fontSans: string;
  fontMono: string;
  colorScheme: "dark" | "light" | "auto";
  stageColors: Record<string, string>;
}

const DEFAULT_PALETTE = [
  "#818cf8",
  "#6ee7b7",
  "#f9a8d4",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
];

export function resolveTheme(config: {
  theme?: {
    accent?: string;
    radius?: string;
    fontSans?: string;
    fontMono?: string;
    colorScheme?: "dark" | "light" | "auto";
  };
  pipeline: { stages: readonly string[]; stageColors?: Record<string, string> };
}): ResolvedTheme {
  const sortedStages = [...config.pipeline.stages].sort();
  const stageColors: Record<string, string> = {};

  for (let i = 0; i < sortedStages.length; i++) {
    const stage = sortedStages[i]!;
    stageColors[stage] =
      config.pipeline.stageColors?.[stage] ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]!;
  }

  return {
    accent: config.theme?.accent ?? "#6366f1",
    radius: config.theme?.radius ?? "12px",
    fontSans: config.theme?.fontSans ?? '"Inter", system-ui, sans-serif',
    fontMono: config.theme?.fontMono ?? '"JetBrains Mono", monospace',
    colorScheme: config.theme?.colorScheme ?? "auto",
    stageColors,
  };
}

export function themeToStyle(theme: ResolvedTheme): CSSProperties {
  const vars: Record<string, string> = {
    "--fp-accent": theme.accent,
    "--fp-radius-card": theme.radius,
    "--fp-font-sans": theme.fontSans,
    "--fp-font-mono": theme.fontMono,
  };

  for (const [stage, color] of Object.entries(theme.stageColors)) {
    vars[`--fp-stage-${stage}`] = color;
  }

  return vars as unknown as CSSProperties;
}
