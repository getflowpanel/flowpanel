import { buildThemeInitScript, type ThemeMode } from "../lib/theme.js";

export interface ThemeScriptProps {
  /** Default mode when no explicit user choice exists. `"auto"` follows
   * `prefers-color-scheme`. */
  defaultMode?: ThemeMode;
}

/**
 * Inline `<script>` that runs synchronously before React hydration to apply
 * the persisted theme. Without this, an SSR'd page renders in `:root` (light)
 * and then flips to `.dark` once `useTheme` mounts — visible flash of
 * unstyled-theme content.
 */
export function ThemeScript({ defaultMode = "auto" }: ThemeScriptProps) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant builder, no user input
  return <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript(defaultMode) }} />;
}
