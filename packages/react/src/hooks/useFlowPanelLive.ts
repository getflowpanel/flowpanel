import { useCallback, useState } from "react";
import type { RunsAction } from "./useFlowPanelData";
import type { LiveStatus } from "./useFlowPanelStream";
import { useFlowPanelStream } from "./useFlowPanelStream";

interface UseFlowPanelLiveOptions {
  streamUrl: string;
  dispatchRuns: React.Dispatch<RunsAction>;
  onMetricsUpdate: (data: Record<string, unknown>) => void;
}

export function useFlowPanelLive({
  streamUrl,
  dispatchRuns,
  onMetricsUpdate,
}: UseFlowPanelLiveOptions): {
  status: LiveStatus;
  liveAnnouncement: string;
} {
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const { status } = useFlowPanelStream({
    url: streamUrl,
    onEvent: useCallback(
      (event) => {
        if (event.event === "run.created") {
          dispatchRuns({ type: "BUFFER_RUN", run: event.data as Record<string, unknown> });
          setLiveAnnouncement("New run started");
        } else if (event.event === "run.finished" || event.event === "run.failed") {
          const data = event.data as Record<string, unknown>;
          dispatchRuns({
            type: "UPDATE_RUN",
            runId: String(data.id),
            update: { status: data.status, duration_ms: data.durationMs },
          });
          if (event.event === "run.failed") setLiveAnnouncement("Run failed");
        } else if (event.event === "metrics.updated") {
          onMetricsUpdate(event.data as Record<string, unknown>);
        }
      },
      [dispatchRuns, onMetricsUpdate],
    ),
  });

  return { status, liveAnnouncement };
}
