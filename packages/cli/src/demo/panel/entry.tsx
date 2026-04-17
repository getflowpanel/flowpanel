import { FlowPanelUI } from "@flowpanel/react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    __FP_DEMO_CONFIG__: Record<string, unknown>;
  }
}

const config = window.__FP_DEMO_CONFIG__;

const root = document.getElementById("fp-root");
if (root) {
  createRoot(root).render(
    // biome-ignore lint/suspicious/noExplicitAny: demo entry config is loosely typed
    <FlowPanelUI config={config as any} trpcBaseUrl="/api/trpc" showDemoBanner />,
  );
}
