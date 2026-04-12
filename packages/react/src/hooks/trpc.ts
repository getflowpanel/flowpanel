import type { FlowPanelRouter } from "@flowpanel/core/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createContext, useContext } from "react";

type FlowPanelClient = ReturnType<typeof createTRPCClient<FlowPanelRouter>>;

export const TRPCClientContext = createContext<FlowPanelClient | null>(null);

export function useTRPCClient(): FlowPanelClient {
  const client = useContext(TRPCClientContext);
  if (!client) throw new Error("useTRPCClient must be used within FlowPanelProvider");
  return client;
}

export function createFlowPanelTRPCClient(baseUrl: string): FlowPanelClient {
  return createTRPCClient<FlowPanelRouter>({
    links: [httpBatchLink({ url: baseUrl })],
  });
}
