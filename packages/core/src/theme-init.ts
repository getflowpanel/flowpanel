export type ThemeMode = "light" | "dark" | "auto";

/** Shared by the head script and the interactive theme controls. */
export const THEME_STORAGE_KEY = "fp-theme";

/**
 * Server-safe inline script body. The host supplies its CSP nonce on the script
 * element. Only the FlowPanel dataset marker is changed; host classes are kept.
 */
export function buildThemeInitScript(defaultMode: ThemeMode = "auto"): string {
  const mode = defaultMode === "light" || defaultMode === "dark" ? defaultMode : "auto";
  return `(function(){var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}try{var m=${JSON.stringify(mode)};var d=s==='dark'||s==='light'?s:m;if(d==='auto'){try{d=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){d='light';}}document.documentElement.dataset.flowpanelTheme=d;}catch(e){}})();`;
}
