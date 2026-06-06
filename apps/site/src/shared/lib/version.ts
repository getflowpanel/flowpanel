/**
 * The umbrella package's version, inlined at build time via
 * `NEXT_PUBLIC_FLOWPANEL_VERSION` (see next.config.ts). Baking it in keeps
 * the value correct in the standalone output, where a runtime fs read of the
 * monorepo package.json would not resolve.
 */
export const flowpanelVersion = process.env.NEXT_PUBLIC_FLOWPANEL_VERSION ?? "0.0.0";
