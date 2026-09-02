import type { LabelsConfig } from "@flowpanel/core";
import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast";
import { ApiBaseProvider } from "../_provider/ApiBaseContext";
import { ComponentsProvider, type FlowpanelComponentSlots } from "../_provider/ComponentsContext";
import { LabelsProvider } from "../_provider/LabelsContext";
import type { ThemeMode } from "../lib/theme";
import { RealtimeProvider } from "../realtime/RealtimeProvider";
import { ThemeRuntime } from "./ThemeRuntime";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  /** Default theme mode when the user has no stored choice. */
  themeMode?: ThemeMode;
  /** Where the route handlers are mounted — `paths.api`. Every client fetch is built from it. */
  apiBase?: string;
  /** Override the SSE endpoint. Defaults to `${apiBase}/stream`. */
  realtimeEndpoint?: string;
  children: React.ReactNode;
}

export function FlowpanelGlobals({
  themeComponents,
  labels,
  themeMode,
  apiBase,
  realtimeEndpoint,
  children,
}: FlowpanelGlobalsProps) {
  const endpoint = realtimeEndpoint ?? (apiBase ? `${apiBase}/stream` : undefined);
  return (
    <ComponentsProvider {...(themeComponents ? { value: themeComponents } : {})}>
      <ApiBaseProvider {...(apiBase ? { value: apiBase } : {})}>
        <LabelsProvider {...(labels ? { value: labels } : {})}>
          <RealtimeProvider {...(endpoint ? { endpoint } : {})}>
            <ToastProvider>
              <div data-flowpanel-root="" className="min-h-full">
                <ThemeRuntime {...(themeMode ? { defaultMode: themeMode } : {})} />
                {children}
              </div>
            </ToastProvider>
          </RealtimeProvider>
        </LabelsProvider>
      </ApiBaseProvider>
    </ComponentsProvider>
  );
}
