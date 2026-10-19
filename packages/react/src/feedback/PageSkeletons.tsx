"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { Skeleton } from "../ui/skeleton";

export interface ResourceListSkeletonProps {
  /** Number of skeleton rows; defaults to 8. */
  rows?: number;
  /** Number of skeleton columns; defaults to 5. */
  columns?: number;
  className?: string;
}

export function ResourceListSkeleton({
  rows = 8,
  columns = 5,
  className,
}: ResourceListSkeletonProps) {
  return (
    <div className={cn("fp-space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="fp-flex fp-items-center fp-justify-between">
        <Skeleton className="fp-h-7 fp-w-48" />
        <Skeleton className="fp-h-9 fp-w-28" />
      </div>
      <div className="fp-flex fp-flex-wrap fp-gap-2">
        <Skeleton className="fp-h-9 fp-w-64" />
        <Skeleton className="fp-h-9 fp-w-32" />
        <Skeleton className="fp-h-9 fp-w-32" />
      </div>
      <div className="fp-overflow-hidden fp-rounded fp-border fp-border-line fp-bg-surface">
        <table className="fp-w-full fp-text-sm">
          <thead className="fp-bg-canvas">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
                <th key={i} className="fp-px-4 fp-py-2 fp-text-left">
                  <Skeleton className="fp-h-3 fp-w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
              <tr key={r} className="fp-border-t fp-border-line">
                {Array.from({ length: columns }).map((_, c) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
                  <td key={c} className="fp-px-4 fp-py-3">
                    <Skeleton className="fp-h-4 fp-w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Skeleton for a single resource detail page. */
export interface ResourceDetailSkeletonProps {
  rows?: number;
  className?: string;
}

export function ResourceDetailSkeleton({ rows = 8, className }: ResourceDetailSkeletonProps) {
  return (
    <div className={cn("fp-space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="fp-flex fp-items-center fp-justify-between">
        <Skeleton className="fp-h-7 fp-w-72" />
        <Skeleton className="fp-h-9 fp-w-20" />
      </div>
      <div className="fp-rounded fp-border fp-border-line fp-bg-surface fp-p-6">
        <dl className="fp-grid fp-grid-cols-1 fp-gap-x-6 fp-gap-y-3 sm:fp-grid-cols-[max-content_1fr]">
          {Array.from({ length: rows }).map((_, i) => (
            <React.Fragment
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
              key={i}
            >
              <Skeleton className="fp-h-4 fp-w-24" />
              <Skeleton className="fp-h-4 fp-w-48" />
            </React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

export interface DashboardSkeletonProps {
  metrics?: number;
  className?: string;
}

export function DashboardSkeleton({ metrics = 4, className }: DashboardSkeletonProps) {
  return (
    <div className={cn("fp-space-y-6", className)} aria-busy="true" aria-live="polite">
      <Skeleton className="fp-h-8 fp-w-56" />
      <div className="fp-grid fp-grid-cols-1 fp-gap-3 sm:fp-grid-cols-2 lg:fp-grid-cols-4">
        {Array.from({ length: metrics }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
          <div key={i} className="fp-rounded fp-border fp-border-line fp-bg-surface fp-p-4">
            <Skeleton className="fp-mb-3 fp-h-3 fp-w-20" />
            <Skeleton className="fp-h-8 fp-w-24" />
          </div>
        ))}
      </div>
      <div className="fp-rounded fp-border fp-border-line fp-bg-surface fp-p-6">
        <Skeleton className="fp-h-64 fp-w-full" />
      </div>
    </div>
  );
}
