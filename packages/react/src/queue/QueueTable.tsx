"use client";

import type { JobState, QueueJob } from "@flowpanel/core";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cn } from "../utils/cn";

export function QueueTable({
  jobs,
  loading,
  onRowClick,
  selectedJobId,
}: {
  jobs: QueueJob[];
  loading: boolean;
  onRowClick?: (job: QueueJob) => void;
  selectedJobId?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">State</TableHead>
          <TableHead className="w-20 text-right">Attempts</TableHead>
          <TableHead className="w-40">Scheduled</TableHead>
          <TableHead className="w-40">Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && jobs.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))
          : jobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              const duration =
                job.finishedOn && job.processedOn
                  ? formatDuration(job.finishedOn - job.processedOn)
                  : job.processedOn
                    ? `${formatDuration(Date.now() - job.processedOn)} (running)`
                    : "—";

              return (
                <TableRow
                  key={job.id}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer", isSelected && "bg-muted/60")}
                  onClick={onRowClick ? () => onRowClick(job) : undefined}
                >
                  <TableCell className="font-mono text-xs">{job.id}</TableCell>
                  <TableCell className="font-medium">
                    {job.name}
                    {job.failedReason && (
                      <div className="mt-1 line-clamp-1 text-xs text-destructive">
                        {job.failedReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StateBadge state={job.state} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {job.attemptsMade}
                    {job.maxAttempts ? `/${job.maxAttempts}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(job.timestamp)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{duration}</TableCell>
                </TableRow>
              );
            })}
      </TableBody>
    </Table>
  );
}

function StateBadge({ state }: { state: JobState }) {
  const colors: Record<JobState, string> = {
    active: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    waiting: "bg-muted text-muted-foreground",
    completed: "bg-green-500/20 text-green-700 dark:text-green-300",
    failed: "bg-red-500/20 text-red-700 dark:text-red-300",
    delayed: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    paused: "bg-zinc-400/20 text-zinc-700 dark:text-zinc-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[state],
      )}
    >
      {state}
    </span>
  );
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
