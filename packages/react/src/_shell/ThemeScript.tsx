import { buildThemeInitScript, type ThemeMode } from "../lib/theme";

export interface ThemeScriptProps {
  defaultMode?: ThemeMode;
  /** Nonce supplied by the host's Content-Security-Policy integration. */
  nonce?: string;
}

/** Inline `<script>` that runs synchronously before React hydration to apply the persisted theme. */
export function ThemeScript({ defaultMode = "auto", nonce }: ThemeScriptProps) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted constant builder, no user input
    <script nonce={nonce} dangerouslySetInnerHTML={{ __html: buildThemeInitScript(defaultMode) }} />
  );
}
