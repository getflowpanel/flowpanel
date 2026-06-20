import { buildThemeInitScript, type ThemeMode } from "../lib/theme.js";

export interface ThemeScriptProps {
  defaultMode?: ThemeMode;
}

/** Inline `<script>` that runs synchronously before React hydration to apply the persisted theme. */
export function ThemeScript({ defaultMode = "auto" }: ThemeScriptProps) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant builder, no user input
  return <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript(defaultMode) }} />;
}
