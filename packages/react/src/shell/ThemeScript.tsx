"use client";

import { buildThemeInitScript, type ThemeMode } from "../lib/theme";

export interface ThemeScriptProps {
  defaultMode?: ThemeMode;
  /** Nonce supplied by the host's Content-Security-Policy integration. */
  nonce?: string;
}

/**
 * Inline `<script>` that applies the persisted theme before hydration.
 * A client render (a not-found or error boundary) emits it as an inert data block, so React does not warn about an unexecuted script.
 */
export function ThemeScript({ defaultMode = "auto", nonce }: ThemeScriptProps) {
  return (
    <script
      nonce={nonce}
      type={typeof window === "undefined" ? undefined : "application/json"}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant builder, no user input
      dangerouslySetInnerHTML={{ __html: buildThemeInitScript(defaultMode) }}
    />
  );
}
