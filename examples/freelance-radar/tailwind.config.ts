import type { Config } from "tailwindcss";

/**
 * FlowPanel design tokens are CSS custom properties defined in
 * `@flowpanel/react/styles/admin.css` (`--fp-bg-1`, `--fp-text-1`, …).
 * `admin.css` also has a `@theme {}` block, which is Tailwind v4 syntax —
 * Tailwind v3 ignores it. Until the example upgrades to v4 we mirror the
 * token map into `theme.extend` so utilities like `bg-fp-bg-1`,
 * `text-fp-text-1`, `border-fp-border-1`, `rounded-fp` actually emit CSS.
 */
const fpColor = (name: string) => `hsl(var(--fp-${name}) / <alpha-value>)`;

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/react/src/**/*.{ts,tsx}",
    "../../packages/next/src/**/*.{ts,tsx}",
    "../../packages/charts/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "fp-bg-1": fpColor("bg-1"),
        "fp-bg-2": fpColor("bg-2"),
        "fp-bg-3": fpColor("bg-3"),
        "fp-text-1": fpColor("text-1"),
        "fp-text-2": fpColor("text-2"),
        "fp-text-3": fpColor("text-3"),
        "fp-border-1": fpColor("border-1"),
        "fp-border-2": fpColor("border-2"),
        "fp-accent": fpColor("accent"),
        "fp-accent-text": fpColor("accent-text"),
        "fp-ok": fpColor("ok"),
        "fp-warn": fpColor("warn"),
        "fp-err": fpColor("err"),
      },
      borderRadius: {
        fp: "var(--fp-radius)",
        "fp-sm": "var(--fp-radius-sm)",
        "fp-lg": "var(--fp-radius-lg)",
      },
      fontFamily: {
        sans: "var(--fp-font-sans)",
        mono: "var(--fp-font-mono)",
      },
    },
  },
} satisfies Config;
