import type { SerializedQueue, SerializedResource, SerializedWidget } from "@flowpanel/core";
import { useEffect, useState } from "react";

export interface AdminSchema {
  resourceMap: Record<string, SerializedResource>;
  queueMap: Record<string, SerializedQueue>;
  dashboardWidgets: SerializedWidget[];
}

/**
 * Load resource / queue / dashboard schemas from the admin tRPC endpoint.
 *
 * Each is fetched independently and may be empty if the corresponding
 * feature is not configured on the server — in that case the related
 * navigation entry simply isn't rendered.
 */
export function useAdminSchema(baseUrl: string): AdminSchema {
  const [resourceMap, setResourceMap] = useState<Record<string, SerializedResource>>({});
  const [queueMap, setQueueMap] = useState<Record<string, SerializedQueue>>({});
  const [dashboardWidgets, setDashboardWidgets] = useState<SerializedWidget[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/flowpanel.resource.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { resources: Record<string, SerializedResource> } } }
          | { resources: Record<string, SerializedResource> };
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { resources: Record<string, SerializedResource> });
        if (!cancelled) setResourceMap(payload.resources ?? {});
      } catch {
        // Resource schema not available — no resource tabs shown
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/flowpanel.queue.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { queues: Record<string, SerializedQueue> } } }
          | { queues: Record<string, SerializedQueue> };
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { queues: Record<string, SerializedQueue> });
        if (!cancelled) setQueueMap(payload.queues ?? {});
      } catch {
        // Queue schema not available
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${baseUrl}/flowpanel.dashboard.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { widgets: SerializedWidget[] } } }
          | { widgets: SerializedWidget[] };
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { widgets: SerializedWidget[] });
        if (!cancelled) setDashboardWidgets(payload.widgets ?? []);
      } catch {
        // Dashboard not configured
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  return { resourceMap, queueMap, dashboardWidgets };
}
