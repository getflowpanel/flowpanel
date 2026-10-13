import type { LabelsConfig } from "@flowpanel/core";
import { type FormattingConfig, resolveFormatting } from "@flowpanel/core/format";
import type * as React from "react";
import { ToastProvider } from "../feedback/Toast";
import { withDeploymentBasePath } from "../lib/deployment-base";
import type { ThemeMode } from "../lib/theme";
import { ApiBaseProvider } from "../provider/ApiBaseContext";
import { ComponentsProvider, type FlowpanelComponentSlots } from "../provider/ComponentsContext";
import { FormattingProvider } from "../provider/FormattingContext";
import { LabelsProvider } from "../provider/LabelsContext";
import { RealtimeProvider } from "../realtime/RealtimeProvider";
import { ShortcutsHost } from "./ShortcutsHost";
import { ThemeRuntime } from "./ThemeRuntime";

export interface FlowpanelGlobalsProps {
  themeComponents?: Partial<FlowpanelComponentSlots>;
  labels?: LabelsConfig;
  /** Default theme mode when the user has no stored choice. */
  themeMode?: ThemeMode;
  /** Where the route handlers are mounted — `paths.api`, app-relative; a deployment `basePath` is prefixed here. */
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
                <div data-flowpanel-root="" className="fp-min-h-full">
                  <ThemeRuntime {...(themeMode ? { defaultMode: themeMode } : {})} />
                  <ShortcutsHost>{children}</ShortcutsHost>
                </div>
              </ToastProvider>
            </RealtimeProvider>
          </LabelsProvider>
        </ApiBaseProvider>
      </FormattingProvider>
    </ComponentsProvider>
  );
}
