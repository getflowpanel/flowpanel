import type { LabelsConfig } from "@flowpanel/core";
import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast.js";
import {
  ComponentsProvider,
  type FlowpanelComponentSlots,
} from "../_provider/ComponentsContext.js";
import { LabelsProvider } from "../_provider/LabelsContext.js";
import type { ThemeMode } from "../lib/theme.js";
import { ThemeScript } from "./ThemeScript.js";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  /**
   * Default theme mode when the user has no stored choice. Defaults to
   * `"auto"` (follow `prefers-color-scheme`). An explicit toggle persists
   * to `localStorage["fp-theme"]` and always overrides this default.
   */
  themeMode?: ThemeMode;
  children: React.ReactNode;
}

/**
 * Wraps every FlowpanelPage in the contexts FlowPanel features rely on:
 * theme component overrides, i18n labels, and the toast portal. Decoupled
 * from `<AdminShell>` so `bare` and `tabs` shell modes can still ship
 * features like toasts, drawer actions, and ⌘K palette without forcing
 * a sidebar layout.
 *
 * Also emits an inline `<script>` (`<ThemeScript>`) that applies the
 * persisted dark/light theme before first paint to avoid FOUC.
 */
export function FlowpanelGlobals({
  themeComponents,
  labels,
  themeMode,
  children,
}: FlowpanelGlobalsProps) {
  return (
    <ComponentsProvider {...(themeComponents ? { value: themeComponents } : {})}>
      <LabelsProvider {...(labels ? { value: labels } : {})}>
        <ToastProvider>
          <ThemeScript {...(themeMode ? { defaultMode: themeMode } : {})} />
          {children}
        </ToastProvider>
      </LabelsProvider>
    </ComponentsProvider>
  );
}
