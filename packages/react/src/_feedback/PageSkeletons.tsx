"use client";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { Skeleton } from "../ui/skeleton.js";

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
    <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1">
        <table className="w-full text-sm">
          <thead className="bg-fp-bg-2">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
                <th key={i} className="px-4 py-2 text-left">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
              <tr key={r} className="border-t border-fp-border-1">
                {Array.from({ length: columns }).map((_, c) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
                  <td key={c} className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
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
    <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {Array.from({ length: rows }).map((_, i) => (
            <React.Fragment
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
              key={i}
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
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
    <div className={cn("space-y-6", className)} aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: metrics }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder.
          <div key={i} className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
