// Tailwind CSS preset for @flowpanel/react consumers.
// Import in your tailwind.config.ts:
//   import flowpanelPreset from "@flowpanel/react/tailwind";
//   export default { presets: [flowpanelPreset], ... }

// We intentionally avoid importing from "tailwindcss" so consumers don't need
// it as a peer dep of this package — they'll have it already in their project.
const flowpanelPreset = {
  content: [] as string[],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--fp-background) / <alpha-value>)",
        foreground: "hsl(var(--fp-foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--fp-muted) / <alpha-value>)",
          foreground: "hsl(var(--fp-muted-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--fp-border) / <alpha-value>)",
        input: "hsl(var(--fp-input) / <alpha-value>)",
        ring: "hsl(var(--fp-ring) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--fp-primary) / <alpha-value>)",
          foreground: "hsl(var(--fp-primary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--fp-destructive) / <alpha-value>)",
          foreground: "hsl(var(--fp-destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--fp-success) / <alpha-value>)",
          foreground: "hsl(var(--fp-success-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--fp-radius)",
        md: "calc(var(--fp-radius) - 2px)",
        sm: "calc(var(--fp-radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--fp-font-sans)"],
        mono: ["var(--fp-font-mono)"],
      },
    },
  },
};

export default flowpanelPreset;
