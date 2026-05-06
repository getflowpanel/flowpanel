import { Skeleton } from "../ui/skeleton.js";

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className={`overflow-hidden rounded-fp border border-fp-border-1 ${className ?? ""}`}
    >
      <div className="border-b border-fp-border-1 bg-fp-bg-2 px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder — no identity
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-fp-border-1 last:border-b-0">
          {Array.from({ length: columns }).map((_, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder — no identity
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
