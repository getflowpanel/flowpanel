import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createContext, useContext } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTRPCClient = ReturnType<typeof createTRPCClient<any>>;

export const TRPCClientContext = createContext<AnyTRPCClient | null>(null);

export function useTRPCClient(): AnyTRPCClient {
  const client = useContext(TRPCClientContext);
  if (!client) throw new Error("useTRPCClient must be used within FlowPanelProvider");
  return client;
}

export function createFlowPanelTRPCClient(baseUrl: string) {
  return createTRPCClient<any>({
    links: [httpBatchLink({ url: baseUrl })],
  });
}
