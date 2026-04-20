"use client";

import type { JobState, QueueJob, QueueStatus, SerializedQueue } from "@flowpanel/core";
import { Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { toast } from "../ui/sonner";
import { cn } from "../utils/cn";
import { JobDetail } from "./JobDetail";
import { QueueTable } from "./QueueTable";

const STATES: Array<{ id: JobState | "all"; label: string; color?: string }> = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting", color: "bg-muted text-muted-foreground" },
  { id: "active", label: "Active", color: "bg-blue-500/20 text-blue-600 dark:text-blue-300" },
  { id: "failed", label: "Failed", color: "bg-red-500/20 text-red-600 dark:text-red-300" },
  {
    id: "completed",
    label: "Completed",
    color: "bg-green-500/20 text-green-600 dark:text-green-300",
  },
  {
    id: "delayed",
    label: "Delayed",
    color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-300",
  },
];

export function QueuePage({
  queue,
  baseUrl,
  refreshIntervalMs = 5_000,
}: {
  queue: SerializedQueue;
  baseUrl: string;
  refreshIntervalMs?: number;
}) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<JobState | "all">("all");
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<QueueJob | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, jobsRes] = await Promise.all([
        fetch(`${baseUrl}/flowpanel.queue.status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queueId: queue.id }),
        }),
        fetch(`${baseUrl}/flowpanel.queue.jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queueId: queue.id,
            state: state === "all" ? undefined : state,
            limit: 50,
            offset: 0,
          }),
        }),
      ]);
      const statusJson = await statusRes.json();
      const jobsJson = await jobsRes.json();
      setStatus(unwrap(statusJson) as QueueStatus);
      const jobsData = unwrap(jobsJson) as { jobs: QueueJob[]; total: number };
      setJobs(jobsData.jobs);
      setTotal(jobsData.total);
    } catch (err) {
      toast.error("Failed to load queue", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [baseUrl, queue.id, state]);

  useEffect(() => {
    void refresh();
    if (refreshIntervalMs > 0) {
      const i = setInterval(() => void refresh(), refreshIntervalMs);
      return () => clearInterval(i);
    }
  }, [refresh, refreshIntervalMs]);

  const handleAction = async (endpoint: string, body: Record<string, unknown>, label: string) => {
    try {
      const res = await fetch(`${baseUrl}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success(`${label} succeeded`);
      await refresh();
    } catch (err) {
      toast.error(`${label} failed`, { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{queue.label}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Queue <code className="font-mono">{queue.name}</code>
            {status?.paused && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                <Pause className="h-3 w-3" /> Paused
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          {queue.capabilities.pause && !status?.paused && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void handleAction("flowpanel.queue.pause", { queueId: queue.id }, "Pause")
              }
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          {queue.capabilities.resume && status?.paused && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void handleAction("flowpanel.queue.resume", { queueId: queue.id }, "Resume")
              }
            >
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}
          {queue.capabilities.drain && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void handleAction("flowpanel.queue.drain", { queueId: queue.id }, "Drain")
              }
            >
              <Trash2 className="h-4 w-4" />
              Drain
            </Button>
          )}
        </div>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["waiting", "active", "delayed", "failed", "completed"] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {loading && status === null ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                (status?.[s] ?? 0).toLocaleString()
              )}
            </div>
          </div>
        ))}
      </div>

      {/* State filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setState(s.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              state === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Jobs table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <QueueTable
          jobs={jobs}
          loading={loading}
          onRowClick={(job) => setSelectedJob(job)}
          selectedJobId={selectedJob?.id}
        />
        {!loading && jobs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No jobs {state !== "all" ? `in ${state}` : "yet"}.
          </div>
        )}
        {total > jobs.length && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            Showing {jobs.length} of {total.toLocaleString()}. Narrow with a state filter to see
            more.
          </div>
        )}
      </div>

      {/* Job detail drawer */}
      {selectedJob && (
        <JobDetail
          queue={queue}
          job={selectedJob}
          baseUrl={baseUrl}
          onClose={() => setSelectedJob(null)}
          onUpdated={() => void refresh()}
        />
      )}
    </div>
  );
}

function unwrap(json: unknown): unknown {
  if (json && typeof json === "object" && "result" in json) {
    const r = (json as { result?: { data?: unknown } }).result;
    if (r && typeof r === "object" && "data" in r) return r.data;
  }
  return json;
}
