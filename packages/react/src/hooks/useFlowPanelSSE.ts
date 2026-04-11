import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { LiveStatus } from "./useFlowPanelStream.js";
import { useFlowPanelStream } from "./useFlowPanelStream.js";

export function useFlowPanelSSE(url: string): { status: LiveStatus } {
  const queryClient = useQueryClient();

  const { status } = useFlowPanelStream({
    url,
    onEvent: useCallback(
      (event) => {
        if (
          event.event === "run.created" ||
          event.event === "run.finished" ||
          event.event === "run.failed"
        ) {
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "runs"]] });
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "stages"]] });
        } else if (event.event === "metrics.updated") {
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "metrics"]] });
        }
      },
      [queryClient],
    ),
  });

  return { status };
}
