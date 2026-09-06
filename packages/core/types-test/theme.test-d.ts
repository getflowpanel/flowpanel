import type { ThemeConfig } from "@flowpanel/core";
import { buildThemeInitScript, type ThemeMode } from "@flowpanel/core/theme";
import { expectAssignable, expectError, expectType } from "tsd";

const mode: ThemeMode = "auto";
expectType<string>(buildThemeInitScript(mode));
expectError(buildThemeInitScript("system"));

expectAssignable<ThemeConfig>({
  cssVarsDark: { "--fp-text-1": "0 0% 98%" },
});
