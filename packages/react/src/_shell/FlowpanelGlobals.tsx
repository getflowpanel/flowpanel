import type { LabelsConfig } from "@flowpanel/core";
import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast.js";
import {
  ComponentsProvider,
  type FlowpanelComponentSlots,
} from "../_provider/ComponentsContext.js";
import { LabelsProvider } from "../_provider/LabelsContext.js";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  children: React.ReactNode;
}

/**
 * Wraps every FlowpanelPage in the contexts FlowPanel features rely on:
 * theme component overrides, i18n labels, and the toast portal. Decoupled
 * from `<AdminShell>` so `bare` and `tabs` shell modes can still ship
 * features like toasts, drawer actions, and ⌘K palette without forcing
 * a sidebar layout.
 */
export function FlowpanelGlobals({ themeComponents, labels, children }: FlowpanelGlobalsProps) {
  return (
    <ComponentsProvider {...(themeComponents ? { value: themeComponents } : {})}>
      <LabelsProvider {...(labels ? { value: labels } : {})}>
        <ToastProvider>{children}</ToastProvider>
      </LabelsProvider>
    </ComponentsProvider>
  );
}
