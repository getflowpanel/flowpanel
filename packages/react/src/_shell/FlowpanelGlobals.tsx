import type { LabelsConfig } from "@flowpanel/core";
import { type FormattingConfig, resolveFormatting } from "@flowpanel/core/format";
import type * as React from "react";
import { ToastProvider } from "../_feedback/Toast";
import { ApiBaseProvider } from "../_provider/ApiBaseContext";
import { ComponentsProvider, type FlowpanelComponentSlots } from "../_provider/ComponentsContext";
import { FormattingProvider } from "../_provider/FormattingContext";
import { LabelsProvider } from "../_provider/LabelsContext";
import { withDeploymentBasePath } from "../lib/deployment-base";
import type { ThemeMode } from "../lib/theme";
import { RealtimeProvider } from "../realtime/RealtimeProvider";
import { ThemeRuntime } from "./ThemeRuntime";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  /** Default theme mode when the user has no stored choice. */
  themeMode?: ThemeMode;
  /**
   * Where the route handlers are mounted — `paths.api`, app-relative. A
   * deployment `basePath` is prefixed here, because the browser does not add it
   * to a fetch of its own.
   */
  apiBase?: string;
  /** Override the SSE endpoint. Defaults to `${apiBase}/stream`. */
  realtimeEndpoint?: string;
  /** Locale, timezone and currency for numbers, money and timestamps. */
  formatting?: FormattingConfig;
  children: React.ReactNode;
}

export function FlowpanelGlobals({
  themeComponents,
  labels,
  themeMode,
  apiBase,
  realtimeEndpoint,
  formatting,
  children,
}: FlowpanelGlobalsProps) {
  const base = apiBase === undefined ? undefined : withDeploymentBasePath(apiBase);
  const endpoint = realtimeEndpoint ?? (base ? `${base}/stream` : undefined);
  return (
    <ComponentsProvider {...(themeComponents ? { value: themeComponents } : {})}>
      <FormattingProvider value={resolveFormatting(formatting)}>
        <ApiBaseProvider {...(base ? { value: base } : {})}>
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
      </FormattingProvider>
    </ComponentsProvider>
  );
}
