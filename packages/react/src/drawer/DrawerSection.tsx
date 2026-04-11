import { useEffect, useState } from "react";
import { useTRPCClient } from "../hooks/trpc.js";
import { Skeleton } from "../components/ui/skeleton.js";
import {
  StatGridSection,
  KvGridSection,
  TrendChartSection,
  BreakdownSection,
  ErrorListSection,
  ErrorBlockSection,
  TimelineSection,
} from "../components/drawer-sections/index.js";
import type React from "react";

const SECTION_COMPONENTS: Record<string, React.ComponentType<{ data: any }>> = {
  "stat-grid": StatGridSection as React.ComponentType<{ data: any }>,
  "kv-grid": KvGridSection as React.ComponentType<{ data: any }>,
  "trend-chart": TrendChartSection as React.ComponentType<{ data: any }>,
  breakdown: BreakdownSection as React.ComponentType<{ data: any }>,
  "error-list": ErrorListSection as React.ComponentType<{ data: any }>,
  "error-block": ErrorBlockSection as React.ComponentType<{ data: any }>,
  timeline: TimelineSection as React.ComponentType<{ data: any }>,
};

type ShowIfPredicate = "hasError" | "hasMeta" | "isRunning";

interface DrawerSectionProps {
  type: string;
  runId: string;
  drawerType: string;
  showIf?: ShowIfPredicate;
}

function evaluateShowIf(predicate: ShowIfPredicate, run: Record<string, unknown> | null): boolean {
  if (!run) return true;
  switch (predicate) {
    case "hasError":
      return run.status === "err" || run.status === "failed";
    case "hasMeta":
      return (
        run.meta != null &&
        typeof run.meta === "object" &&
        Object.keys(run.meta as object).length > 0
      );
    case "isRunning":
      return run.status === "running";
    default:
      return true;
  }
}

export function DrawerSection({ type, runId, drawerType, showIf }: DrawerSectionProps) {
  const client = useTRPCClient();
  const [data, setData] = useState<{
    sections: Array<{ type: string; data: unknown; error?: string }>;
    run: Record<string, unknown> | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (client as any).drawers.render
      .query({ drawerId: drawerType, runId })
      .then((result: any) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, drawerType, runId]);

  if (loading) {
    return <Skeleton className="fp:h-24 fp:w-full fp:mb-3" />;
  }

  if (error) {
    return (
      <div className="fp:p-3 fp:text-xs fp:text-destructive fp:bg-destructive/10 fp:rounded-md fp:mb-3">
        Section error: {error}
      </div>
    );
  }

  if (!data) return null;

  if (showIf && !evaluateShowIf(showIf, data.run)) {
    return null;
  }

  const sectionData = data.sections.find((s) => s.type === type);
  if (!sectionData) return null;

  if (sectionData.error) {
    return (
      <div className="fp:p-3 fp:text-xs fp:text-destructive fp:bg-destructive/10 fp:rounded-md fp:mb-3">
        Section error: {sectionData.error}
      </div>
    );
  }

  const Component = SECTION_COMPONENTS[type];
  if (!Component) return null;

  return <Component data={sectionData.data} />;
}
