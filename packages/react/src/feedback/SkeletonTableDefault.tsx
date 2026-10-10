import { DEFAULT_LABELS } from "@flowpanel/core/labels";
import { cn } from "../lib/cn";
import { Skeleton } from "../ui/skeleton";

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
  /** Read out while the rows load. */
  label?: string;
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultSkeletonTable({
  rows = 5,
  columns = 4,
  className,
  label = DEFAULT_LABELS.table.loading,
}: SkeletonTableProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={cn("fp-overflow-hidden fp-rounded fp-border fp-border-line", className)}
    >
      <div className="fp-border-b fp-border-line fp-bg-canvas fp-px-4 fp-py-3">
        <Skeleton className="fp-h-4 fp-w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder — no identity
          key={i}
          className="fp-flex fp-gap-4 fp-px-4 fp-py-3 fp-border-b fp-border-line last:fp-border-b-0"
        >
          {Array.from({ length: columns }).map((_, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder — no identity
            <Skeleton key={j} className="fp-h-4 fp-flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
