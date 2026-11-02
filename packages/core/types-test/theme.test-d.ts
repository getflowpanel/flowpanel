import type { ThemeConfig } from "@flowpanel/core";
import { buildThemeInitScript, type ThemeMode } from "@flowpanel/core/theme";
import { expectAssignable, expectError, expectType } from "tsd";

const mode: ThemeMode = "auto";
expectType<string>(buildThemeInitScript(mode));
expectError(buildThemeInitScript("system"));

expectAssignable<ThemeConfig>({
  cssVarsDark: { "--fp-text-1": "0 0% 98%" },
});

expectAssignable<ThemeConfig>({
  cssVars: { "--fp-data": "185 45% 40%", "--fp-font-sans": "'IBM Plex Sans'", "--fp-own": "1" },
});
expectError<ThemeConfig>({ cssVars: { "--fp-data": 1 } });
expectType<string | undefined>(({} as NonNullable<ThemeConfig["cssVars"]>)["--fp-data"]);
