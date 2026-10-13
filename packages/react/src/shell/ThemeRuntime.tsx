"use client";

import { useTheme } from "../hooks/useTheme";
import type { ThemeMode } from "../lib/theme";

export interface ThemeRuntimeProps {
  defaultMode?: ThemeMode;
}

/** Keeps the resolved theme in sync after client-side route transitions. */
export function ThemeRuntime({ defaultMode = "auto" }: ThemeRuntimeProps) {
  useTheme({ defaultMode });
  return null;
}
