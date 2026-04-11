import type { FlowPanelConfig } from "@flowpanel/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import { FlowPanelContext } from "./context.js";
import { createFlowPanelTRPCClient, TRPCClientContext } from "./hooks/trpc.js";
import { resolveTheme, themeToStyle } from "./theme/index.js";

interface FlowPanelProviderProps {
  config: FlowPanelConfig;
  trpcBaseUrl: string;
  children: React.ReactNode;
}

export function FlowPanelProvider({ config, trpcBaseUrl, children }: FlowPanelProviderProps) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }),
  );
  const [trpcClient] = useState(() => createFlowPanelTRPCClient(trpcBaseUrl));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = resolveTheme(config);
  const themeStyle = themeToStyle(theme);

  const colorScheme = config.theme?.colorScheme ?? "auto";
  const rootClassName = [
    "fp-root",
    "flowpanel",
    colorScheme === "dark" ? "fp-dark" : "",
    colorScheme === "light" ? "fp-light" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TRPCClientContext.Provider value={trpcClient}>
      <QueryClientProvider client={queryClient}>
        <FlowPanelContext.Provider
          value={{
            config,
            timezone: config.timezone ?? "UTC",
            container: containerRef.current,
          }}
        >
          <div
            ref={containerRef}
            className={rootClassName}
            style={{ ...themeStyle, minHeight: "100vh" }}
            data-testid="fp-root"
          >
            {children}
          </div>
        </FlowPanelContext.Provider>
      </QueryClientProvider>
    </TRPCClientContext.Provider>
  );
}
