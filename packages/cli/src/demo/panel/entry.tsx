import { FlowPanelUI } from "@flowpanel/react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    __FP_DEMO_CONFIG__: Record<string, unknown>;
  }
}

const config = window.__FP_DEMO_CONFIG__;

createRoot(document.getElementById("fp-root")!).render(
  <FlowPanelUI config={config as any} trpcBaseUrl="/api/trpc" showDemoBanner />,
);
