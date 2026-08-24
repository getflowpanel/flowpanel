import type { LabelsConfig } from "@flowpanel/core";
import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast.js";
import {
  ComponentsProvider,
  type FlowpanelComponentSlots,
} from "../_provider/ComponentsContext.js";
import { LabelsProvider } from "../_provider/LabelsContext.js";
import type { ThemeMode } from "../lib/theme.js";
import { RealtimeProvider } from "../realtime/RealtimeProvider.js";
import { ThemeRuntime } from "./ThemeRuntime.js";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  /** Default theme mode when the user has no stored choice. */
  themeMode?: ThemeMode;
  /** Override the SSE endpoint used by widget realtime subscriptions. */
  realtimeEndpoint?: string;
  children: React.ReactNode;
}

export function FlowpanelGlobals({
  themeComponents,
  labels,
  themeMode,
  realtimeEndpoint,
  children,
}: FlowpanelGlobalsProps) {
  return (
    <ComponentsProvider {...(themeComponents ? { value: themeComponents } : {})}>
      <LabelsProvider {...(labels ? { value: labels } : {})}>
        <RealtimeProvider {...(realtimeEndpoint ? { endpoint: realtimeEndpoint } : {})}>
          <ToastProvider>
            <div data-flowpanel-root="" className="contents">
              <ThemeRuntime {...(themeMode ? { defaultMode: themeMode } : {})} />
              {children}
            </div>
          </ToastProvider>
        </RealtimeProvider>
      </LabelsProvider>
    </ComponentsProvider>
  );
}
